-- Even a broader future Storage policy must not expose paid app files directly.
-- The Edge function checks membership, then reads with the server service role.
begin;
create policy pro_app_files_backend_only on storage.objects
  as restrictive for all to anon,authenticated
  using (bucket_id <> 'pro-apps') with check (bucket_id <> 'pro-apps');
commit;
