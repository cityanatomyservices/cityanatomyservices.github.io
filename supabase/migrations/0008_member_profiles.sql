-- Account features are independent of chat rooms, plans, parcels and routing.
begin;
alter table public.profiles add column if not exists avatar_path text;
alter table public.profiles add column if not exists show_avatar boolean not null default false;
alter table public.profiles add constraint profile_avatar_owned check
  (avatar_path is null or avatar_path = id::text || '/avatar.webp');
alter table public.profiles add constraint profile_handle_length check
  (handle is null or (char_length(handle) between 3 and 30 and handle = btrim(handle)
    and handle ~ '^[[:alnum:]][[:alnum:] ._-]+$')) not valid;
alter table public.profiles add constraint profile_emoji_length check
  (emoji is null or char_length(emoji) between 1 and 12) not valid;

create table public.member_preferences (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings)='object' and octet_length(settings::text)<8000),
  updated_at timestamptz not null default now()
);
create table public.member_favorites (
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_key text not null check (char_length(source_key) between 1 and 500),
  source jsonb not null check (jsonb_typeof(source)='object' and octet_length(source::text)<24000
    and source ? 'key' and source ? 'title' and jsonb_typeof(source->'key')='string'
    and jsonb_typeof(source->'title')='string' and source->>'key'=source_key and char_length(source->>'title') between 1 and 300),
  created_at timestamptz not null default now(),
  primary key(owner_id,source_key)
);
alter table public.member_preferences enable row level security;
alter table public.member_favorites enable row level security;
create policy member_preferences_own on public.member_preferences for all to authenticated
  using ((select auth.uid())=owner_id and coalesce(auth.jwt()->>'is_anonymous','true')='false')
  with check ((select auth.uid())=owner_id and coalesce(auth.jwt()->>'is_anonymous','true')='false');
create policy member_favorites_own on public.member_favorites for all to authenticated
  using ((select auth.uid())=owner_id and coalesce(auth.jwt()->>'is_anonymous','true')='false')
  with check ((select auth.uid())=owner_id and coalesce(auth.jwt()->>'is_anonymous','true')='false');
revoke all on public.member_preferences,public.member_favorites from anon;
grant select,insert,update,delete on public.member_preferences,public.member_favorites to authenticated;

create function public.member_favorites_limit() returns trigger language plpgsql
security invoker set search_path='' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text,381));
  if not exists(select 1 from public.member_favorites where owner_id=new.owner_id and source_key=new.source_key)
    and (select count(*) from public.member_favorites where owner_id=new.owner_id)>=200 then
    raise exception 'You can keep up to 200 favorites. Remove one before adding another.' using errcode='P0001';
  end if;
  return new;
end $$;
create trigger member_favorites_limit before insert on public.member_favorites
  for each row execute function public.member_favorites_limit();

-- One private snapshot; never return email, auth metadata or another account.
create function public.member_load() returns jsonb language sql stable
security invoker set search_path='' as $$
  select case when coalesce(auth.jwt()->>'is_anonymous','true')='false' then jsonb_build_object(
    'profile',(select jsonb_build_object('handle',handle,'emoji',emoji,'avatar_path',avatar_path,'show_avatar',show_avatar)
      from public.profiles where id=auth.uid()),
    'favorites',coalesce((select jsonb_agg(source order by created_at desc) from public.member_favorites where owner_id=auth.uid()),'[]'::jsonb),
    'preferences',coalesce((select settings from public.member_preferences where owner_id=auth.uid()),'{}'::jsonb),
    'progress',coalesce((select jsonb_agg(jsonb_build_object('tour',tour,'stop_id',stop_id)) from public.tour_progress where user_id=auth.uid()),'[]'::jsonb)
  ) else null end;
$$;
revoke all on function public.member_load() from public,anon;
grant execute on function public.member_load() to authenticated;

-- A deliberately small public projection. The profiles table keeps its
-- existing owner-only SELECT policy, including its private email column.
create function public.profile_display(p_handle text) returns jsonb language sql stable
security definer set search_path='' as $$
  select jsonb_build_object('handle',p.handle,'emoji',p.emoji,
    'avatar_path',case when p.show_avatar then p.avatar_path else null end)
  from public.profiles p
  where lower(p.handle)=lower(p_handle) and char_length(p_handle)<=30 and auth.uid() is not null;
$$;
revoke all on function public.profile_display(text) from public,anon;
grant execute on function public.profile_display(text) to authenticated;

create function public.avatar_is_visible(p_path text) returns boolean language sql stable
security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles
    where avatar_path=p_path and show_avatar=true);
$$;
revoke all on function public.avatar_is_visible(text) from public,anon;
grant execute on function public.avatar_is_visible(text) to authenticated;

create function public.member_preference_set(p_key text,p_value jsonb) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_key not in ('theme','explore','ticker','navigation') or p_value is null
    or octet_length(p_value::text)>4000 then raise exception 'Invalid preference'; end if;
  if p_key='theme' and p_value not in ('"light"'::jsonb,'"dark"'::jsonb) then raise exception 'Invalid theme'; end if;
  if p_key='navigation' and p_value not in ('"google"'::jsonb,'"apple"'::jsonb,'"waze"'::jsonb) then raise exception 'Invalid navigation app'; end if;
  if p_key in ('explore','ticker') and jsonb_typeof(p_value)<>'object' then raise exception 'Invalid preference'; end if;
  insert into public.member_preferences(owner_id,settings) values(auth.uid(),jsonb_build_object(p_key,p_value))
    on conflict(owner_id) do update set settings=public.member_preferences.settings||excluded.settings,updated_at=now();
end $$;
revoke all on function public.member_preference_set(text,jsonb) from public,anon;
grant execute on function public.member_preference_set(text,jsonb) to authenticated;

-- Image bytes live in Storage, not in Postgres or the public Git repository.
-- Exactly one 128 KiB WebP per registered user; browser re-encodes originals.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('avatars','avatars',false,131072,array['image/webp']);
create policy avatars_read on storage.objects for select to authenticated using (
  bucket_id='avatars' and (
    (name=(select auth.uid())::text||'/avatar.webp' and coalesce(auth.jwt()->>'is_anonymous','true')='false')
    or public.avatar_is_visible(name)
  )
);
create policy avatars_insert on storage.objects for insert to authenticated with check (
  bucket_id='avatars' and name=(select auth.uid())::text||'/avatar.webp'
  and coalesce(auth.jwt()->>'is_anonymous','true')='false');
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id='avatars' and name=(select auth.uid())::text||'/avatar.webp'
    and coalesce(auth.jwt()->>'is_anonymous','true')='false')
  with check (bucket_id='avatars' and name=(select auth.uid())::text||'/avatar.webp'
    and coalesce(auth.jwt()->>'is_anonymous','true')='false');
create policy avatars_delete on storage.objects for delete to authenticated using (
  bucket_id='avatars' and name=(select auth.uid())::text||'/avatar.webp'
  and coalesce(auth.jwt()->>'is_anonymous','true')='false');
create policy profile_avatar_registered on public.profiles as restrictive for all to authenticated
  using (true) with check (coalesce(auth.jwt()->>'is_anonymous','true')='false'
    or (avatar_path is null and show_avatar=false));
notify pgrst,'reload schema';
commit;
