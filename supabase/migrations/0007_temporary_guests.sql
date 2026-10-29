-- Guest application data is temporary; registered accounts retain private saves.
begin;
-- Restrictive policies also protect direct table calls and older clients.
drop policy if exists planner_registered_only on public.planner_plans;
create policy planner_registered_only on public.planner_plans as restrictive for all to authenticated
  using (coalesce(auth.jwt()->>'is_anonymous','true')='false')
  with check (coalesce(auth.jwt()->>'is_anonymous','true')='false');
drop policy if exists planner_registered_only on public.planner_items;
create policy planner_registered_only on public.planner_items as restrictive for all to authenticated
  using (coalesce(auth.jwt()->>'is_anonymous','true')='false')
  with check (coalesce(auth.jwt()->>'is_anonymous','true')='false');
drop policy if exists progress_registered_only on public.tour_progress;
create policy progress_registered_only on public.tour_progress as restrictive for all to authenticated
  using (coalesce(auth.jwt()->>'is_anonymous','true')='false')
  with check (coalesce(auth.jwt()->>'is_anonymous','true')='false');
-- Profiles are shared with other applications. Restrict only the chat fields;
-- do not remove profile rows or unrelated profile columns.
drop policy if exists chat_profile_registered_insert on public.profiles;
create policy chat_profile_registered_insert on public.profiles as restrictive for insert to authenticated
  with check (coalesce(auth.jwt()->>'is_anonymous','true')='false' or (handle is null and emoji is null));
drop policy if exists chat_profile_registered_update on public.profiles;
create policy chat_profile_registered_update on public.profiles as restrictive for update to authenticated
  using (true) with check (coalesce(auth.jwt()->>'is_anonymous','true')='false' or (handle is null and emoji is null));
drop policy if exists messages_registered_insert on public.messages;
create policy messages_registered_insert on public.messages as restrictive for insert to authenticated
  with check (coalesce(auth.jwt()->>'is_anonymous','true')='false');

-- Clear the old anonymous planner/chat records, keeping registered data intact.
delete from public.planner_plans p using auth.users u where p.owner_id=u.id and u.is_anonymous;
delete from routing.route_cache c using auth.users u where c.owner_id=u.id and u.is_anonymous;
delete from public.tour_progress t using auth.users u where t.user_id=u.id and u.is_anonymous;
delete from public.messages m using auth.users u where m.user_id=u.id and u.is_anonymous;
update public.profiles p set handle=null,emoji=null from auth.users u
  where p.id=u.id and u.is_anonymous and (p.handle is not null or p.emoji is not null);

create or replace function public.planner_route_leg(p_from jsonb,p_to jsonb,p_avoid_tolls boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = '' set statement_timeout = '12s' as $$
declare
  owner uuid := auth.uid(); keep_cache boolean := coalesce(auth.jwt()->>'is_anonymous','true')='false'; v integer; route_key text; cached jsonb; answer jsonb;
  lon1 float8; lat1 float8; lon2 float8; lat2 float8; total integer;
begin
  if owner is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if jsonb_typeof(p_from) is distinct from 'array' or jsonb_typeof(p_to) is distinct from 'array'
    then return jsonb_build_object('status','invalid_location'); end if;
  if jsonb_array_length(p_from)<>2 or jsonb_array_length(p_to)<>2 or
     jsonb_typeof(p_from->0)<>'number' or jsonb_typeof(p_from->1)<>'number' or
     jsonb_typeof(p_to->0)<>'number' or jsonb_typeof(p_to->1)<>'number'
    then return jsonb_build_object('status','invalid_location'); end if;
  lon1 := (p_from->>0)::float8; lat1 := (p_from->>1)::float8;
  lon2 := (p_to->>0)::float8; lat2 := (p_to->>1)::float8;
  if not(lon1 between -180 and 180 and lon2 between -180 and 180 and lat1 between -90 and 90 and lat2 between -90 and 90)
    then return jsonb_build_object('status','invalid_location'); end if;
  select id into v from routing.networks where active;
  if v is null then return jsonb_build_object('status','no_network'); end if;
  route_key := concat(v,':car-planning-v1:',p_avoid_tolls,':',round(lon1::numeric,6),',',round(lat1::numeric,6),':',round(lon2::numeric,6),',',round(lat2::numeric,6));
  if keep_cache then
  select result into cached from routing.route_cache where owner_id=owner and key=route_key and created_at>now()-interval '7 days';
  if cached is not null then return cached || jsonb_build_object('cached',true); end if;
  end if;
  -- One running calculation per identity; anonymous planner sessions work too.
  if not pg_try_advisory_xact_lock(hashtextextended(owner::text,92941)) then
    return jsonb_build_object('status','busy'); end if;
  -- Bound aggregate graph memory/CPU so routing cannot crowd out chat/parcels.
  if not pg_try_advisory_xact_lock(92942,1) then
    if not pg_try_advisory_xact_lock(92942,2) then return jsonb_build_object('status','busy'); end if;
  end if;
  insert into routing.request_limits(owner_id,window_start,requests) values(owner,now(),1)
  on conflict(owner_id) do update set
    requests=case when routing.request_limits.window_start<now()-interval '5 minutes' then 1 else routing.request_limits.requests+1 end,
    window_start=case when routing.request_limits.window_start<now()-interval '5 minutes' then now() else routing.request_limits.window_start end
  returning requests into total;
  if total>180 then return jsonb_build_object('status','rate_limited'); end if;
  answer := routing.calculate(lon1,lat1,lon2,lat2,coalesce(p_avoid_tolls,false),v);
  if keep_cache and answer->>'status'='ready' then
    delete from routing.route_cache where owner_id=owner and created_at<now()-interval '7 days';
    insert into routing.route_cache(owner_id,key,result) values(owner,route_key,answer)
      on conflict(owner_id,key) do update set result=excluded.result,created_at=now();
    delete from routing.route_cache where owner_id=owner and key in (
      select c.key from routing.route_cache c where c.owner_id=owner order by c.created_at desc offset 200);
  end if;
  return answer;
end $$;

-- Browser closure cannot reliably deliver a server cleanup request. Remove
-- only this release's tagged guest auth records after a day without session
-- activity; never delete permanent accounts or other applications' guests.
select cron.unschedule(jobid) from cron.job where jobname='austin_expired_guest_visits';
select cron.schedule('austin_expired_guest_visits','37 * * * *',$job$
  delete from routing.request_limits where window_start<now()-interval '1 day';
  delete from auth.users u where u.is_anonymous
    and u.raw_user_meta_data->>'austin_guest_visit'='true'
    and u.created_at<now()-interval '1 day'
    and not exists(select 1 from auth.sessions s where s.user_id=u.id
      and greatest(s.updated_at,s.created_at)>now()-interval '1 day');
$job$);
notify pgrst,'reload schema';
commit;
