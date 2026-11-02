-- Email reminders are private. Only authenticated Edge functions may enroll
-- events, so a browser cannot choose a recipient, message, or delivery time.
begin;
create table if not exists public.event_reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null check(length(event_key)<=500),
  event jsonb not null check(jsonb_typeof(event)='object' and octet_length(event::text)<16000),
  starts_at timestamptz not null,
  enabled boolean not null default true,
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique(owner_id,event_key)
);
create index if not exists event_reminders_owner on public.event_reminders(owner_id,starts_at);
create table if not exists public.event_reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.event_reminders(id) on delete cascade,
  lead_hours integer not null check(lead_hours in (24,2)),
  due_at timestamptz not null,
  state text not null default 'pending' check(state in ('pending','processing','sent','cancelled','skipped','failed')),
  attempts integer not null default 0,
  lease_until timestamptz,
  payload jsonb,
  provider_id text,
  result text,
  sent_at timestamptz,
  unique(reminder_id,lead_hours)
);
create index if not exists event_reminder_jobs_due on public.event_reminder_jobs(due_at) where state in ('pending','processing');
alter table public.event_reminders enable row level security;
alter table public.event_reminder_jobs enable row level security;
revoke all on public.event_reminders,public.event_reminder_jobs from anon,authenticated;
grant all on public.event_reminders,public.event_reminder_jobs to service_role;

create or replace function public.reminder_enroll(p_owner uuid,p_event jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid; begins timestamptz; h integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,10));
  if not exists(select 1 from auth.users where id=p_owner and not is_anonymous and email_confirmed_at is not null and deleted_at is null) then
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

create or replace function public.reminder_cancel(p_owner uuid,p_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text,10));
  update public.event_reminders set enabled=false where owner_id=p_owner and (p_id is null or id=p_id);
  update public.event_reminder_jobs j set state='cancelled',result='Cancelled by user'
  from public.event_reminders r where j.reminder_id=r.id and r.owner_id=p_owner and (p_id is null or r.id=p_id) and j.state in ('pending','processing');
end $$;

create or replace function public.reminder_claim() returns setof public.event_reminder_jobs
language plpgsql security definer set search_path='' as $$
begin
  -- Retention: no email addresses or message copies remain beyond 30 days.
  delete from public.event_reminders where starts_at<now()-interval '30 days';
  update public.event_reminder_jobs set state='skipped',result='Delivery window passed'
    where state in ('pending','processing') and due_at<now()-interval '15 minutes';
  return query
    with selected as (
      select j.id from public.event_reminder_jobs j join public.event_reminders r on r.id=j.reminder_id
      where r.enabled and r.starts_at>now() and j.due_at<=now() and j.attempts<5 and
        (j.state='pending' or (j.state='processing' and j.lease_until<now()))
      order by j.due_at for update of j skip locked limit 25
    ) update public.event_reminder_jobs j set state='processing',attempts=attempts+1,lease_until=now()+interval '5 minutes'
      from selected s where j.id=s.id returning j.*;
end $$;

revoke all on function public.reminder_enroll(uuid,jsonb),public.reminder_cancel(uuid,uuid),public.reminder_claim() from public,anon,authenticated;
grant execute on function public.reminder_enroll(uuid,jsonb),public.reminder_cancel(uuid,uuid),public.reminder_claim() to service_role;
commit;
