-- ============================================================
-- 商品编码批量重编 · 执行版（会写数据！先跑 regen-codes-dryrun.sql 核对）
-- 对象：只限 Feng 自己的商品（user_id = 下面的值）
-- 规则：组号按 ①50 组 → ②60 组 → ③名称前两位数字十年取整（不再看旧型号）
--       → ④兜底 10；组内按创建时间先后从 0001 顺序排，编码 = 组号 + 4 位序号。
-- 唯一性 guard：新编码总数 ≠ 去重数，或任一新编码不是 6 位数字时，
--       DO 块直接抛异常，本文件不执行任何写入。
-- 注意：
--   1. 本文件含临时表 + DO 块 + 校验查询，需整段一次粘贴到 SQL Editor 里跑。
--   2. 订阅副本行（user_id 是自己、但库是订阅来的）也在 user_id 范围内；
--      下次拉取/推送同步时会按源库型号改回，属过渡态，不影响源库。
--   3. 重编后：旧 Excel（按名称+旧型号匹配）将匹配不上这些商品，
--      再导入会当成新品而不是覆盖/跳过；旧型号只留在 product_history 快照里。
-- ============================================================

DROP TABLE IF EXISTS _regen_codes;
CREATE TEMP TABLE _regen_codes AS
WITH raw AS (
  SELECT
    p.id,
    p.name,
    p.model AS old_code,
    p.created_at,
    p.category,
    p.specs,
    regexp_replace(p.name, '\D', '', 'g') AS name_digits
  FROM public.products AS p
  WHERE p.user_id = '9b33b5fe-ff38-4026-8436-b204c1aa52fa'
),
base AS (
  SELECT
    *,
    CASE
      -- ① 50 组（任一成立）：名称含 黑（单字就够）；
      --    分类含 垃圾袋/平口袋/黑色（按包含算）；
      --    任一标签（specs 里 key=标签 的行）含其中之一 → 50
      WHEN name LIKE '%黑%'
        OR category LIKE '%垃圾袋%'
        OR category LIKE '%平口袋%'
        OR category LIKE '%黑色%'
        OR (
          jsonb_typeof(specs) = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(specs) AS s
            WHERE s->>'key' = '标签'
              AND (
                s->>'value' LIKE '%垃圾袋%'
                OR s->>'value' LIKE '%平口袋%'
                OR s->>'value' LIKE '%黑色%'
              )
          )
        )
      THEN '50'
      -- ② 60 组（任一成立）：名称含 海鲜；分类含 海鲜；任一标签含 海鲜 → 60
      WHEN name LIKE '%海鲜%'
        OR category LIKE '%海鲜%'
        OR (
          jsonb_typeof(specs) = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(specs) AS s
            WHERE s->>'key' = '标签'
              AND s->>'value' LIKE '%海鲜%'
          )
        )
      THEN '60'
      -- ③ 其余按名称里先出现的两位数字字符按十年取整（不再看旧型号）
      WHEN length(name_digits) >= 2 THEN
        CASE
          WHEN (substring(name_digits FROM 1 FOR 2))::int BETWEEN 10 AND 19 THEN '10'
          WHEN (substring(name_digits FROM 1 FOR 2))::int BETWEEN 20 AND 29 THEN '20'
          WHEN (substring(name_digits FROM 1 FOR 2))::int BETWEEN 30 AND 39 THEN '30'
          WHEN (substring(name_digits FROM 1 FOR 2))::int BETWEEN 40 AND 99 THEN '40'
          ELSE '10'
        END
      -- ④ 名称里没有数字 → 兜底 10
      ELSE '10'
    END AS grp
  FROM raw
),
numbered AS (
  SELECT
    *,
    grp || LPAD(
      (ROW_NUMBER() OVER (PARTITION BY grp ORDER BY created_at, id))::text,
      4,
      '0'
    ) AS new_code
  FROM base
)
SELECT id, name, old_code, grp, new_code FROM numbered;

DO $$
DECLARE
  v_total integer;
  v_distinct integer;
  v_bad integer;
BEGIN
  SELECT
    COUNT(*),
    COUNT(DISTINCT new_code),
    COUNT(*) FILTER (WHERE new_code !~ '^\d{6}$')
  INTO v_total, v_distinct, v_bad
  FROM _regen_codes;

  IF v_total = 0 THEN
    RAISE EXCEPTION '没有符合条件的商品，不执行';
  END IF;
  IF v_total <> v_distinct OR v_bad > 0 THEN
    RAISE EXCEPTION
      '新编码会产生重复或格式异常（总数 %，去重 %，异常 %），未执行任何写入',
      v_total, v_distinct, v_bad;
  END IF;

  UPDATE public.products AS p
  SET model = r.new_code,
      updated_at = now()
  FROM _regen_codes AS r
  WHERE p.id = r.id;

  RAISE NOTICE '已重编 % 个商品', v_total;
END $$;

-- 校验：本次重编的每组数量（即实际写入的分布）
SELECT grp, COUNT(*) AS cnt FROM _regen_codes GROUP BY grp ORDER BY grp;

-- 校验（单独跑）：重编后该用户全部商品的编码应无重复
-- SELECT COUNT(*) AS total, COUNT(DISTINCT model) AS distinct_codes
-- FROM public.products
-- WHERE user_id = '9b33b5fe-ff38-4026-8436-b204c1aa52fa';
