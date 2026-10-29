begin;
create table if not exists routing.route_cache (
  owner_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(owner_id,key)
);
create table if not exists routing.request_limits (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null
);
create index if not exists routing_cache_owner_recent on routing.route_cache(owner_id,created_at desc);
alter table routing.route_cache enable row level security;
alter table routing.request_limits enable row level security;
revoke all on schema routing from anon,authenticated;
revoke all on all tables in schema routing from public,anon,authenticated;
revoke all on all functions in schema routing from public,anon,authenticated;

-- The extension is private infrastructure, not a generic SQL API for browsers.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p
    join pg_depend d on d.objid=p.oid and d.classid='pg_proc'::regclass and d.deptype='e'
    join pg_extension e on e.oid=d.refobjid where e.extname='pgrouting'
  loop execute format('revoke execute on function %s from public,anon,authenticated',f.signature); end loop;
end $$;

create or replace function public.planner_routing_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
  select jsonb_build_object('status','ready','networkVersion',id,'label',label,
    'updatedAt',metadata->>'osm_latest_timestamp','profile',metadata->>'profile',
    'traffic','not included','restrictionPolicy','conservative') into result from routing.networks where active;
  return coalesce(result,jsonb_build_object('status','no_network'));
end $$;

create or replace function public.planner_route_leg(p_from jsonb,p_to jsonb,p_avoid_tolls boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = '' set statement_timeout = '12s' as $$
declare
  owner uuid := auth.uid(); v integer; route_key text; cached jsonb; answer jsonb;
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
  select result into cached from routing.route_cache where owner_id=owner and key=route_key and created_at>now()-interval '7 days';
  if cached is not null then return cached || jsonb_build_object('cached',true); end if;
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
  if answer->>'status'='ready' then
    delete from routing.route_cache where owner_id=owner and created_at<now()-interval '7 days';
    insert into routing.route_cache(owner_id,key,result) values(owner,route_key,answer)
      on conflict(owner_id,key) do update set result=excluded.result,created_at=now();
    delete from routing.route_cache where owner_id=owner and key in (
      select c.key from routing.route_cache c where c.owner_id=owner order by c.created_at desc offset 200);
  end if;
  return answer;
end $$;
revoke all on function public.planner_routing_status() from public,anon;
revoke all on function public.planner_route_leg(jsonb,jsonb,boolean) from public,anon;
grant execute on function public.planner_routing_status() to authenticated;
grant execute on function public.planner_route_leg(jsonb,jsonb,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
