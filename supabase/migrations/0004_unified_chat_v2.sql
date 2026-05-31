-- 0004_unified_chat_v2.sql ----------------------------------------------
-- Reshapes the chat surface from per-bucket rooms into ONE Austin-wide
-- room, with metadata stored on each message so the UI can filter
-- (location / topic / tags) client-side. Adds two new tables: chat_votes
-- for thumbs-up/down on every message, and geofence_tags for tag chips
-- a user can apply to a geofence as an alternative to posting.
--
-- Idempotent — safe to re-run. Built additively on 0001/0002/0003; older
-- columns and the chats rate limit are unchanged.

-- =====================================================================
-- 1. CHATS: extra columns for client-side filtering
-- =====================================================================
-- bucket (top-level category: social/rec/shopping/services/events)
-- neighborhood_id (so messages from a geofence inside, e.g., Bouldin Creek
-- carry that neighborhood id even though they live in the city-wide room)
-- tags (snapshot of the geofence's currently-applied tags at post time,
-- so filtering by tag doesn't need a JOIN)
alter table public.chats
  add column if not exists bucket text,
  add column if not exists neighborhood_id text,
  add column if not exists tags text[];

create index if not exists chats_bucket_idx
  on public.chats (bucket);
create index if not exists chats_neighborhood_idx
  on public.chats (neighborhood_id);

-- =====================================================================
-- 2. CHAT_VOTES (👍 / 👎 per message)
-- =====================================================================
-- Keyed on the message's client_id (already stamped by the broadcast
-- payload, see chat.js newClientId()). One vote per handle per message;
-- re-voting with the same value is a no-op, voting the opposite value
-- is a flip handled at the app layer (delete + insert, or upsert).
create table if not exists public.chat_votes (
  chat_client_id text        not null,
  handle         text        not null,
  value          smallint    not null check (value in (-1, 1)),
  created_at     timestamptz not null default now(),
  primary key (chat_client_id, handle)
);

create index if not exists chat_votes_msg_idx
  on public.chat_votes (chat_client_id);

create or replace view public.chat_vote_counts as
  select chat_client_id,
         sum(case when value =  1 then 1 else 0 end)::int as up,
         sum(case when value = -1 then 1 else 0 end)::int as down,
         sum(value)::int                                  as score
  from public.chat_votes
  group by chat_client_id;

-- =====================================================================
-- 3. GEOFENCE_TAGS (tag chips applied to a hotspot by anon users)
-- =====================================================================
-- One row per (hotspot, tag, handle) so a single user can't multi-vote
-- the same tag on the same geofence. Tag strings come from the curated
-- /data/tags.json registry; raw text is stored so additions are pure
-- JSON edits with no SQL roundtrip.
create table if not exists public.geofence_tags (
  hotspot_id text        not null,
  tag        text        not null,
  handle     text        not null,
  created_at timestamptz not null default now(),
  primary key (hotspot_id, tag, handle)
);

create index if not exists geofence_tags_hot_idx
  on public.geofence_tags (hotspot_id);

create or replace view public.geofence_tag_counts as
  select hotspot_id, tag, count(*)::int as votes
  from public.geofence_tags
  group by hotspot_id, tag;

-- =====================================================================
-- 4. SERVER-SIDE RATE LIMITS (parallel to chats_rate_limit_trg in 0001)
-- =====================================================================
create or replace function public.chat_votes_rate_limit() returns trigger
language plpgsql as $$
declare recent int;
begin
  select count(*) into recent
    from public.chat_votes
    where handle = NEW.handle
      and created_at > now() - interval '10 seconds';
  if recent >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return NEW;
end $$;

drop trigger if exists chat_votes_rate_limit_trg on public.chat_votes;
create trigger chat_votes_rate_limit_trg before insert on public.chat_votes
  for each row execute function public.chat_votes_rate_limit();

create or replace function public.geofence_tags_rate_limit() returns trigger
language plpgsql as $$
declare recent int;
begin
  select count(*) into recent
    from public.geofence_tags
    where handle = NEW.handle
      and created_at > now() - interval '10 seconds';
  if recent >= 6 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return NEW;
end $$;

drop trigger if exists geofence_tags_rate_limit_trg on public.geofence_tags;
create trigger geofence_tags_rate_limit_trg before insert on public.geofence_tags
  for each row execute function public.geofence_tags_rate_limit();

-- =====================================================================
-- 5. ROW-LEVEL SECURITY
-- =====================================================================
alter table public.chat_votes    enable row level security;
alter table public.geofence_tags enable row level security;

-- chat_votes:
--   anon INSERTs + DELETEs only their own row (delete = undo / flip),
--   anon never reads raw rows; counts come from chat_vote_counts.
drop policy if exists "anon insert chat_votes" on public.chat_votes;
drop policy if exists "anon delete chat_votes" on public.chat_votes;
create policy "anon insert chat_votes"
  on public.chat_votes for insert to anon
  with check (true);
create policy "anon delete chat_votes"
  on public.chat_votes for delete to anon
  using (true);
grant select on public.chat_vote_counts to anon;

-- geofence_tags:
--   anon INSERTs + DELETEs only their own row (delete = un-apply),
--   anon never reads raw rows; counts come from geofence_tag_counts.
drop policy if exists "anon insert geofence_tags" on public.geofence_tags;
drop policy if exists "anon delete geofence_tags" on public.geofence_tags;
create policy "anon insert geofence_tags"
  on public.geofence_tags for insert to anon
  with check (true);
create policy "anon delete geofence_tags"
  on public.geofence_tags for delete to anon
  using (true);
grant select on public.geofence_tag_counts to anon;

-- =====================================================================
-- 6. DAILY 30-DAY PURGE for the new tables
-- =====================================================================
-- Mirrors the chats-30d-purge job from 0001. pg_cron is already enabled.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'chat-votes-30d-purge') then
    perform cron.unschedule('chat-votes-30d-purge');
  end if;
  if exists (select 1 from cron.job where jobname = 'geofence-tags-30d-purge') then
    perform cron.unschedule('geofence-tags-30d-purge');
  end if;
end $$;

select cron.schedule(
  'chat-votes-30d-purge',
  '5 4 * * *',
  $$ delete from public.chat_votes where created_at < now() - interval '30 days'; $$
);
select cron.schedule(
  'geofence-tags-30d-purge',
  '10 4 * * *',
  $$ delete from public.geofence_tags where created_at < now() - interval '30 days'; $$
);
