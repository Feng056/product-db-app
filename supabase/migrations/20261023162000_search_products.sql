-- 多标签筛选查询函数：按产品库 + 分类 + 标签（任一命中）分页查询
create or replace function public.search_products(
  p_library_id uuid,
  p_category text default null,
  p_tags text[] default '{}',
  p_limit int default 30
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_total bigint;
  v_items jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return jsonb_build_object('total', 0, 'items', '[]'::jsonb);
  end if;

  select count(*) into v_total
  from public.products p
  where p.user_id = v_user_id
    and p.library_id = p_library_id
    and (p_category is null or p_category = '' or p.category = p_category)
    and (
      p_tags = '{}'
      or exists (
        select 1
        from jsonb_to_recordset(coalesce(p.specs, '[]'::jsonb)) as s(key text, value text)
        where s.key = '标签' and s.value = any(p_tags)
      )
    );

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_items
  from (
    select p.id, p.name, p.model, p.category, p.price, p.images
    from public.products p
    where p.user_id = v_user_id
      and p.library_id = p_library_id
      and (p_category is null or p_category = '' or p.category = p_category)
      and (
        p_tags = '{}'
        or exists (
          select 1
          from jsonb_to_recordset(coalesce(p.specs, '[]'::jsonb)) as s(key text, value text)
          where s.key = '标签' and s.value = any(p_tags)
        )
      )
    order by p.updated_at desc
    limit p_limit
  ) t;

  return jsonb_build_object('total', v_total, 'items', v_items);
end;
$$;

grant execute on function public.search_products(uuid, text, text[], int) to authenticated;
