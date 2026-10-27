-- ============================================================
-- 商品编码批量重编 · 试算版（只读，不写任何数据）
-- 对象：只限 Feng 自己的商品（user_id = 下面的值）
-- 先跑本文件核对对照表，确认无误再跑 regen-codes-apply.sql
-- ============================================================

WITH base AS (
  SELECT
    p.id,
    p.name,
    p.model AS old_code,
    p.category,
    p.created_at,
    CASE
      -- ① 50 组（任一成立）：名称含 黑（单字就够，如大黑手提袋、黑色手提都算）；
      --    分类含 垃圾袋/平口袋/黑色（按包含算，如八折垃圾袋也算）；
      --    任一标签（specs 里 key=标签 的行）含其中之一 → 50
      WHEN p.name LIKE '%黑%'
        OR p.category LIKE '%垃圾袋%'
        OR p.category LIKE '%平口袋%'
        OR p.category LIKE '%黑色%'
        OR (
          jsonb_typeof(p.specs) = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(p.specs) AS s
            WHERE s->>'key' = '标签'
              AND (
                s->>'value' LIKE '%垃圾袋%'
                OR s->>'value' LIKE '%平口袋%'
                OR s->>'value' LIKE '%黑色%'
              )
          )
        )
      THEN '50'
      -- ② 名称含 杯袋 / 单杯 → 10
      WHEN p.name LIKE '%杯袋%' OR p.name LIKE '%单杯%' THEN '10'
      -- ③ 原型号开头两位数字按十年取整
      WHEN p.model ~ '^\d\d' THEN
        CASE
          WHEN (substring(p.model FROM 1 FOR 2))::int BETWEEN 10 AND 19 THEN '10'
          WHEN (substring(p.model FROM 1 FOR 2))::int BETWEEN 20 AND 29 THEN '20'
          WHEN (substring(p.model FROM 1 FOR 2))::int BETWEEN 30 AND 39 THEN '30'
          WHEN (substring(p.model FROM 1 FOR 2))::int BETWEEN 40 AND 99 THEN '40'
          ELSE '10'
        END
      -- ④ 以上都不命中 → 兜底 10
      ELSE '10'
    END AS grp
  FROM public.products AS p
  WHERE p.user_id = '9b33b5fe-ff38-4026-8436-b204c1aa52fa'
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
-- 对照表：旧编码 → 新编码（按组、序号排）
SELECT id, name, old_code, grp, new_code
FROM numbered
ORDER BY grp, new_code;

-- 每组数量（单独跑下面这条；把注释去掉即可，CTE 已完整重复，不依赖上条）
-- WITH base AS (
--   SELECT p.id,
--     CASE
--       WHEN p.name LIKE '%黑%'
--         OR p.category LIKE '%垃圾袋%' OR p.category LIKE '%平口袋%' OR p.category LIKE '%黑色%'
--         OR (jsonb_typeof(p.specs) = 'array' AND EXISTS (
--           SELECT 1 FROM jsonb_array_elements(p.specs) AS s
--           WHERE s->>'key' = '标签'
--             AND (s->>'value' LIKE '%垃圾袋%' OR s->>'value' LIKE '%平口袋%' OR s->>'value' LIKE '%黑色%')))
--       THEN '50'
--       WHEN p.name LIKE '%杯袋%' OR p.name LIKE '%单杯%' THEN '10'
--       WHEN p.model ~ '^\d\d' THEN
--         CASE
--           WHEN (substring(p.model FROM 1 FOR 2))::int BETWEEN 10 AND 19 THEN '10'
--           WHEN (substring(p.model FROM 1 FOR 2))::int BETWEEN 20 AND 29 THEN '20'
--           WHEN (substring(p.model FROM 1 FOR 2))::int BETWEEN 30 AND 39 THEN '30'
--           WHEN (substring(p.model FROM 1 FOR 2))::int BETWEEN 40 AND 99 THEN '40'
--           ELSE '10' END
--       ELSE '10' END AS grp
--   FROM public.products AS p
--   WHERE p.user_id = '9b33b5fe-ff38-4026-8436-b204c1aa52fa'
-- )
-- SELECT grp, COUNT(*) AS cnt FROM base GROUP BY grp ORDER BY grp;
