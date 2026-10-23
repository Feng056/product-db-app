-- 产品库表：每个用户可有多个产品库，可重命名
create table public.libraries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default '我的产品库',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index libraries_user_id_idx on public.libraries (user_id);

-- 更新时间自动维护（复用 set_updated_at 函数）
drop trigger if exists libraries_set_updated_at on public.libraries;
create trigger libraries_set_updated_at
  before update on public.libraries
  for each row execute function public.set_updated_at();

alter table public.libraries enable row level security;

-- 用户管理自己的产品库；管理员可查看所有
create policy "用户管理自己的产品库"
  on public.libraries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "管理员查看所有产品库"
  on public.libraries for select
  using (public.is_admin());

-- 产品表增加 library_id
alter table public.products
  add column if not exists library_id uuid references public.libraries (id) on delete cascade;

create index if not exists products_library_id_idx on public.products (library_id);

-- 为已有产品数据的用户创建默认库
insert into public.libraries (user_id, name)
select distinct p.user_id, '我的产品库'
from public.products p
where not exists (
  select 1 from public.libraries l where l.user_id = p.user_id
);

-- 把现有产品分配到默认库
update public.products p
set library_id = l.id
from public.libraries l
where p.user_id = l.user_id
  and p.library_id is null;
