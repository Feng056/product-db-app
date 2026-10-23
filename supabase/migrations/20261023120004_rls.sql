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
