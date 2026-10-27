-- ============================================================
-- 商品编码批量重编 · 试算版（只读，不写任何数据）
-- 对象：只限 Feng 自己的商品（user_id = 下面的值）
-- 先跑本文件核对对照表，确认无误再跑 regen-codes-apply.sql
-- ============================================================

WITH raw AS (
  SELECT
    p.id,
    p.name,
    p.model AS old_code,
    p.category,
    p.created_at,
    p.specs,
    regexp_replace(p.name, '\D', '', 'g') AS name_digits
  FROM public.products AS p
  WHERE p.user_id = '9b33b5fe-ff38-4026-8436-b204c1aa52fa'
),
base AS (
  SELECT
    *,
    CASE
      -- ① 50 组（任一成立）：名称含 黑（单字就够，如大黑手提袋、黑色手提都算）；
      --    分类含 垃圾袋/平口袋/黑色（按包含算，如八折垃圾袋也算）；
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
      -- ③ 特例：名称数字串以 105 开头 → 40（如 105*97白平口）
      WHEN name_digits LIKE '105%' THEN '40'
      -- ④ 其余按名称里先出现的两位数字字符按十年取整（不再看旧型号）
      WHEN length(name_digits) >= 2 THEN
        CASE
          WHEN (substring(name_digits FROM 1 FOR 2))::int BETWEEN 10 AND 19 THEN '10'
          WHEN (substring(name_digits FROM 1 FOR 2))::int BETWEEN 20 AND 29 THEN '20'
          WHEN (substring(name_digits FROM 1 FOR 2))::int BETWEEN 30 AND 39 THEN '30'
          WHEN (substring(name_digits FROM 1 FOR 2))::int BETWEEN 40 AND 99 THEN '40'
          ELSE '10'
        END
      -- ⑤ 名称里没有数字 → 兜底 10
      ELSE '10'
    END AS grp,
    -- 排号档位（同组内先按档位、档内再按创建时间）：
    -- 0 档：名称 = 一串数字 + 一个“白”字（如 1710白、2050白）；
    -- 1 档：纯数字名称（如 1710）；
    -- 2 档：其它全部（如 36红印、4020海鲜、无数字名称）
    CASE
      WHEN name ~ '^[0-9]+白$' THEN 0
      WHEN name ~ '^[0-9]+$' THEN 1
      ELSE 2
    END AS tier
  FROM raw
),
numbered AS (
  SELECT
    *,
    grp || LPAD(
      (ROW_NUMBER() OVER (PARTITION BY grp ORDER BY tier, created_at, id))::text,
      4,
      '0'
    ) AS new_code
  FROM base
)
-- 对照表：旧编码 → 新编码（按组、序号排）
SELECT id, name, old_code, grp, new_code
FROM numbered
ORDER BY grp, new_code;

-- 每组数量（单独跑下面这条；把注释去掉即可，CTE 已完整重复，不依赖上条）
-- WITH raw AS (
--   SELECT p.id, p.name, p.category, p.specs,
--     regexp_replace(p.name, '\D', '', 'g') AS name_digits
--   FROM public.products AS p
--   WHERE p.user_id = '9b33b5fe-ff38-4026-8436-b204c1aa52fa'
-- ),
-- base AS (
--   SELECT *,
--     CASE
--       WHEN name LIKE '%黑%'
--         OR category LIKE '%垃圾袋%' OR category LIKE '%平口袋%' OR category LIKE '%黑色%'
--         OR (jsonb_typeof(specs) = 'array' AND EXISTS (
--           SELECT 1 FROM jsonb_array_elements(specs) AS s
--           WHERE s->>'key' = '标签'
--             AND (s->>'value' LIKE '%垃圾袋%' OR s->>'value' LIKE '%平口袋%' OR s->>'value' LIKE '%黑色%')))
--       THEN '50'
--       WHEN name LIKE '%海鲜%'
--         OR category LIKE '%海鲜%'
--         OR (jsonb_typeof(specs) = 'array' AND EXISTS (
--           SELECT 1 FROM jsonb_array_elements(specs) AS s
--           WHERE s->>'key' = '标签' AND s->>'value' LIKE '%海鲜%'))
--       THEN '60'
--       WHEN name_digits LIKE '105%' THEN '40'
--       WHEN length(name_digits) >= 2 THEN
--         CASE
--           WHEN (substring(name_digits FROM 1 FOR 2))::int BETWEEN 10 AND 19 THEN '10'
--           WHEN (substring(name_digits FROM 1 FOR 2))::int BETWEEN 20 AND 29 THEN '20'
--           WHEN (substring(name_digits FROM 1 FOR 2))::int BETWEEN 30 AND 39 THEN '30'
--           WHEN (substring(name_digits FROM 1 FOR 2))::int BETWEEN 40 AND 99 THEN '40'
--           ELSE '10' END
--       ELSE '10' END AS grp
--   FROM raw
-- )
-- SELECT grp, COUNT(*) AS cnt FROM base GROUP BY grp ORDER BY grp;
