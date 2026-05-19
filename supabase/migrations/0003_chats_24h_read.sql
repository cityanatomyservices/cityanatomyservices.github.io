-- 0003_chats_24h_read.sql -----------------------------------------------
-- Widens the anon SELECT window on chats from 1 hour to 24 hours. The
-- 30-day pg_cron purge in 0001 is unchanged, so admins (service_role)
-- still see the full 30-day rolling window for review.
--
-- The 5-minute anon DELETE window from 0002 is also unchanged — users
-- can only delete their own messages immediately after sending. Older
-- messages remain readable for the rest of the 24-hour window.
--
-- Idempotent. Safe to re-run.

drop policy if exists "anon read last hour"  on public.chats;
drop policy if exists "anon read last 24h"   on public.chats;
create policy "anon read last 24h"
  on public.chats for select to anon
  using (created_at > now() - interval '24 hours');
