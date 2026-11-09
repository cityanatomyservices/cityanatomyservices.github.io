-- Private stop-level notes and Favorites, independent of dated itineraries.
begin;
create table public.special_event_stop_saves (
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null references public.special_events(id) on delete cascade,
  stop_id text not null check (char_length(stop_id) between 1 and 200),
  note text not null default '' check (char_length(note)<=2000),
  favorite boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(owner_id,event_id,stop_id)
);
create index special_event_stop_saves_event on public.special_event_stop_saves(event_id);
alter table public.special_event_stop_saves enable row level security;
create policy special_event_stop_saves_own on public.special_event_stop_saves for select to authenticated
 using (owner_id=(select auth.uid()) and coalesce(auth.jwt()->>'is_anonymous','true')='false'
   and public.planner_scope_active(event_id));
revoke all on public.special_event_stop_saves from public,anon,authenticated;
grant select on public.special_event_stop_saves to authenticated;
grant all on public.special_event_stop_saves to service_role;

create function public.special_event_stops_load(p_event text,p_owner uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('stop_id',stop_id,'note',note,'favorite',favorite) order by stop_id),'[]'::jsonb)
 from public.special_event_stop_saves where event_id=p_event and owner_id=p_owner and p_owner=auth.uid();
$$;

-- Compare the changed field only: a Favorite toggle cannot overwrite a note,
-- and stale notes from another device are rejected instead of silently lost.
create function public.special_event_stop_set(p_event text,p_owner uuid,p_stop text,p_field text,p_value jsonb,p_expected jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare saved public.special_event_stop_saves; current_value jsonb;
begin
 if auth.uid() is null or p_owner is distinct from auth.uid() or coalesce(auth.jwt()->>'is_anonymous','true')<>'false' then
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
revoke all on function public.special_event_stops_load(text,uuid),public.special_event_stop_set(text,uuid,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.special_event_stops_load(text,uuid),public.special_event_stop_set(text,uuid,text,text,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
