-- search_products 增加 p_query 文本搜索参数（名称/型号模糊匹配）
drop function if exists public.search_products(uuid, text[], text[], int, text);

create or replace function public.search_products(
  p_library_id uuid,
  p_categories text[] default '{}',
  p_tags text[] default '{}',
  p_limit int default 30,
  p_sort text default 'newest',
  p_query text default ''
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
    and (p_categories = '{}' or p.category = any(p_categories))
    and (
      p_tags = '{}'
      or exists (
        select 1
        from jsonb_to_recordset(coalesce(p.specs, '[]'::jsonb)) as s(key text, value text)
        where s.key = '标签' and s.value = any(p_tags)
      )
    )
    and (
      p_query is null or p_query = ''
      or position(lower(p_query) in lower(p.name)) > 0
      or position(lower(p_query) in lower(coalesce(p.model, ''))) > 0
    );

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_items
  from (
    select p.id, p.name, p.model, p.category, p.price, p.images
    from public.products p
    where p.user_id = v_user_id
      and p.library_id = p_library_id
      and (p_categories = '{}' or p.category = any(p_categories))
      and (
        p_tags = '{}'
        or exists (
          select 1
          from jsonb_to_recordset(coalesce(p.specs, '[]'::jsonb)) as s(key text, value text)
          where s.key = '标签' and s.value = any(p_tags)
        )
      )
      and (
        p_query is null or p_query = ''
        or position(lower(p_query) in lower(p.name)) > 0
        or position(lower(p_query) in lower(coalesce(p.model, ''))) > 0
      )
    order by
      case when p_sort = 'price_asc' then p.price end asc nulls last,
      case when p_sort = 'price_desc' then p.price end desc nulls last,
      case when p_sort = 'name' then p.name end asc,
      p.updated_at desc
    limit p_limit
  ) t;

  return jsonb_build_object('total', v_total, 'items', v_items);
end;
$$;

grant execute on function public.search_products(uuid, text[], text[], int, text, text) to authenticated;
