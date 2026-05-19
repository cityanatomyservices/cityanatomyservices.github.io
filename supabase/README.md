# Supabase schema

The chat maps use the Supabase project pointed to by
`templates/pubchat/config.js` (project ref `tqnklodtiithbsxxyycp`).

Realtime Broadcast + Presence channels work out of the box with just the
anon key. The two additional features below require running
`migrations/0001_chats_polls.sql` once in the Supabase SQL Editor:

- **30-day rolling chat history** — every message is also inserted into
  `public.chats`. Anonymous clients read the last hour; older history is
  visible only via the service-role key (Supabase Studio).
- **Per-category polls** — votes go into `public.poll_votes`. Aggregated
  results are exposed via the `public.poll_results` view. Poll
  *definitions* are JSON files at `data/<category>/polls.json` — no DB
  roundtrip is needed to add or edit a poll.

A daily `pg_cron` job at 04:00 UTC deletes chat rows older than 30 days
so storage stays well under the free-tier 500 MB cap.

## Applying the migration

1. Open the Supabase Dashboard for the project.
2. SQL Editor → New query.
3. Paste the entire contents of `migrations/0001_chats_polls.sql`.
4. Run. The script is idempotent — re-running is safe.
5. Confirm under Database → Tables that `chats` and `poll_votes` exist
   with RLS enabled, and under Database → Cron that `chats-30d-purge`
   is scheduled.

## Admin-only history reads

The 1-hour public window keeps casual users from scraping the archive.
To inspect older chats, open the SQL Editor (which runs as
`service_role` and bypasses RLS):

```sql
select created_at, room_id, handle, text
  from public.chats
  where created_at > now() - interval '7 days'
  order by created_at desc
  limit 200;
```
