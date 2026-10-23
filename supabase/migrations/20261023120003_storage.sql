-- Storage buckets：图片公开可读，文档私有
insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('product-docs', 'product-docs', false)
on conflict (id) do nothing;

-- 图片 bucket：公开读取；用户只能上传/删除自己目录（{user_id}/...）下的文件
create policy "公开读取产品图片"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "用户上传自己的产品图片"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "用户删除自己的产品图片"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 文档 bucket：私有；用户只能读写自己目录下的文件
create policy "用户读取自己的文档"
  on storage.objects for select
  using (
    bucket_id = 'product-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "用户上传自己的文档"
  on storage.objects for insert
  with check (
    bucket_id = 'product-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "用户删除自己的文档"
  on storage.objects for delete
  using (
    bucket_id = 'product-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 管理员可读取所有文件
create policy "管理员读取所有文件"
  on storage.objects for select
  using (public.is_admin());
