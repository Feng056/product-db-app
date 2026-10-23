-- 产品表：每行归属一个用户（user_id 隔离）
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  name text not null,                        -- 产品名称
  model text not null default '',            -- 型号
  category text not null default '未分类',     -- 分类
  specs jsonb not null default '[]'::jsonb,   -- 规格参数：[{key, value}]
  price numeric,                             -- 价格（元）
  notes text not null default '',            -- 备注

  images text[] not null default '{}',        -- 图片：product-images bucket 中的 Storage 路径
  docs jsonb not null default '[]'::jsonb,    -- 文档附件：[{name, path}]，path 在 product-docs bucket

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_user_id_idx on public.products (user_id);
create index products_user_name_model_idx on public.products (user_id, name, model);
create index products_category_idx on public.products (user_id, category);

-- 更新时间自动维护
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
