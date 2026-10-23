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
