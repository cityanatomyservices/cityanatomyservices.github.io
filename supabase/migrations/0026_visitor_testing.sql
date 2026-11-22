-- Owner-controlled visitor access. Guest tokens still identify one real Auth user.
begin;
set local lock_timeout='5s';
alter table billing_private.testing_settings add column visitors_enabled boolean not null default false;

create function public.visitor_testing_enabled() returns boolean language sql stable security definer set search_path='' as $$
 select visitors_enabled from billing_private.testing_settings where singleton;
$$;
revoke all on function public.visitor_testing_enabled() from public;
grant execute on function public.visitor_testing_enabled() to anon,authenticated,service_role;

create function public.visitor_features_allowed() returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->>'is_anonymous'='false'
   or (auth.jwt()->>'is_anonymous'='true' and public.visitor_testing_enabled()),false);
$$;
revoke all on function public.visitor_features_allowed() from public;
grant execute on function public.visitor_features_allowed() to anon,authenticated,service_role;

create function geofence_private.manager_allowed(p_owner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u where u.id=p_owner and u.deleted_at is null and (
   (not coalesce(u.is_anonymous,true) and u.email_confirmed_at is not null)
   or (u.is_anonymous and exists(select 1 from billing_private.testing_settings where singleton and visitors_enabled and geofences_enabled))));
$$;
revoke all on function geofence_private.manager_allowed(uuid) from public,anon,authenticated;


alter policy progress_registered_only on public.tour_progress
 using ((select public.visitor_features_allowed()))
  with check ((select public.visitor_features_allowed()));

alter policy chat_profile_registered_insert on public.profiles
 with check ((select public.visitor_features_allowed()) or (handle is null and emoji is null));

alter policy chat_profile_registered_update on public.profiles
 using (true) with check ((select public.visitor_features_allowed()) or (handle is null and emoji is null));

alter policy member_preferences_own on public.member_preferences
 using ((select auth.uid())=owner_id and (select public.visitor_features_allowed()))
  with check ((select auth.uid())=owner_id and (select public.visitor_features_allowed()));

alter policy member_favorites_own on public.member_favorites
 using ((select auth.uid())=owner_id and (select public.visitor_features_allowed()))
  with check ((select auth.uid())=owner_id and (select public.visitor_features_allowed()));

alter policy avatars_read on storage.objects
 using (
  bucket_id='avatars' and (
    (name=(select auth.uid())::text||'/avatar.webp' and (select public.visitor_features_allowed()))
    or public.avatar_is_visible(name)
  )
);

alter policy avatars_insert on storage.objects
 with check (
  bucket_id='avatars' and name=(select auth.uid())::text||'/avatar.webp'
  and (select public.visitor_features_allowed()));

alter policy avatars_update on storage.objects
 using (bucket_id='avatars' and name=(select auth.uid())::text||'/avatar.webp'
    and (select public.visitor_features_allowed()))
  with check (bucket_id='avatars' and name=(select auth.uid())::text||'/avatar.webp'
    and (select public.visitor_features_allowed()));

alter policy avatars_delete on storage.objects
 using (
  bucket_id='avatars' and name=(select auth.uid())::text||'/avatar.webp'
  and (select public.visitor_features_allowed()));

alter policy profile_avatar_registered on public.profiles
 using (true) with check ((select public.visitor_features_allowed())
    or (avatar_path is null and show_avatar=false));

alter policy place_comments_own on public.place_comments
 using ((select auth.uid())=author_id and (select public.visitor_features_allowed()))
  with check ((select auth.uid())=author_id and (select public.visitor_features_allowed()));

alter policy special_event_stop_saves_own on public.special_event_stop_saves
 using (owner_id=(select auth.uid()) and (select public.visitor_features_allowed())
   and public.planner_scope_active(event_id));

create or replace function public.member_load() returns jsonb language sql stable
security invoker set search_path='' as $$
  select case when public.visitor_features_allowed() then jsonb_build_object(
    'profile',(select jsonb_build_object('handle',handle,'emoji',emoji,'avatar_path',avatar_path,'show_avatar',show_avatar)
      from public.profiles where id=auth.uid()),
    'favorites',coalesce((select jsonb_agg(source order by created_at desc) from public.member_favorites where owner_id=auth.uid()),'[]'::jsonb),
    'preferences',coalesce((select settings from public.member_preferences where owner_id=auth.uid()),'{}'::jsonb),
    'progress',coalesce((select jsonb_agg(jsonb_build_object('tour',tour,'stop_id',stop_id)) from public.tour_progress where user_id=auth.uid()),'[]'::jsonb)
  ) else null end;
$$;

create or replace function public.place_comments_list(p_source_key text,p_offset integer default 0)
returns table(id uuid,body text,created_at timestamptz,updated_at timestamptz,handle text,emoji text,mine boolean)
language sql stable security definer set search_path='' as $$
  select c.id,c.body,c.created_at,c.updated_at,coalesce(p.handle,'Austin neighbor'),coalesce(p.emoji,'🙂'),
    coalesce(c.author_id=auth.uid() and public.visitor_features_allowed(),false)
  from public.place_comments c left join public.profiles p on p.id=c.author_id
  where c.source_key=p_source_key order by c.created_at desc,c.id desc
  limit 30 offset greatest(0,least(coalesce(p_offset,0),10000));
$$;

create or replace function public.special_event_stop_set(p_event text,p_owner uuid,p_stop text,p_field text,p_value jsonb,p_expected jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.special_event_stop_saves; current_value jsonb;
begin
 if auth.uid() is null or p_owner is distinct from auth.uid() or not public.visitor_features_allowed() then
   raise exception 'Sign In to save' using errcode='PT401';
 end if;
 perform 1 from public.special_events where id=p_event and expires_at>now() for share;
 if not found then raise exception 'This Special Event has expired.' using errcode='PT410';end if;
 if p_stop is null or char_length(p_stop) not between 1 and 200 or p_field is null or p_field not in ('note','favorite')
   or p_value is null or p_expected is null or (p_field='note' and (jsonb_typeof(p_value)<>'string' or char_length(p_value#>>'{}')>2000 or jsonb_typeof(p_expected)<>'string'))
   or (p_field='favorite' and (jsonb_typeof(p_value)<>'boolean' or jsonb_typeof(p_expected)<>'boolean')) then
   raise exception 'Invalid saved stop.' using errcode='PT422';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text||':'||p_event,417));
 select * into saved from public.special_event_stop_saves where owner_id=p_owner and event_id=p_event and stop_id=p_stop for update;
 current_value:=case when p_field='note' then to_jsonb(coalesce(saved.note,'')) else to_jsonb(coalesce(saved.favorite,false)) end;
 if current_value is distinct from p_expected then raise exception 'This saved stop changed on another device. Reload it before editing.' using errcode='PT409';end if;
 if saved.owner_id is null and (select count(*) from public.special_event_stop_saves where owner_id=p_owner and event_id=p_event)>=1000 then
   raise exception 'The saved-stop limit for this event has been reached.' using errcode='PT422';end if;
 insert into public.special_event_stop_saves(owner_id,event_id,stop_id,note,favorite)
 values(p_owner,p_event,p_stop,case when p_field='note' then p_value#>>'{}' else coalesce(saved.note,'') end,
   case when p_field='favorite' then (p_value#>>'{}')::boolean else coalesce(saved.favorite,false) end)
 on conflict(owner_id,event_id,stop_id) do update set note=excluded.note,favorite=excluded.favorite,updated_at=now()
 returning * into saved;
 return jsonb_build_object('stop_id',saved.stop_id,'note',saved.note,'favorite',saved.favorite);
end $$;

create or replace function classifieds_private.member_id() returns uuid language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from auth.users u where u.id=auth.uid() and u.deleted_at is null and (
    (not coalesce(u.is_anonymous,true) and u.email_confirmed_at is not null) or (u.is_anonymous and public.visitor_testing_enabled()))) then
   raise exception 'Sign in to use classifieds.' using errcode='42501';
 end if;
 return auth.uid();
end $$;

create or replace function public.membership_read() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare member uuid;row billing_private.members;external jsonb;site_until timestamptz;substack_until timestamptz;testing boolean;temporary boolean;
begin
 if auth.uid() is not null and auth.jwt()->>'is_anonymous'='true' and public.visitor_testing_enabled() then
  select pro_enabled into testing from billing_private.testing_settings where singleton;
  return jsonb_build_object('plan',case when testing then 'pro' else 'free' end,'temporaryAccess',testing,'freeTesting',testing,'source',case when testing then 'testing' end,'hasBilling',false);
 end if;
 if coalesce(auth.jwt()->>'is_anonymous','true')<>'false' then raise exception using errcode='42501',message='Sign in to view membership';end if;
 select id into member from auth.users where id=auth.uid() and not coalesce(is_anonymous,true) and email_confirmed_at is not null;
 if member is null then raise exception using errcode='42501',message='Confirmed account required';end if;
 select * into row from billing_private.members where mode='live' and owner_id=member;
 if row.status='active' and row.pro_until>now() then site_until:=row.pro_until;end if;
 external:=public.billing_substack_access(member);substack_until:=(external->>'paidThrough')::timestamptz;
 select pro_enabled into testing from billing_private.testing_settings where singleton;
 temporary:=testing and (public.visitor_testing_enabled() or exists(select 1 from billing_private.testing_members where owner_id=member)) and site_until is null and substack_until is null;
 return jsonb_build_object('plan',case when site_until is not null or substack_until is not null or temporary then 'pro' else 'free' end,
  'paidThrough',greatest(site_until,substack_until),'cancelAtPeriodEnd',coalesce(row.cancel_at_period_end,false),'hasBilling',row.customer_id is not null,
  'source',case when site_until is not null and substack_until is not null then 'both' when substack_until is not null then 'substack' when site_until is not null then 'site' when temporary then 'testing' else null end,
  'sitePaidThrough',site_until,'substackPaidThrough',substack_until,'temporaryAccess',temporary,'freeTesting',testing);
end $$;

create or replace function public.geofence_schedule_set(p_owner uuid,p_id uuid,p_start timestamptz,p_end timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare s geofence_private.spaces;
begin
 if not geofence_private.manager_allowed(p_owner) then raise exception 'Confirmed account required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,920));
 select * into s from geofence_private.spaces where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'Geofence not found' using errcode='PT404';end if;
 if (p_start is null)<>(p_end is null) or p_start is not null and (not isfinite(p_start) or not isfinite(p_end) or p_end<=p_start) then raise exception 'Enter a start time and a later end time.' using errcode='PT422';end if;
 update geofence_private.spaces set starts_at=p_start,ends_at=p_end where id=p_id returning * into s;
 if not public.geofence_active(p_id) then delete from geofence_private.people where space_id=p_id;end if;
 return to_jsonb(s)-'owner_id';
end $$;

create or replace function geofence_private.save_draft_base(p_owner uuid,p_id uuid,p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s geofence_private.spaces;begin
 if not geofence_private.manager_allowed(p_owner) then raise exception 'Confirmed account required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,918));
 select * into s from geofence_private.spaces where id=p_id for update;
 if found and s.owner_id<>p_owner then raise exception 'Geofence not found' using errcode='PT404';end if;
 if s.id is null and (select count(*) from geofence_private.spaces where owner_id=p_owner)>=50 then raise exception 'Geofence limit reached' using errcode='PT422';end if;
 if exists(select 1 from geofence_private.billing where space_id=p_id and (customer_id is not null or lease_until>clock_timestamp())) then raise exception 'This location is locked because billing has begun.' using errcode='PT409';end if;
 insert into geofence_private.spaces(id,owner_id,name,description,latitude,longitude,diameter)
 values(p_id,p_owner,p_fields->>'name',p_fields->>'description',(p_fields->>'latitude')::double precision,(p_fields->>'longitude')::double precision,(p_fields->>'diameter')::integer)
 on conflict(id) do update set name=excluded.name,description=excluded.description,latitude=excluded.latitude,longitude=excluded.longitude,diameter=excluded.diameter returning * into s;
 return to_jsonb(s)-'owner_id';
end $$;

create or replace function public.access_testing_grant(p_kind text,p_owner uuid,p_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare settings billing_private.testing_settings;s geofence_private.spaces;
begin
 if p_kind is null or p_kind not in ('pro','geofence') then raise exception 'Invalid access type' using errcode='PT422';end if;
 if not (exists(select 1 from auth.users where id=p_owner and not coalesce(is_anonymous,true) and email_confirmed_at is not null) or (p_kind='geofence' and geofence_private.manager_allowed(p_owner))) then raise exception 'Confirmed account required' using errcode='42501';end if;
 select * into settings from billing_private.testing_settings where singleton for share;
 if (p_kind='pro' and not settings.pro_enabled) or (p_kind='geofence' and not settings.geofences_enabled) then raise exception 'Free testing has ended. Refresh to see current options.' using errcode='PT409';end if;
 if p_kind='pro' then
  if p_id is not null then raise exception 'Invalid membership request' using errcode='PT422';end if;
  insert into billing_private.testing_members(owner_id) values(p_owner) on conflict do nothing;
 else
  select * into s from geofence_private.spaces where id=p_id and owner_id=p_owner for update;
  if not found then raise exception 'Geofence not found' using errcode='PT404';end if;
  insert into geofence_private.testing_spaces(space_id) values(p_id) on conflict do nothing;
 end if;
 return jsonb_build_object('activated',true,'temporaryAccess',true);
end $$;

create or replace function public.geofence_is_owner(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from geofence_private.spaces s join auth.users u on u.id=s.owner_id
 where s.id=p_id and u.id=auth.uid() and geofence_private.manager_allowed(u.id));
$$;

create or replace function public.geofence_chat_v2(p_id uuid,p_lat double precision default null,p_lng double precision default null,p_accuracy double precision default null,p_timestamp timestamptz default null,p_text text default null,p_leave boolean default false,p_name text default null,p_use_profile boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s geofence_private.spaces;person geofence_private.people;dist double precision;uid uuid:=auth.uid();conversation uuid;display_name text;
begin
 if uid is null then raise exception 'A chat session is required' using errcode='PT401';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,920));
 if p_leave then delete from geofence_private.people where space_id=p_id and user_id=uid;return '{}'::jsonb;end if;
 if not public.geofence_active(p_id) then raise exception 'This geofence is not active.' using errcode='PT410';end if;
 select * into s from geofence_private.spaces where id=p_id;
 if p_lat is null or p_lat not between -90 and 90 or p_lng is null or p_lng not between -180 and 180 or p_accuracy is null or p_accuracy not between 0 and least(50,s.diameter/2.0) or p_timestamp is null or p_timestamp<clock_timestamp()-interval '45 seconds' or p_timestamp>clock_timestamp()+interval '5 seconds' then raise exception 'A fresh, precise GPS location is required.' using errcode='PT403';end if;
 dist:=12742000*asin(sqrt(least(1,power(sin(radians(p_lat-s.latitude)/2),2)+cos(radians(s.latitude))*cos(radians(p_lat))*power(sin(radians(p_lng-s.longitude)/2),2))));
 if dist>s.diameter/2.0 then raise exception 'You are outside this chat circle.' using errcode='PT403';end if;
 if p_use_profile then
  select p.handle into display_name from public.profiles p join auth.users u on u.id=p.id where p.id=uid and ((not coalesce(u.is_anonymous,true) and u.email_confirmed_at is not null) or (u.is_anonymous and public.visitor_testing_enabled()));
  if display_name is null then raise exception 'Set a profile name in Account, or choose an anonymous name.' using errcode='PT422';end if;
 else
  display_name:=coalesce(btrim(p_name),'Visitor '||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)));
  if char_length(display_name) not between 1 and 30 or display_name ~ '[[:cntrl:]@]' then raise exception 'Choose an anonymous name of 1 to 30 characters, without an email address.' using errcode='PT422';end if;
 end if;
 delete from geofence_private.people where space_id=p_id and expires_at<clock_timestamp();
 select id into conversation from geofence_private.conversations where space_id=p_id and ended_at is null for update;
 if conversation is null then insert into geofence_private.conversations(space_id,started_at) values(p_id,clock_timestamp()) returning id into conversation;end if;
 insert into geofence_private.people(space_id,user_id,conversation_id,nickname,joined_at,expires_at) values(p_id,uid,conversation,display_name,clock_timestamp(),clock_timestamp()+interval '20 seconds')
 on conflict(space_id,user_id) do update set expires_at=excluded.expires_at returning * into person;
 if p_text is not null then
  if char_length(btrim(p_text)) not between 1 and 500 then raise exception 'Use 1–500 characters.' using errcode='PT422';end if;
  if person.last_sent>clock_timestamp()-interval '1 second' then raise exception 'Please wait before sending again.' using errcode='PT429';end if;
  insert into geofence_private.messages(space_id,conversation_id,visitor_id,nickname,body,created_at) values(p_id,conversation,person.visitor_id,person.nickname,btrim(p_text),clock_timestamp());
  update geofence_private.people set last_sent=clock_timestamp() where space_id=p_id and user_id=uid;
 end if;
 return jsonb_build_object('self',person.visitor_id,'conversationId',conversation,
 'people',(select coalesce(jsonb_agg(jsonb_build_object('id',visitor_id,'name',nickname) order by joined_at),'[]'::jsonb) from geofence_private.people where space_id=p_id and expires_at>clock_timestamp()),
 'messages',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) from (select id,visitor_id,nickname,body,created_at from geofence_private.messages where conversation_id=conversation and created_at>=person.joined_at order by id desc limit 100)m));
end $$;

create or replace function public.geofence_email_save(p_owner uuid,p_id uuid,p_enabled boolean,p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous geofence_private.email_settings;account_email text;destination text:=lower(btrim(p_email));v uuid:=gen_random_uuid();confirmed boolean;
begin
 select case when u.email_confirmed_at is not null and not u.is_anonymous then lower(u.email) end into account_email from geofence_private.spaces s join auth.users u on u.id=s.owner_id
 where s.id=p_id and s.owner_id=p_owner and geofence_private.manager_allowed(u.id) for update of s;
 if not found then raise exception 'Geofence not found' using errcode='PT404';end if;
 if p_enabled=false and coalesce(destination,'')='' then
  select email into destination from geofence_private.email_settings where space_id=p_id;
  if destination is null then return public.geofence_email_list(p_owner)->p_id::text;end if;
 end if;
 if p_enabled is null or destination is null or length(destination)>254 or destination !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid notification email.' using errcode='PT422';end if;
 select * into previous from geofence_private.email_settings where space_id=p_id;
 if previous.enabled=p_enabled and previous.email=destination and (previous.verified or previous.verify_until>now() or not p_enabled) then return public.geofence_email_list(p_owner)->p_id::text;end if;
 confirmed:=coalesce(destination=account_email,false) or coalesce(previous.email=destination and previous.verified,false);
 if p_enabled and not confirmed and (select count(*) from geofence_private.email_jobs j join geofence_private.spaces s on s.id=j.space_id where s.owner_id=p_owner and j.kind='verify' and j.created_at>now()-interval '1 hour')>=5 then raise exception 'Please wait before requesting another verification email.' using errcode='PT429';end if;
 insert into geofence_private.email_settings(space_id,enabled,email,verified,version,verify_until) values(p_id,p_enabled,destination,confirmed,v,now()+interval '24 hours')
 on conflict(space_id) do update set enabled=excluded.enabled,email=excluded.email,verified=excluded.verified,version=v,verify_token=gen_random_uuid(),stop_token=gen_random_uuid(),verify_until=excluded.verify_until,updated_at=now();
 update geofence_private.email_jobs set state='cancelled',result='Email settings changed' where space_id=p_id and kind in ('verify','activity') and state in ('pending','processing');
 if p_enabled and not confirmed then insert into geofence_private.email_jobs(space_id,kind,settings_version) values(p_id,'verify',v);end if;
 return public.geofence_email_list(p_owner)->p_id::text;
end $$;

create or replace function geofence_private.queue_welcome(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not geofence_private.entitled(p_id) or exists(select 1 from geofence_private.spaces where id=p_id and ends_at<=now()) then return;end if;
 insert into geofence_private.email_activations(space_id) values(p_id) on conflict do nothing;
 if found and exists(select 1 from geofence_private.spaces s join auth.users u on u.id=s.owner_id where s.id=p_id and not u.is_anonymous and u.email_confirmed_at is not null) then insert into geofence_private.email_jobs(space_id,kind) values(p_id,'welcome');end if;
 with claimed as (
  update geofence_private.invitations set queued_at=now() where space_id=p_id and queued_at is null returning email
 ) insert into geofence_private.email_jobs(space_id,kind,recipient) select p_id,'invitation',email from claimed;
end $$;

create or replace function public.geofence_mail_context(p_id uuid,p_lease uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j geofence_private.email_jobs;s geofence_private.spaces;e geofence_private.email_settings;account_email text;
begin
 select * into j from geofence_private.email_jobs where id=p_id and lease_id=p_lease and state='processing' and lease_until>now();if not found then return null;end if;
 select * into s from geofence_private.spaces where id=j.space_id;
 select email into account_email from auth.users where id=s.owner_id and not coalesce(is_anonymous,true) and email_confirmed_at is not null;
 if account_email is null and (j.kind='welcome' or not geofence_private.manager_allowed(s.owner_id)) then return null;end if;
 if j.kind='invitation' then
  if not geofence_private.entitled(s.id) or s.ends_at<=now() or not exists(select 1 from geofence_private.invitations where space_id=s.id and email=j.recipient and queued_at is not null) then return null;end if;
  return jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'diameter',s.diameter,'startsAt',s.starts_at,'endsAt',s.ends_at,'email',j.recipient);
 end if;
 select * into e from geofence_private.email_settings where space_id=s.id;
 if j.kind<>'welcome' and (e.space_id is null or not e.enabled or e.version<>j.settings_version) then return null;end if;
 if j.kind='verify' and (e.verified or e.verify_until<=now()) then return null;end if;
 if j.kind='activity' and not e.verified then return null;end if;
 if j.kind='welcome' and (not geofence_private.entitled(s.id) or s.ends_at<=now()) then return null;end if;
 if j.kind='activity' and not public.geofence_active(s.id) then return null;end if;
 return jsonb_build_object('id',s.id,'name',s.name,'description',s.description,'diameter',s.diameter,'startsAt',s.starts_at,'endsAt',s.ends_at,
 'email',case when j.kind='welcome' then account_email else e.email end,'verifyToken',e.verify_token,'stopToken',e.stop_token);
end $$;

create or replace function geofence_private.entitled(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from geofence_private.billing where mode='live' and space_id=p_id and status='active' and pro_until>now())
 or exists(select 1 from geofence_private.testing_spaces t cross join billing_private.testing_settings s where t.space_id=p_id and s.singleton and s.geofences_enabled and exists(select 1 from geofence_private.spaces g join auth.users u on u.id=g.owner_id where g.id=t.space_id and (not u.is_anonymous or s.visitors_enabled)));
$$;

-- Reminders have a verified destination independent of the visitor's login.
create table billing_private.visitor_reminder_addresses (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 email text not null check(length(email)<=254 and email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'),
 token uuid not null unique default gen_random_uuid(), requested_at timestamptz not null default now(), verified boolean not null default false
);
alter table billing_private.visitor_reminder_addresses enable row level security;
revoke all on billing_private.visitor_reminder_addresses from public,anon,authenticated;

create function public.visitor_reminder_address(p_owner uuid) returns text language sql stable security definer set search_path='' as $$
 select email from billing_private.visitor_reminder_addresses where owner_id=p_owner and verified and public.visitor_testing_enabled();
$$;
create function public.visitor_reminder_request(p_owner uuid,p_email text) returns uuid language plpgsql security definer set search_path='' as $$
declare challenge uuid;
begin
 if not public.visitor_testing_enabled() or not exists(select 1 from auth.users where id=p_owner and is_anonymous) then raise exception 'Guest testing is unavailable' using errcode='42501';end if;
 insert into billing_private.visitor_reminder_addresses as a(owner_id,email) values(p_owner,lower(btrim(p_email)))
 on conflict(owner_id) do update set email=excluded.email,token=gen_random_uuid(),requested_at=now(),verified=false
 where a.requested_at<now()-interval '1 minute' and not a.verified returning token into challenge;
 if challenge is null then raise exception 'Wait a minute before requesting another verification email.' using errcode='PT429';end if;
 return challenge;
end $$;
create function public.visitor_reminder_confirm(p_token uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update billing_private.visitor_reminder_addresses set verified=true where token=p_token and requested_at>now()-interval '24 hours' and public.visitor_testing_enabled();
 return found;
end $$;
revoke all on function public.visitor_reminder_address(uuid),public.visitor_reminder_request(uuid,text),public.visitor_reminder_confirm(uuid) from public,anon,authenticated;
grant execute on function public.visitor_reminder_address(uuid),public.visitor_reminder_request(uuid,text),public.visitor_reminder_confirm(uuid) to service_role;

create or replace function public.reminder_enroll(p_owner uuid,p_event jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid; begins timestamptz; h integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,10));
  if not exists(select 1 from auth.users where id=p_owner and not is_anonymous and email_confirmed_at is not null and deleted_at is null) and public.visitor_reminder_address(p_owner) is null then
    raise exception 'A confirmed email account is required';
  end if;
  begins:=(p_event->>'start')::timestamptz;
  if begins<=now()+interval '2 hours' or begins>now()+interval '366 days' or p_event->>'provider' not in ('explore','city-hall') or length(p_event->>'title') not between 1 and 300 then
    raise exception 'Choose an upcoming timed event at least two hours away';
  end if;
  if (select count(*) from public.event_reminders where owner_id=p_owner and enabled and starts_at>now())>=100 and
     not exists(select 1 from public.event_reminders where owner_id=p_owner and event_key=p_event->>'key' and enabled) then
    raise exception 'You can select up to 100 upcoming event reminders';
  end if;
  insert into public.event_reminders(owner_id,event_key,event,starts_at) values(p_owner,p_event->>'key',p_event,begins)
    on conflict(owner_id,event_key) do update set enabled=true,event=excluded.event
    returning id into rid;
  foreach h in array array[24,2] loop
    if begins-make_interval(hours=>h)>now() then
      insert into public.event_reminder_jobs(reminder_id,lead_hours,due_at) values(rid,h,begins-make_interval(hours=>h))
      on conflict(reminder_id,lead_hours) do update set state='pending',result=null
        where public.event_reminder_jobs.state='cancelled' and public.event_reminder_jobs.payload is null;
    end if;
  end loop;
  return rid;
end $$;

-- Keep public guest circles and upcoming reminder deliveries reachable after a visit.
-- The geofence owner foreign key also prevents deleting a guest who owns a circle.
select cron.schedule('austin_expired_guest_visits','37 * * * *',$job$
  delete from routing.request_limits where window_start<now()-interval '1 day';
  delete from auth.users u where u.is_anonymous
    and u.raw_user_meta_data->>'austin_guest_visit'='true'
    and u.created_at<now()-interval '1 day'
    and not exists(select 1 from geofence_private.spaces g where g.owner_id=u.id)
    and not exists(select 1 from public.event_reminders r where r.owner_id=u.id and r.enabled and r.starts_at>now())
    and not exists(select 1 from auth.sessions s where s.user_id=u.id
      and greatest(s.updated_at,s.created_at)>now()-interval '1 day');
$job$);

notify pgrst,'reload schema';
commit;
