-- 产品库分享表：通过链接分享整个产品库
create table public.library_shares (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text unique not null,
  created_at timestamptz not null default now()
);

create index library_shares_token_idx on public.library_shares (token);
create index library_shares_library_idx on public.library_shares (library_id);

alter table public.library_shares enable row level security;

-- 用户管理自己的分享
create policy "用户管理自己的分享"
  on public.library_shares for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 公开读取分享内容的函数（凭 token，无需登录）
create or replace function public.get_library_share(p_token text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_share public.library_shares%rowtype;
  v_lib public.libraries%rowtype;
  v_owner text;
  v_products jsonb;
begin
  select * into v_share from public.library_shares where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'message', '分享链接无效或已撤销');
  end if;

  select * into v_lib from public.libraries where id = v_share.library_id;
  if not found then
    return jsonb_build_object('ok', false, 'message', '产品库不存在');
  end if;

  select display_name into v_owner from public.profiles where id = v_share.user_id;

  select coalesce(
    jsonb_agg(
      to_jsonb(p) - 'id' - 'user_id' - 'library_id' - 'created_at' - 'updated_at'
      order by p.created_at
    ),
    '[]'::jsonb
  )
  into v_products
  from public.products p
  where p.library_id = v_share.library_id;

  return jsonb_build_object(
    'ok', true,
    'library_name', v_lib.name,
    'owner_name', coalesce(v_owner, ''),
    'product_count', jsonb_array_length(v_products),
    'products', v_products
  );
end;
$$;

grant execute on function public.get_library_share(text) to anon, authenticated;
