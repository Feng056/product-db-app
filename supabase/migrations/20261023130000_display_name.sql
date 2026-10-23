-- 昵称字段：注册时填写，全站显示用
alter table public.profiles
  add column if not exists display_name text not null default '';

-- 更新核销函数：支持写入昵称
create or replace function public.redeem_invite_code(p_code text, p_email text, p_display_name text default '')
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
    set invite_code_id = v_code.id,
        display_name = p_display_name
    where id = v_uid;

  return jsonb_build_object('ok', true, 'source_label', v_code.source_label);
end;
$$;
