-- 订阅者详情页显示“最后一次推送时间”：给产品表加 pushed_at。
-- 只有发布者推送（pushToAllSubscribers 经 syncProductsToLibrary，isPush=true）
-- 才会给内容确实变了的副本行写 pushed_at；刷新（拉取）不碰它，
-- 所以订阅者看到的永远是上次推送时间，而不是自己刷新的时间。
-- 源库行与从未被推送过的副本行为空，详情页显示时退回 updated_at。
alter table public.products add column if not exists pushed_at timestamptz;
