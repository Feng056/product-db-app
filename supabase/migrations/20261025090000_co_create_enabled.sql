-- 共同创作发布时开关：默认关闭，发布者勾选才开启
alter table public.libraries
  add column if not exists co_create_enabled boolean not null default false;
