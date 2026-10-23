-- 用户头像：profiles 新增 avatar_path 字段 + avatars 公开 bucket
alter table public.profiles
  add column if not exists avatar_path text not null default '';

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 头像 bucket：公开读取；用户只能上传/更新/删除自己目录（{user_id}/...）下的文件
create policy "公开读取头像"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "用户上传自己的头像"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "用户更新自己的头像"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "用户删除自己的头像"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
