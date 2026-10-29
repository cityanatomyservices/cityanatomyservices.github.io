-- My Plan Map owns these tables/functions. Chat and parcels are not dependencies.
-- This project already has PostGIS 3.3.7 in public; do not relocate its extension.
begin;
create table if not exists public.planner_plans (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  settings jsonb not null check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 16000),
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);
create index if not exists planner_owner_recent on public.planner_plans(owner_id, updated_at desc);
create table if not exists public.planner_items (
  id uuid primary key,
  plan_id uuid not null,
  owner_id uuid not null,
  position integer not null check (position between 0 and 149),
  source_key text not null check (length(source_key) between 1 and 500),
  source jsonb not null check (jsonb_typeof(source) = 'object' and pg_column_size(source) < 64000),
  schedule jsonb not null check (jsonb_typeof(schedule) = 'object' and pg_column_size(schedule) < 16000),
  location public.geography(Point,4326) generated always as (
    case when jsonb_typeof(source->'coordinates') = 'array'
      then public.st_setsrid(public.st_makepoint((source->'coordinates'->>0)::double precision,
        (source->'coordinates'->>1)::double precision),4326)::public.geography end
  ) stored,
  constraint planner_coordinates check (source->'coordinates' is null or source->'coordinates' = 'null'::jsonb or
    (jsonb_array_length(source->'coordinates') = 2 and
      (source->'coordinates'->>0)::double precision between -180 and 180 and
      (source->'coordinates'->>1)::double precision between -90 and 90)),
  foreign key (plan_id, owner_id) references public.planner_plans(id, owner_id) on delete cascade,
  unique(plan_id, source_key)
);
create index if not exists planner_items_plan on public.planner_items(plan_id, position);
create index if not exists planner_items_location on public.planner_items using gist(location);
alter table public.planner_plans enable row level security;
alter table public.planner_items enable row level security;
drop policy if exists planner_own_plans on public.planner_plans;
create policy planner_own_plans on public.planner_plans for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists planner_own_items on public.planner_items;
create policy planner_own_items on public.planner_items for all to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
revoke all on public.planner_plans, public.planner_items from anon;
grant select,insert,update,delete on public.planner_plans,public.planner_items to authenticated;

-- Atomic snapshot write. Row locks + revision prevent a stale tab/device from
-- silently replacing a newer plan. SECURITY INVOKER preserves both RLS checks.
create or replace function public.planner_save(p_id uuid, p_revision bigint, p_settings jsonb, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare owner uuid := auth.uid(); current_revision bigint; saved_at timestamptz := now();
begin
  if owner is null then raise exception 'Sign in required' using errcode='42501'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 150 then
    raise exception 'A plan can contain up to 150 stops'; end if;
  insert into public.planner_plans(id,owner_id,settings) values(p_id,owner,p_settings) on conflict(id) do nothing;
  select revision into current_revision from public.planner_plans where id=p_id and owner_id=owner for update;
  if current_revision is null then raise exception 'Plan unavailable' using errcode='42501'; end if;
  if current_revision <> p_revision then raise exception 'planner_revision_conflict' using errcode='PT409'; end if;
  delete from public.planner_items where plan_id=p_id and owner_id=owner;
  insert into public.planner_items(id,plan_id,owner_id,position,source_key,source,schedule)
    select (value->>'id')::uuid,p_id,owner,(ordinality-1)::integer,value->'source'->>'key',value->'source',value->'schedule'
    from jsonb_array_elements(p_items) with ordinality;
  update public.planner_plans set settings=p_settings, revision=current_revision+1, updated_at=saved_at
    where id=p_id and owner_id=owner;
  return jsonb_build_object('revision',current_revision+1,'updatedAt',saved_at);
end $$;
revoke all on function public.planner_save(uuid,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.planner_save(uuid,bigint,jsonb,jsonb) to authenticated;
-- One SQL snapshot prevents reading a plan revision and its items from two
-- different concurrent saves. RLS applies to both tables.
create or replace function public.planner_load(p_id uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('plan', p.settings || jsonb_build_object('id',p.id,'items',
    coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'source',i.source,'schedule',i.schedule) order by i.position)
      from public.planner_items i where i.plan_id=p.id),'[]'::jsonb)),
    'revision',p.revision,'dirty',false,'stamp',p.updated_at)
  from public.planner_plans p where p.owner_id=auth.uid() and (p_id is null or p.id=p_id)
  order by p.updated_at desc limit 1;
$$;
revoke all on function public.planner_load(uuid) from public,anon;
grant execute on function public.planner_load(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
