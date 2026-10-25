-- 首页显示开关：默认显示；用户可在库管理里关闭，订阅后自建空库默认关闭
alter table public.libraries add column if not exists show_on_home boolean not null default true;
