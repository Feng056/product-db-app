-- 产品修改历史：导入覆盖前自动备份，支持回退
create table if not exists public.product_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  reason text not null default 'import',
  created_at timestamptz not null default now()
);

create index if not exists product_history_product_idx on public.product_history(product_id, created_at desc);
create index if not exists product_history_user_idx on public.product_history(user_id);

alter table public.product_history enable row level security;

drop policy if exists "users own history" on public.product_history;
create policy "users own history" on public.product_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
