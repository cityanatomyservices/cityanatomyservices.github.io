-- 0001_chat.sql — the austin.chat neighborhood chat's tables, on the paid
-- project (aqbyxpiwugcvoephsvpm), beside the parcel tables it never touches.
-- Written 2026-10-22 from docs/CHAT-PLAN.md §2, §4, §5. Safe to run twice.
-- Applied by Claude through the management API the same day; kept here so
-- the database is reproducible from the repo.

-- ── 1. profiles: the container app's table gains the chat's two columns ──
-- id = the auth user (anonymous or email), handle = the name shown
-- everywhere (unique, case-insensitive), emoji = the avatar.
alter table public.profiles add column if not exists handle text;
alter table public.profiles add column if not exists emoji  text;
create unique index if not exists profiles_handle_unique on public.profiles (lower(handle)) where handle is not null;
-- a signed-in person (anonymous counts) may create and change their own row;
-- "own profile" (select own row) already exists
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ── 2. messages: what was said in each neighborhood room, kept 30 days ──
create table if not exists public.messages (
  id          bigserial primary key,
  room        text        not null,                 -- the geofence id (chat/data/geofences.geojson)
  user_id     uuid        not null references auth.users (id) on delete cascade,
  handle      text        not null,
  emoji       text        not null,
  text        text        not null check (length(text) between 1 and 240),
  created_at  timestamptz not null default now()
);
create index if not exists messages_room_recent on public.messages (room, created_at desc);
alter table public.messages enable row level security;
-- anyone signed in may read a room's recent lines; only write as yourself; delete only your own
drop policy if exists "read messages" on public.messages;
create policy "read messages" on public.messages for select to authenticated using (true);
drop policy if exists "write own messages" on public.messages;
create policy "write own messages" on public.messages for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "delete own messages" on public.messages;
create policy "delete own messages" on public.messages for delete to authenticated using (auth.uid() = user_id);

-- a backstop for the page's one-message-a-second rule: 3 per person per 10 s
create or replace function public.messages_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare recent int;
begin
  select count(*) into recent from public.messages
    where user_id = new.user_id and created_at > now() - interval '10 seconds';
  if recent >= 3 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists messages_rate_limit_trg on public.messages;
create trigger messages_rate_limit_trg before insert on public.messages
  for each row execute function public.messages_rate_limit();

-- every night, forget what is older than 30 days (pg_cron is installed)
select cron.unschedule(jobid) from cron.job where jobname = 'messages_purge_30d';
select cron.schedule('messages_purge_30d', '15 9 * * *', $$delete from public.messages where created_at < now() - interval '30 days'$$);

-- ── 3. tour_progress: a person's record in the walking apps (plan §5) ──
-- written by the tour apps later; a visitor with no account has no rows
create table if not exists public.tour_progress (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  tour        text        not null,                 -- 'moontower', '1885', ...
  stop_id     text        not null,
  visited_at  timestamptz not null default now(),
  primary key (user_id, tour, stop_id)
);
alter table public.tour_progress enable row level security;
drop policy if exists "own progress" on public.tour_progress;
create policy "own progress" on public.tour_progress for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
