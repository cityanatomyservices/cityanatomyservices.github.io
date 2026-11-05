-- Isolated CI only: prove the restrictive policy survives broad permissive rules.
create schema storage;
create table storage.objects(bucket_id text not null,name text not null);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated,service_role;
grant select,insert on storage.objects to anon,authenticated,service_role;
create policy fixture_broad_read on storage.objects for all using(true) with check(true);
insert into storage.objects values('pro-apps','private.html'),('avatars','public-profile.webp');
\i supabase/migrations/0013_pro_app_storage.sql
set role anon;
do $$begin assert (select count(*) from storage.objects where bucket_id='pro-apps')=0;end$$;
reset role;
set role authenticated;
do $$begin
  assert (select count(*) from storage.objects where bucket_id='pro-apps')=0;
  assert (select count(*) from storage.objects where bucket_id='avatars')=1;
  begin insert into storage.objects values('pro-apps','forged.html');raise exception 'Browser writes must fail';exception when insufficient_privilege then null;end;
end$$;
reset role;
set role service_role;
do $$begin assert (select count(*) from storage.objects where bucket_id='pro-apps')=1;end$$;
reset role;
