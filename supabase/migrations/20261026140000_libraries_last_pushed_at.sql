-- 订阅者详情页统一显示“库最后一次推送的时间”：给产品库表加 last_pushed_at。
-- 每次发布者推送（pushToAllSubscribers，含管理员审核通过后的自动推送）结束时，
-- 在源库行上记下这次推送时间；订阅者详情页只读视图显示的就是这个时间，
-- 全部产品统一显示最后一次推送，不再按产品区分。
-- 刷新（拉取）不改它；从未推送过的库为空，详情页退回行级 pushed_at / updated_at。
alter table public.libraries add column if not exists last_pushed_at timestamptz;
