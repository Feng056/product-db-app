-- 订阅副本的更新时间改为“发布者最后一次修改该产品的时间”。
-- 原 set_updated_at() 无条件用 now() 覆盖 updated_at，导致同步写入副本时
-- 副本的更新时间变成订阅/同步时间，丢掉了源产品的时间。
-- 改成：只有当更新语句没有显式改动 updated_at 时，才盖当前时间。
-- 这样同步代码显式传入源产品的 updated_at 能保留下来；
-- 自建库的编辑（编辑页显式传 now()，批量改价不传）行为不变；
-- libraries 表复用同一函数，其更新从不显式传 updated_at，行为也不变。
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;
  return new;
end;
$$;
