-- 0001_chats_polls.sql ---------------------------------------------------
-- Adds two features to the existing Supabase project that today only hosts
-- Realtime Broadcast + Presence (no DB writes): persistent chat history
-- (30-day rolling) and per-category polls. Idempotent — safe to re-run.
--
-- The polls *definitions* live in /data/<category>/polls.json in the
-- repo; only votes are stored in the database. That keeps poll authoring
-- a pure JSON edit with no SQL roundtrip.
--
-- Run once via the Supabase SQL Editor on the project pointed to by
-- templates/pubchat/config.js (tqnklodtiithbsxxyycp).

-- =====================================================================
-- 1. CHATS TABLE (30-day rolling chat history)
-- =====================================================================
create table if not exists public.chats (
  id            bigserial primary key,
  room_id       text        not null,   -- "<app>:atx:<hotspot_id>"
  app           text        not null,   -- "pubchat", "ymcas", ...
  hotspot_id    text        not null,
  handle        text        not null,
  emoji         text        not null,
  home_hotspot  text,                   -- null when sender has no home geofence
  home_title    text,
  text          text        not null check (length(text) between 1 and 240),
  vibe          text,
  created_at    timestamptz not null default now()
);

create index if not exists chats_room_recent_idx
  on public.chats (room_id, created_at desc);

-- =====================================================================
-- 2. POLL VOTES (one row per user vote; aggregate via the view below)
-- =====================================================================
-- poll_id is free text, matched against polls.json client-side. No FK so
-- adding/removing polls is a pure data-file change.
create table if not exists public.poll_votes (
  poll_id      text        not null,
  room_id      text        not null,   -- vote is scoped to a specific hotspot
  handle       text        not null,
  option_index int         not null,
  created_at   timestamptz not null default now(),
  primary key (poll_id, room_id, handle)  -- one vote per user per hotspot
);

create index if not exists poll_votes_room_idx
  on public.poll_votes (room_id, poll_id);

-- =====================================================================
-- 3. AGGREGATED RESULTS VIEW (the only thing anon reads for vote counts)
-- =====================================================================
create or replace view public.poll_results as
  select poll_id, room_id, option_index, count(*)::int as votes
  from public.poll_votes
  group by poll_id, room_id, option_index;

-- =====================================================================
-- 4. SERVER-SIDE RATE LIMIT on chats INSERT
-- =====================================================================
-- Backstop for the client-side MIN_SEND_INTERVAL_MS guard so a tampered
-- client can't flood the table. 3 inserts per handle per 10 s.
create or replace function public.chats_rate_limit() returns trigger
language plpgsql as $$
declare recent int;
begin
  select count(*) into recent
    from public.chats
    where handle = NEW.handle
      and created_at > now() - interval '10 seconds';
  if recent >= 3 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return NEW;
end $$;

drop trigger if exists chats_rate_limit_trg on public.chats;
create trigger chats_rate_limit_trg before insert on public.chats
  for each row execute function public.chats_rate_limit();

-- =====================================================================
-- 5. ROW-LEVEL SECURITY
-- =====================================================================
alter table public.chats      enable row level security;
alter table public.poll_votes enable row level security;

-- chats:
--   anon can INSERT (subject to the rate-limit trigger)
--   anon can SELECT only rows from the last 1 hour
--   older rows are admin-only (service_role bypasses RLS automatically)
drop policy if exists "anon insert chats"    on public.chats;
drop policy if exists "anon read last hour"  on public.chats;
create policy "anon insert chats"
  on public.chats for insert to anon
  with check (true);
create policy "anon read last hour"
  on public.chats for select to anon
  using (created_at > now() - interval '1 hour');

-- poll_votes:
--   anon can INSERT but never SELECT raw rows
--   anon reads vote totals only via the poll_results view
drop policy if exists "anon insert votes" on public.poll_votes;
create policy "anon insert votes"
  on public.poll_votes for insert to anon
  with check (true);

-- The view inherits RLS from its base table. SECURITY DEFINER would be
-- one workaround; simpler is granting select on the view to anon and
-- relying on the aggregation to strip identifying info.
grant select on public.poll_results to anon;

-- =====================================================================
-- 6. DAILY 30-DAY PURGE (pg_cron is included on the free tier)
-- =====================================================================
create extension if not exists pg_cron with schema extensions;

-- cron.schedule errors if the job already exists; unschedule-first makes
-- this idempotent.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'chats-30d-purge') then
    perform cron.unschedule('chats-30d-purge');
  end if;
end $$;

select cron.schedule(
  'chats-30d-purge',
  '0 4 * * *',                                  -- 04:00 UTC every day
  $$ delete from public.chats where created_at < now() - interval '30 days'; $$
);
