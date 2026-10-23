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
