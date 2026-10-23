-- 产品库右上角展示设置：off（关闭）/ avatar（仅头像）/ name（仅名称）
alter table public.profiles
  add column if not exists header_display text not null default 'name';
