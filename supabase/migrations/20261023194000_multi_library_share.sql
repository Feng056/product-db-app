-- 分享支持多个产品库：library_shares 增加 library_ids 数组
alter table public.library_shares
  add column if not exists library_ids uuid[] not null default '{}';

-- 回填已有数据
update public.library_shares
set library_ids = array[library_id]
where library_ids = '{}' and library_id is not null;

-- get_library_share 返回多个库
create or replace function public.get_library_share(p_token text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_share public.library_shares%rowtype;
  v_owner text;
  v_libs jsonb;
begin
  select * into v_share from public.library_shares where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'message', '分享链接无效或已撤销');
  end if;

  select display_name into v_owner from public.profiles where id = v_share.user_id;

  select coalesce(jsonb_agg(lib_data order by lib_data ->> 'library_name'), '[]'::jsonb)
  into v_libs
  from (
    select jsonb_build_object(
      'library_name', l.name,
      'product_count', (select count(*) from public.products p where p.library_id = l.id),
      'products', coalesce((
        select jsonb_agg(
          to_jsonb(p) - 'id' - 'user_id' - 'library_id' - 'created_at' - 'updated_at'
          order by p.created_at
        )
        from public.products p
        where p.library_id = l.id
      ), '[]'::jsonb)
    ) as lib_data
    from public.libraries l
    where l.id = any(v_share.library_ids)
  ) t;

  if v_libs = '[]'::jsonb then
    return jsonb_build_object('ok', false, 'message', '分享的产品库不存在');
  end if;

  return jsonb_build_object(
    'ok', true,
    'owner_name', coalesce(v_owner, ''),
    'libraries', v_libs
  );
end;
$$;

grant execute on function public.get_library_share(text) to anon, authenticated;
