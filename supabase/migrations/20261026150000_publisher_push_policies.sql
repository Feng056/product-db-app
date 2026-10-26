-- 修复推送：发布者点“推送更新”时，同步写入订阅者副本行、副本设置、
-- “有更新”标记的操作此前都被 RLS 挡住（写策略均为仅本人），且代码不查错，
-- 导致推送静默失败、返回的只是订阅人数。以下三条策略只放行“自己源库的
-- 订阅副本”，不放行其他任何行；订阅者本人、管理员读权限均不动。
-- 注意：管理员代他人审核发布的推送不在此次范围内（管理员对他人行只有读权限，
-- 审批更新他人库行会直接报错返回，属于可见失败，届时再定）。

-- 1. 发布者可写自己源库的订阅副本产品（新增/改动/删除，同步所需）
drop policy if exists "发布者可写订阅副本产品" on public.products;
create policy "发布者可写订阅副本产品"
  on public.products for all
  using (
    exists (
      select 1
      from public.library_subscriptions s
      join public.libraries l on l.id = s.library_id
      where s.copy_library_id = products.library_id
        and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.library_subscriptions s
      join public.libraries l on l.id = s.library_id
      where s.copy_library_id = products.library_id
        and l.user_id = auth.uid()
    )
  );

-- 2. 发布者可同步自己源库的订阅副本设置（推送时同步 time_display）
drop policy if exists "发布者可同步订阅副本设置" on public.libraries;
create policy "发布者可同步订阅副本设置"
  on public.libraries for update
  using (
    exists (
      select 1
      from public.library_subscriptions s
      join public.libraries l on l.id = s.library_id
      where s.copy_library_id = libraries.id
        and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.library_subscriptions s
      join public.libraries l on l.id = s.library_id
      where s.copy_library_id = libraries.id
        and l.user_id = auth.uid()
    )
  );

-- 3. 发布者可标记自己源库的订阅有更新（推送时写 has_update）
drop policy if exists "发布者可标记订阅有更新" on public.library_subscriptions;
create policy "发布者可标记订阅有更新"
  on public.library_subscriptions for update
  using (
    exists (
      select 1
      from public.libraries l
      where l.id = library_subscriptions.library_id
        and l.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.libraries l
      where l.id = library_subscriptions.library_id
        and l.user_id = auth.uid()
    )
  );
