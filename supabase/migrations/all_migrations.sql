-- 用户资料表：与 auth.users 一对一，记录是否为管理员、用掉的邀请码
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  invite_code_id uuid, -- 注册时使用的邀请码（外键在 invite_codes 建表后补充）
  created_at timestamptz not null default now()
);

-- 新用户注册时自动创建 profile 行
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 判断当前登录用户是否为管理员（供 RLS 策略和 Storage 策略使用）
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
$$;
-- 邀请码表
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                 -- 邀请码（唯一，建议大写）
  source_label text not null default '',     -- 来源标注，如 展会 / 朋友介绍
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  max_uses integer not null default 1,       -- 最多可使用次数
  used_count integer not null default 0,     -- 已使用次数
  is_active boolean not null default true    -- 是否启用
);

-- profiles 引用邀请码的外键
alter table public.profiles
  add constraint profiles_invite_code_id_fkey
  foreign key (invite_code_id) references public.invite_codes (id) on delete set null;

create index invite_codes_code_idx on public.invite_codes (code);

-- 校验邀请码是否可用（注册前调用，匿名可执行）
create or replace function public.check_invite_code(p_code text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_code public.invite_codes%rowtype;
begin
  select * into v_code from public.invite_codes where code = p_code;

  if not found then
    return jsonb_build_object('valid', false, 'message', '邀请码不存在');
  end if;
  if not v_code.is_active then
    return jsonb_build_object('valid', false, 'message', '邀请码已停用');
  end if;
  if v_code.used_count >= v_code.max_uses then
    return jsonb_build_object('valid', false, 'message', '邀请码已用完');
  end if;
  return jsonb_build_object('valid', true, 'message', 'ok',
    'source_label', v_code.source_label);
end;
$$;

-- 核销邀请码：used_count+1，并把来源记录到用户 profile（注册后调用，匿名可执行）
create or replace function public.redeem_invite_code(p_code text, p_email text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_code public.invite_codes%rowtype;
  v_uid uuid;
begin
  select * into v_code from public.invite_codes where code = p_code;

  if not found then
    return jsonb_build_object('ok', false, 'message', '邀请码不存在');
  end if;
  if not v_code.is_active then
    return jsonb_build_object('ok', false, 'message', '邀请码已停用');
  end if;
  if v_code.used_count >= v_code.max_uses then
    return jsonb_build_object('ok', false, 'message', '邀请码已用完');
  end if;

  select id into v_uid from auth.users where email = p_email;
  if v_uid is null then
    return jsonb_build_object('ok', false, 'message', '用户不存在');
  end if;

  update public.invite_codes
    set used_count = used_count + 1
    where id = v_code.id;

  update public.profiles
    set invite_code_id = v_code.id
    where id = v_uid;

  return jsonb_build_object('ok', true, 'source_label', v_code.source_label);
end;
$$;

grant execute on function public.check_invite_code(text) to anon, authenticated;
grant execute on function public.redeem_invite_code(text, text) to anon, authenticated;
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
-- Storage buckets：图片公开可读，文档私有
insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('product-docs', 'product-docs', false)
on conflict (id) do nothing;

-- 图片 bucket：公开读取；用户只能上传/删除自己目录（{user_id}/...）下的文件
create policy "公开读取产品图片"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "用户上传自己的产品图片"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "用户删除自己的产品图片"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 文档 bucket：私有；用户只能读写自己目录下的文件
create policy "用户读取自己的文档"
  on storage.objects for select
  using (
    bucket_id = 'product-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "用户上传自己的文档"
  on storage.objects for insert
  with check (
    bucket_id = 'product-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "用户删除自己的文档"
  on storage.objects for delete
  using (
    bucket_id = 'product-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 管理员可读取所有文件
create policy "管理员读取所有文件"
  on storage.objects for select
  using (public.is_admin());
-- RLS 策略：开启所有表的行级安全并定义访问规则

alter table public.profiles enable row level security;
alter table public.invite_codes enable row level security;
alter table public.products enable row level security;

-- ============ profiles ============
-- 用户可查看自己的资料；管理员可查看所有
create policy "用户查看自己的资料，管理员查看所有"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

-- 用户可更新自己的资料，但不能给自己加管理员（除非已是管理员）
create policy "用户更新自己的资料（不能自授管理员）"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (is_admin = false or public.is_admin())
  );

-- ============ invite_codes ============
-- 注册校验需要：所有人（含未登录）可读取「启用中」的邀请码
create policy "所有人可读取启用中的邀请码（供注册校验）"
  on public.invite_codes for select
  using (is_active = true or public.is_admin());

-- 只有管理员可创建 / 修改 / 删除邀请码
create policy "管理员管理邀请码"
  on public.invite_codes for insert
  with check (public.is_admin());

create policy "管理员修改邀请码"
  on public.invite_codes for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "管理员删除邀请码"
  on public.invite_codes for delete
  using (public.is_admin());

-- ============ products ============
-- 用户只能读写自己的产品；管理员可读所有人的
create policy "用户读写自己的产品，管理员可读所有"
  on public.products for select
  using (auth.uid() = user_id or public.is_admin());

create policy "用户创建自己的产品"
  on public.products for insert
  with check (auth.uid() = user_id);

create policy "用户更新自己的产品"
  on public.products for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "用户删除自己的产品"
  on public.products for delete
  using (auth.uid() = user_id);
