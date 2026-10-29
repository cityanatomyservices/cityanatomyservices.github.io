-- Private, versioned road network. This never modifies parcels or chat tables.
begin;
create extension if not exists postgis with schema public;
create extension if not exists pgrouting with schema public;
create schema if not exists routing;
revoke all on schema routing from public;

create table if not exists routing.networks (
  id integer primary key,
  active boolean not null default false,
  label text not null,
  metadata jsonb not null,
  extent public.geometry(MultiPolygon,4326) not null,
  created_at timestamptz not null default now()
);
create unique index if not exists routing_active_network on routing.networks(active) where active;
create table if not exists routing.roads (
  version integer not null references routing.networks(id) on delete cascade,
  id bigint not null,
  way bigint not null,
  source bigint not null,
  target bigint not null,
  length real not null check(length > 0),
  fwd real not null,
  rev real not null,
  highway text not null,
  toll boolean not null,
  access text not null,
  estimated boolean not null,
  name text not null,
  blocked boolean not null,
  main boolean not null,
  zone bigint not null default 0,
  geom public.geometry(LineString,4326) not null,
  primary key(version,id)
);
create index if not exists routing_road_geom on routing.roads using gist(geom);
create index if not exists routing_road_source on routing.roads(version,source);
create index if not exists routing_road_target on routing.roads(version,target);
create table if not exists routing.turns (
  version integer not null references routing.networks(id) on delete cascade,
  path bigint[] not null check(cardinality(path) >= 2),
  primary key(version,path)
);
alter table routing.networks enable row level security;
alter table routing.roads enable row level security;
alter table routing.turns enable row level security;
revoke all on routing.networks,routing.roads,routing.turns from public;

create or replace function routing.snap(p public.geometry, v integer, avoid boolean)
returns table(id bigint, fraction float8, distance float8, zone bigint)
language sql stable set search_path = '' as $$
  with candidates as (
    select e.id,e.geom,e.zone from routing.roads e
    where e.version=v and e.main and not e.blocked and (not avoid or not e.toll)
      and e.highway not in ('motorway','motorway_link')
      and e.geom operator(public.&&) public.st_expand(p,0.01)
    order by e.geom operator(public.<->) p limit 24
  )
  select id, greatest(0.000001,least(0.999999,public.st_linelocatepoint(geom,p))),
    public.st_distance(geom::public.geography,p::public.geography),zone
  from candidates order by public.st_distance(geom::public.geography,p::public.geography) limit 1;
$$;

create or replace function routing.calculate(lon1 float8,lat1 float8,lon2 float8,lat2 float8,avoid boolean,v integer)
returns jsonb language plpgsql volatile set search_path = pg_catalog,public,pg_temp as $$
declare
  p1 public.geometry; p2 public.geometry; a record; b record; edges_sql text; turns_sql text; points_sql text;
  steps jsonb; route_path bigint[]; violates boolean; result record; drive_minutes integer; access_minutes integer; engine_schema text;
begin
  if lon1 is null or lat1 is null or lon2 is null or lat2 is null or
    not(lon1 between -180 and 180 and lon2 between -180 and 180 and lat1 between -90 and 90 and lat2 between -90 and 90) then
    return jsonb_build_object('status','invalid_location');
  end if;
  p1 := public.st_setsrid(public.st_makepoint(lon1,lat1),4326);
  p2 := public.st_setsrid(public.st_makepoint(lon2,lat2),4326);
  if not exists(select 1 from routing.networks n where n.id=v and public.st_covers(n.extent,p1) and public.st_covers(n.extent,p2)) then
    return jsonb_build_object('status','outside_network');
  end if;
  select * into a from routing.snap(p1,v,avoid);
  select * into b from routing.snap(p2,v,avoid);
  if a.id is null or b.id is null or a.distance > 250 or b.distance > 250 then
    return jsonb_build_object('status','needs_entrance','snapStartMeters',round(a.distance::numeric), 'snapEndMeters',round(b.distance::numeric));
  end if;
  if a.id=b.id and abs(a.fraction-b.fraction)<0.0000001 then
    access_minutes := ceil((a.distance+b.distance)/80.0);
    return jsonb_build_object('status','ready','driveMinutes',0,'accessMinutes',access_minutes,'minutes',access_minutes,
      'distanceMeters',0,'geometry',null,'snapStartMeters',round(a.distance::numeric),'snapEndMeters',round(b.distance::numeric),
      'networkVersion',v,'calculatedAt',now(),'usesToll',false);
  end if;
  -- Use the full approved extract: bounding boxes can omit necessary detours.
  edges_sql := format('select id,source,target,fwd::float8 as cost,rev::float8 as reverse_cost
    from routing.roads where version=%s and main and not blocked %s
    and (zone=0 or zone in (%s,%s))',v,case when avoid then 'and not toll' else '' end,a.zone,b.zone);
  turns_sql := format('select path, 1000000000::float8 as cost from routing.turns where version=%s',v);
  points_sql := format('select * from (values (1::bigint,%s::bigint,%L::float8,''b''::char),(2::bigint,%s::bigint,%L::float8,''b''::char)) p(pid,edge_id,fraction,side)',a.id,a.fraction,b.id,b.fraction);
  -- pgRouting's SQL wrappers use unqualified internal helpers. Resolve the
  -- installed extension schema, never a client-controlled search path.
  select n.nspname into engine_schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgrouting';
  perform set_config('search_path',format('pg_catalog,%I,public,pg_temp',engine_schema),true);
  -- pgRouting 4 moved driving_side ahead of the optional flags.
  if to_regprocedure(format('%I.pgr_trsp_withpoints(text,text,text,bigint,bigint,boolean,character,boolean)',engine_schema)) is not null then
    execute format('select jsonb_agg(to_jsonb(t) order by t.seq) from %I.pgr_trsp_withpoints($1,$2,$3,-1::bigint,-2::bigint,true,''r''::char,true) t',engine_schema)
      into steps using edges_sql,turns_sql,points_sql;
  else
    execute format('select jsonb_agg(to_jsonb(t) order by t.seq) from %I.pgr_trsp_withpoints($1,$2,$3,-1::bigint,-2::bigint,''r''::char,true,true) t',engine_schema)
      into steps using edges_sql,turns_sql,points_sql;
  end if;
  if steps is null then return jsonb_build_object('status','no_route'); end if;
  select array_agg((s->>'edge')::bigint order by (s->>'seq')::int),
    bool_or((s->>'cost')::float8 >= 100000000)
    into route_path,violates from jsonb_array_elements(steps) s where (s->>'edge')::bigint<>-1;
  -- Fail closed even if the engine returns a path with a prohibited sequence.
  if coalesce(violates,false) or exists(
    select 1 from routing.turns t, generate_series(1,cardinality(route_path)) x
    where t.version=v and t.path[1]=any(route_path) and route_path[x:x+cardinality(t.path)-1]=t.path
  ) then return jsonb_build_object('status','restricted_route'); end if;
  with ordered as (
    select (s->>'seq')::int seq,(s->>'node')::bigint node,(s->>'edge')::bigint edge,
      (s->>'cost')::float8 cost,
      lead((s->>'node')::bigint) over(order by (s->>'seq')::int) next_node
    from jsonb_array_elements(steps) s
  ), portions as (
    select o.*,e.geom,e.length,e.toll,e.estimated,
      case when o.node=-1 then a.fraction when o.node=-2 then b.fraction when o.node=e.source then 0 else 1 end f1,
      case when o.next_node=-1 then a.fraction when o.next_node=-2 then b.fraction when o.next_node=e.source then 0 else 1 end f2
    from ordered o join routing.roads e on e.version=v and e.id=o.edge where o.edge<>-1
  )
  select sum(cost) seconds,sum(length*abs(f2-f1)) meters,bool_or(toll) toll,
    public.st_asgeojson(public.st_makeline(array_agg(
      case when f2>=f1 then public.st_linesubstring(geom,f1,f2)
           else public.st_reverse(public.st_linesubstring(geom,f2,f1)) end order by seq)),6)::jsonb geometry,
    sum(length*abs(f2-f1)) filter(where estimated) estimated_meters
    into result from portions;
  if result.seconds is null or result.seconds<0 then return jsonb_build_object('status','no_route'); end if;
  drive_minutes := ceil(result.seconds/60.0);
  access_minutes := ceil((a.distance+b.distance)/80.0);
  return jsonb_build_object('status','ready','driveMinutes',drive_minutes,'accessMinutes',access_minutes,
    'minutes',drive_minutes+access_minutes,'distanceMeters',round(result.meters::numeric),'geometry',result.geometry,
    'usesToll',result.toll,'estimatedSpeedShare',round((coalesce(result.estimated_meters,0)/nullif(result.meters,0))::numeric,2),
    'snapStartMeters',round(a.distance::numeric),'snapEndMeters',round(b.distance::numeric),
    'networkVersion',v,'calculatedAt',now(),'traffic','not included','restrictionPolicy','conservative');
end $$;
revoke all on all functions in schema routing from public;
commit;
