-- Separate the main collection from each temporary Special Event. No account,
-- neighborhood, ordinary plan, or routing-network data belongs to an event.
begin;
create table public.special_events (
  id text primary key check (id ~ '^[a-z0-9-]+$' and id <> 'main'),
  title text not null,
  page_path text not null unique check (page_path ~ '^/maps/[a-z0-9-]+/$'),
  dates jsonb not null check (jsonb_typeof(dates)='array' and jsonb_array_length(dates) between 1 and 60),
  closes_at timestamptz not null,
  expires_at timestamptz generated always as ((closes_at at time zone 'UTC' + interval '48 hours') at time zone 'UTC') stored
);
alter table public.special_events enable row level security;
create policy special_events_current on public.special_events for select using (expires_at>now());
revoke all on public.special_events from public,anon,authenticated;
grant select on public.special_events to anon,authenticated;
grant all on public.special_events to service_role;
insert into public.special_events(id,title,page_path,dates,closes_at) values
 ('austin-studio-tour-2026','Austin Studio Tour 2026','/maps/austin-studio-tour/',
 '["2026-11-14","2026-11-15","2026-11-21","2026-11-22"]','2026-11-22T22:00:00-06:00');

alter table public.planner_plans add column scope text not null default 'main';
create function public.planner_source_scope(source jsonb) returns text
language sql immutable set search_path='' as $$
 select case when source->>'key' like 'special-event:%' then split_part(source->>'key',':',2)
   else coalesce(nullif(source->>'eventId',''),'main') end;
$$;
create function public.planner_scope_active(value text) returns boolean
language sql stable security invoker set search_path='' as $$
 select value='main' or exists(select 1 from public.special_events where id=value and expires_at>now());
$$;
revoke all on function public.planner_source_scope(jsonb),public.planner_scope_active(text) from public;
grant execute on function public.planner_source_scope(jsonb),public.planner_scope_active(text) to authenticated,service_role;

-- Move existing saved tour visits atomically, preserving item IDs, notes,
-- times, order and each day's settings. Increment the main revision so an
-- already-open older browser cannot overwrite the split with its old copy.
lock table public.planner_plans,public.planner_items in share row exclusive mode;
do $$
declare original record; event_row record; new_id uuid; selected text; settings jsonb;
begin
 for original in select * from public.planner_plans loop
  for event_row in select distinct e.* from public.special_events e join public.planner_items i
    on public.planner_source_scope(i.source)=e.id where i.plan_id=original.id loop
   new_id:=gen_random_uuid();
   selected:=case when event_row.dates ? (original.settings->>'date') then original.settings->>'date' else event_row.dates->>0 end;
   select coalesce(jsonb_object_agg(d,coalesce(original.settings->'daySettings'->d,jsonb_build_object('name',d,'bufferMinutes',20))),'{}')
     into settings from jsonb_array_elements_text(event_row.dates) as d;
   insert into public.planner_plans(id,owner_id,scope,settings,revision)
     values(new_id,original.owner_id,event_row.id,original.settings || jsonb_build_object('scope',event_row.id,'date',selected,
       'days',event_row.dates,'daySettings',settings,'expiresAt',event_row.expires_at),1);
   update public.planner_items set plan_id=new_id where plan_id=original.id and public.planner_source_scope(source)=event_row.id;
   update public.planner_plans set revision=revision+1,updated_at=now() where id=original.id;
  end loop;
 end loop;
end $$;
-- Reject an unexpected duplicate collection instead of discarding any records.
alter table public.planner_plans add constraint planner_owner_scope unique(owner_id,scope);
create policy planner_active_scope on public.planner_plans as restrictive for all to authenticated
 using(public.planner_scope_active(scope)) with check(public.planner_scope_active(scope));
create policy planner_item_scope on public.planner_items as restrictive for all to authenticated
 using(exists(select 1 from public.planner_plans p where p.id=plan_id and p.scope=public.planner_source_scope(source)))
 with check(exists(select 1 from public.planner_plans p where p.id=plan_id and p.scope=public.planner_source_scope(source)));

create function public.planner_scope_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' and new.scope<>old.scope then raise exception 'A plan cannot change its event'; end if;
 if not public.planner_scope_active(new.scope) then raise exception 'This Special Event has expired' using errcode='PT410'; end if;
 return new;
end $$;
revoke all on function public.planner_scope_guard() from public,anon,authenticated;
create trigger planner_scope_guard before insert or update on public.planner_plans for each row execute function public.planner_scope_guard();

create function public.planner_load_scoped(p_scope text,p_id uuid default null)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('plan',p.settings || jsonb_build_object('id',p.id,'scope',p.scope,
   'expiresAt',(select expires_at from public.special_events where id=p.scope),'items',
   coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'source',i.source,'schedule',i.schedule,'day',to_char(i.plan_day,'YYYY-MM-DD')) order by i.position)
     from public.planner_items i where i.plan_id=p.id),'[]'::jsonb)),
   'revision',p.revision,'dirty',false,'stamp',p.updated_at)
 from public.planner_plans p where p.owner_id=auth.uid() and p.scope=p_scope
   and public.planner_scope_active(p.scope) limit 1;
$$;
-- p_id is retained for compatibility; owner + scope identify the collection,
-- including recovery when two devices first create a plan at the same time.
create function public.planner_save_scoped(p_scope text,p_id uuid,p_revision bigint,p_settings jsonb,p_items jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare owner uuid:=auth.uid(); current_revision bigint; saved_at timestamptz:=now(); event_dates jsonb;
begin
 if owner is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if not public.planner_scope_active(p_scope) then raise exception 'This Special Event has expired' using errcode='PT410'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>150 then raise exception 'A plan can contain up to 150 stops'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) i where public.planner_source_scope(i->'source')<>p_scope
   or coalesce(i->'source'->>'eventId',p_scope)<>p_scope) then
   raise exception 'Open this Special Event to edit its separate plan' using errcode='PT422'; end if;
 if p_scope<>'main' then
   select dates into event_dates from public.special_events where id=p_scope;
   if not(event_dates ? (p_settings->>'date')) or exists(select 1 from jsonb_array_elements(p_items) i where not(event_dates ? coalesce(i->>'day',p_settings->>'date'))) then
     raise exception 'Choose a day in this Special Event'; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(owner::text||':'||p_scope,3816));
 if exists(select 1 from public.planner_plans where owner_id=owner and scope=p_scope and id<>p_id) then
   raise exception 'planner_revision_conflict' using errcode='PT409'; end if;
 insert into public.planner_plans(id,owner_id,scope,settings) values(p_id,owner,p_scope,p_settings||jsonb_build_object('scope',p_scope)) on conflict(id) do nothing;
 select revision into current_revision from public.planner_plans where id=p_id and owner_id=owner and scope=p_scope for update;
 if current_revision is null then raise exception 'Plan unavailable' using errcode='42501'; end if;
 if current_revision<>p_revision then raise exception 'planner_revision_conflict' using errcode='PT409'; end if;
 delete from public.planner_items where plan_id=p_id and owner_id=owner;
 insert into public.planner_items(id,plan_id,owner_id,position,source_key,source,schedule,plan_day)
  select (value->>'id')::uuid,p_id,owner,(ordinality-1)::integer,value->'source'->>'key',value->'source',value->'schedule',coalesce(value->>'day',p_settings->>'date')::date
  from jsonb_array_elements(p_items) with ordinality;
 update public.planner_plans set settings=p_settings||jsonb_build_object('scope',p_scope),revision=current_revision+1,updated_at=saved_at where id=p_id and owner_id=owner;
 return jsonb_build_object('revision',current_revision+1,'updatedAt',saved_at);
end $$;
-- Legacy clients can access only the main scope. Mixed old saves are rejected
-- atomically; no saved event data can leak back into the main collection.
create or replace function public.planner_load(p_id uuid default null) returns jsonb
 language sql stable security invoker set search_path='' as $$select public.planner_load_scoped('main',p_id);$$;
create or replace function public.planner_save(p_id uuid,p_revision bigint,p_settings jsonb,p_items jsonb) returns jsonb
 language sql security invoker set search_path='' as $$select public.planner_save_scoped('main',p_id,p_revision,p_settings,p_items);$$;
revoke all on function public.planner_load_scoped(text,uuid),public.planner_save_scoped(text,uuid,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.planner_load_scoped(text,uuid),public.planner_save_scoped(text,uuid,bigint,jsonb,jsonb) to authenticated;

-- Event chat is live Presence/Broadcast, never durable message history.
create policy special_event_live_chat_only on public.messages as restrictive for insert to authenticated
 with check(room not like 'event-%');
create function public.special_events_cleanup() returns void language plpgsql security definer set search_path='' as $$
declare e record;
begin
 for e in select * from public.special_events where expires_at<=now() for update loop
  delete from public.planner_plans where scope=e.id;
  delete from public.member_favorites where public.planner_source_scope(source)=e.id or source_key='app:'||e.page_path;
  delete from public.event_reminders where public.planner_source_scope(event)=e.id;
  delete from public.messages where starts_with(room,'event-'||e.id||'-stop-');
  delete from public.tour_progress where tour=e.id;
  delete from public.special_events where id=e.id;
 end loop;
end $$;
revoke all on function public.special_events_cleanup() from public,anon,authenticated;
grant execute on function public.special_events_cleanup() to service_role;
select cron.schedule('austin_special_event_cleanup','* * * * *','select public.special_events_cleanup()');
notify pgrst,'reload schema';
commit;
