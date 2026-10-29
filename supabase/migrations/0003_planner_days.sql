-- One selected day at a time; several dated itineraries in one private plan.
-- Existing snapshots and IDs remain intact. The v2 client groups legacy stops
-- by their scheduled Austin day (5 AM boundary) before its first atomic save.
begin;
alter table public.planner_items add column if not exists plan_day date;
update public.planner_items i set plan_day=(p.settings->>'date')::date
  from public.planner_plans p where i.plan_id=p.id and i.plan_day is null;
alter table public.planner_items alter column plan_day set not null;
alter table public.planner_items drop constraint if exists planner_items_plan_id_source_key_key;
-- Idempotent when reapplied; a business can appear once on EACH saved day.
alter table public.planner_items drop constraint if exists planner_items_day_source_key;
alter table public.planner_items add constraint planner_items_day_source_key unique(plan_id,plan_day,source_key);
create index if not exists planner_items_day on public.planner_items(plan_id,plan_day,position);
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
  insert into public.planner_items(id,plan_id,owner_id,position,source_key,source,schedule,plan_day)
    select (value->>'id')::uuid,p_id,owner,(ordinality-1)::integer,value->'source'->>'key',value->'source',value->'schedule',coalesce(value->>'day',p_settings->>'date')::date
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
    coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'source',i.source,'schedule',i.schedule,'day',to_char(i.plan_day,'YYYY-MM-DD')) order by i.position)
      from public.planner_items i where i.plan_id=p.id),'[]'::jsonb)),
    'revision',p.revision,'dirty',false,'stamp',p.updated_at)
  from public.planner_plans p where p.owner_id=auth.uid() and (p_id is null or p.id=p_id)
  order by p.updated_at desc limit 1;
$$;
revoke all on function public.planner_load(uuid) from public,anon;
grant execute on function public.planner_load(uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
