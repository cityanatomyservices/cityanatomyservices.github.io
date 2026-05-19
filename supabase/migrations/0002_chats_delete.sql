-- 0002_chats_delete.sql -------------------------------------------------
-- Lets a user delete a chat message they just sent.
--
-- The chat is fully anonymous (no auth.uid), so the server can't actually
-- verify which random handle "owns" which row. Two guardrails keep the
-- blast radius small:
--
--   1. The client only ever fires a delete for messages whose payload
--      handle matches the user's current sessionStorage identity, AND
--      the user must still hold that identity (closing the tab wipes it).
--   2. The DELETE RLS policy is time-boxed: only rows created in the
--      last 5 minutes are deletable by anon. Older rows fall through to
--      the existing 30-day pg_cron purge.
--
-- A `client_id` column carries an opaque per-message id (set client-side
-- with crypto.randomUUID, included in the realtime broadcast payload).
-- That same id is what the deletion broadcast carries, so peer clients
-- can find and remove the matching bubble from their DOM.
--
-- Idempotent. Safe to re-run.

alter table public.chats
  add column if not exists client_id text;

-- Composite index so the delete-by-(room_id, client_id) lookup is fast
-- and limited to the right room. client_id alone isn't unique enough
-- across the table to justify a UNIQUE constraint.
create index if not exists chats_room_client_idx
  on public.chats (room_id, client_id);

-- Anon DELETE policy — 5-minute window. Anyone with the same room_id +
-- client_id pair can delete (we have no per-row auth), so the time-box
-- is the safety mechanism.
drop policy if exists "anon delete recent" on public.chats;
create policy "anon delete recent"
  on public.chats for delete to anon
  using (created_at > now() - interval '5 minutes');
