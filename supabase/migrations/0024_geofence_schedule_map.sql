-- Scheduled custom circles and the public Chat map. No visitor coordinates are accepted or stored.
begin;
set local lock_timeout='5s';
alter table geofence_private.spaces add column starts_at timestamptz, add column ends_at timestamptz,
 add constraint geofence_schedule_valid check((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and isfinite(starts_at) and isfinite(ends_at) and ends_at>starts_at));
create index geofence_schedule_end on geofence_private.spaces(ends_at);
create function geofence_private.entitled(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from geofence_private.billing where mode='live' and space_id=p_id and status='active' and pro_until>now())
 or exists(select 1 from geofence_private.testing_spaces t cross join billing_private.testing_settings s where t.space_id=p_id and s.singleton and s.geofences_enabled);
$$;
create or replace function public.geofence_active(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from geofence_private.spaces s where s.id=p_id and geofence_private.entitled(s.id) and (s.starts_at is null or s.starts_at<=now() and s.ends_at>now()));
$$;
create or replace function geofence_private.lock_testing_space() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (to_jsonb(new)-array['starts_at','ends_at']) is distinct from (to_jsonb(old)-array['starts_at','ends_at']) and exists(select 1 from geofence_private.testing_spaces where space_id=old.id) then
  raise exception 'This geofence is already activated. Its location and size are fixed.' using errcode='PT409';
 end if;return new;
end $$;
create function public.geofence_schedule_set(p_owner uuid,p_id uuid,p_start timestamptz,p_end timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare s geofence_private.spaces;
begin
 if not exists(select 1 from auth.users where id=p_owner and not coalesce(is_anonymous,true) and email_confirmed_at is not null) then raise exception 'Confirmed account required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,920));
 select * into s from geofence_private.spaces where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'Geofence not found' using errcode='PT404';end if;
 if (p_start is null)<>(p_end is null) or p_start is not null and (not isfinite(p_start) or not isfinite(p_end) or p_end<=p_start) then raise exception 'Enter a start time and a later end time.' using errcode='PT422';end if;
 update geofence_private.spaces set starts_at=p_start,ends_at=p_end where id=p_id returning * into s;
 if not public.geofence_active(p_id) then delete from geofence_private.people where space_id=p_id;end if;
 return to_jsonb(s)-'owner_id';
end $$;
create function geofence_private.save_draft_base(p_owner uuid,p_id uuid,p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s geofence_private.spaces;begin
 if not exists(select 1 from auth.users where id=p_owner and not coalesce(is_anonymous,true) and email_confirmed_at is not null) then raise exception 'Confirmed account required' using errcode='42501';end if;
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
create or replace function public.geofence_save_draft(p_owner uuid,p_id uuid,p_fields jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,920));
 if exists(select 1 from geofence_private.testing_spaces t join geofence_private.spaces s on s.id=t.space_id where s.id=p_id and s.owner_id=p_owner) then raise exception 'This geofence is already activated. Its location and size are fixed.' using errcode='PT409';end if;
 result:=geofence_private.save_draft_base(p_owner,p_id,p_fields);
 if p_fields ? 'starts_at' or p_fields ? 'ends_at' then result:=public.geofence_schedule_set(p_owner,p_id,(p_fields->>'starts_at')::timestamptz,(p_fields->>'ends_at')::timestamptz);end if;
 return result;
end $$;
create or replace function public.geofence_read(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',s.id,'name',name,'description',description,'latitude',latitude,'longitude',longitude,'diameter',diameter,'paidUntil',b.pro_until,
 'startsAt',s.starts_at,'endsAt',s.ends_at,'active',public.geofence_active(s.id),'activeUntil',least(s.ends_at,case when exists(select 1 from geofence_private.testing_spaces t cross join billing_private.testing_settings settings where t.space_id=s.id and settings.singleton and settings.geofences_enabled) then null else b.pro_until end))
 from geofence_private.spaces s left join geofence_private.billing b on b.space_id=s.id and b.mode='live'
 where s.id=p_id and geofence_private.entitled(s.id);
$$;
create function public.geofence_map() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('circles',coalesce(jsonb_agg(public.geofence_read(s.id)-'paidUntil' order by s.id),'[]'::jsonb),'serverNow',now())
 from geofence_private.spaces s where public.geofence_active(s.id);
$$;
create or replace function geofence_private.queue_welcome(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not geofence_private.entitled(p_id) or exists(select 1 from geofence_private.spaces where id=p_id and ends_at<=now()) then return;end if;
 insert into geofence_private.email_activations(space_id) values(p_id) on conflict do nothing;
 if found then insert into geofence_private.email_jobs(space_id,kind) values(p_id,'welcome');end if;
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
 if account_email is null then return null;end if;
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

revoke all on function geofence_private.entitled(uuid),public.geofence_schedule_set(uuid,uuid,timestamptz,timestamptz),public.geofence_save_draft(uuid,uuid,jsonb),geofence_private.save_draft_base(uuid,uuid,jsonb),public.geofence_map() from public,anon,authenticated;
grant execute on function public.geofence_schedule_set(uuid,uuid,timestamptz,timestamptz),public.geofence_save_draft(uuid,uuid,jsonb) to service_role;
grant execute on function public.geofence_map() to anon,authenticated;
notify pgrst,'reload schema';
commit;
