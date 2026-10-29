# My Plan Map

`/myplanmap/` uses the existing site frame and embeds `/planner/app.html`.
The home map adds checkboxes beside Explore listings and neighborhood businesses.
Selecting a place never calls ChatRoom, joins a room, changes visibility, or
claims the visitor is at that place. The planner's optional chat button uses the
visitor's physical neighborhood through the existing chat engine.

## Module boundaries

| Module | Owns |
| --- | --- |
| `shared/session.js` | One persisted anonymous Supabase identity across same-origin applications; no profiles, tables, chat or geolocation |
| `sources.js` | Business/Explore snapshots, stable selection keys, movie occurrences and published timing provenance |
| `model.js` | Pure Austin-time scheduling and validation; no DOM, network, auth, chat, or routes |
| `routing.js` | Provider contract; currently only user-entered buffer minutes |
| `repository.js` | Supabase planner RPC names and response validation |
| `store.js` | Private browser cache, subscriptions, account boundary, atomic saves and explicit revision conflicts |
| `select.js` | Main-map checkboxes and count; consumes `austin:planner-target` events |
| `map.js` | Selected-place markers and neighborhood basemap; failure does not disable the itinerary |
| `app.js` | Timeline, preferences, editing, showtime selection, conflict explanations, undo and JSON backup/restore |
| `chat/widget.js` | Optional lazy-loaded ChatRoom/ChatEngine/ChatPanel; planner has no dependency on those modules |

Other applications can load shared/session and the five selection scripts from
`chat/index.html`, then publish:

```js
window.dispatchEvent(new CustomEvent('austin:planner-target', {
  detail: {container: someElement, provider: 'place', data: business}
}));
// provider:'explore' takes a GeoJSON feature instead.
```

Use a sibling container beside a place's button, never a checkbox nested inside
a navigation button. Other source types can add an adapter in sources.js. The
optional chat widget can mount into its own host; load shared/session.js and
Supabase JS first. Existing home/tour maps continue using their own chat UI.

## Storage

Applied `supabase/migrations/0002_planner.sql` to project
`aqbyxpiwugcvoephsvpm` on 2026-10-29. Existing PostGIS 3.3.7 is in `public`;
its schema was not moved. `planner_plans` and `planner_items` are new tables,
with owner-only RLS, auth-user cascade cleanup and no references to chat tables.
Locations are generated PostGIS geography points with a GiST index. No road
network or pgRouting extension is required for this release.

`0003_planner_days.sql` (also applied 2026-10-29) adds `planner_items.plan_day`
and changes source uniqueness to `(plan_id, plan_day, source_key)`. The same
business can be saved independently on different days. Older clients can still
save: the RPC uses the plan's date when an item has no explicit day. The v2
client upgrades older snapshots before saving, preserving IDs, source data,
notes and locked times; existing stops are grouped by their scheduled day
(published day for fixed events), with the 5 AM boundary.

`planner_load` reads settings, revision and ordered items in one SQL snapshot.
`planner_save` atomically writes the plan and items under a row lock with a
revision check. Both RPCs are SECURITY INVOKER and restricted to authenticated
users; Supabase anonymous users have that role. Stale revisions return `PT409`,
not SQLSTATE 40001: [Supabase documents that 40001 triggers PostgREST retries](https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions).
Each identity has a collection of dated itineraries, with one selected day at
a time. Settings contain `schemaVersion:2`, `days`, `daySettings` (name and buffer
per day), and `date` (selected day). Item snapshots carry `day`. The collection
still saves in one atomic transaction and shares no state with chat.

`PlanStore.plan` returns only the selected day's settings and stops;
`PlanStore.book` returns the full collection for backup/restore. `edit` merges
only the selected day; `chooseDay` switches or adds a day. An expected-day guard
prevents a stale editor from writing into another selected day. `build` and
`check` also ignore other days if called with a full collection.

Browser keys are `austin:planner:v1:<auth-user-id>` (or `guest` when initial auth
is unavailable). Pending edits survive failed requests. Web Locks serialize
same-browser writes and uploads where supported; `storage` events update other
tabs. Revision conflicts never silently overwrite another saved copy. A local
copy can explicitly replace the remote version, or the user can load the saved
copy. JSON v2 download/import includes every saved day, and imports of v1 files
are upgraded without losing selections. The old browser-key prefix is retained
so existing visitors recover their data. There is
no email/social sign-in UI yet; the anonymous session belongs to this browser.

## Scheduling semantics and current limits

- Fixed published starts and selected movie showtimes are reserved first. A
  locked arrival is never moved automatically. Flexible visits fill remaining
  gaps in the user's preferred order. This is a deterministic greedy scheduler,
  not an exhaustive optimizer; an item that does not fit stays unscheduled.
- The default view is chronological; Preferred order controls flexible-stop
  priority. Map numbers follow the chosen view.
- Every plan day starts at 5 AM Austin time and ends at 5 AM the next calendar
  date (displayed as 5:00 AM–4:59 AM). Arrival and availability inputs accept
  times only. Times before 5 AM resolve to the following morning; a 5 AM
  availability closing means the upper boundary. A visit crossing that boundary
  is flagged. This is 24 hours on ordinary days, 23/25 elapsed hours at DST, so
  the local 5 AM boundary remains consistent.
- The main map has a planning-day picker for flexible places. Fixed events
  select/create their actual plan day rather than moving published dates.
  Movies retain only showtime choices within the selected day; movie listings
  spanning the boundary can be saved to either applicable day.
- Availability windows restrict a full visit, including overnight hours. No
  stop-level date controls or editable day boundaries are presented.
- Expiry timestamps are never used as unknown event/movie finish times. Movie
  runtime, when published, is an initial duration estimate; trailers and early
  arrival are not silently invented. Users choose an actual showtime.
- All-day/curated offers supply date bounds, not confirmed operating hours.
  Raw OSM opening-hour expressions are preserved by the weekly directory build
  and shown for review. They are deliberately not parsed as simple hours:
  [OSM expressions include holidays, exceptions and seasonal conditions](https://wiki.openstreetmap.org/wiki/Key:opening_hours/specification).
  Users enter a confirmed window for this visit; unknown hours/durations remain
  visible. Source snapshots and URLs survive feed expiry, but cancellation and
  source changes require checking the source. Saving is not a booking.
- The `America/Chicago` clock is independent of device timezone. Nonexistent
  spring-forward inputs are rejected; repeated fall-back inputs choose the
  earlier occurrence and show a notice. Source timestamps retain their offsets.
- The 20-minute default travel buffer is a user allowance, not a calculated
  journey duration. Each stop can override its incoming buffer. No road routes
  or straight-line route claims are displayed. Up to 60 days and 150 total stops
  in the collection. Each day has its own adjustable travel buffer.

## Incremental routing

Keep street graph tables and import jobs separate from planner/chat. An adapter
can later use PostGIS snapping and pgRouting on prepared edges/nodes, and return
`{status:'ready', minutes, distanceMeters, geometry, mode, networkVersion,
calculatedAt}` from `leg(before, after, plan)`. Model scheduling only consumes
minutes. Fetch route data outside the pure model and cache by endpoint/mode/
network version. A missing leg must remain manual/unknown rather than zero.
Then render geometry in map.js and add routing controls in their own UI module.
Network coverage can expand incrementally while uncovered stops retain manual
buffers. The chat modules need no changes for that work.

## Verification

`node --test tests/planner/*.test.cjs` checks scheduling, DST, locks, impossible
windows, time conflicts, guest persistence, upload races, revision conflicts,
quota failures and account separation. GitHub Actions runs this suite on changes.
Real-browser checks cover selection without joining chat, main-map return,
cross-tab updates, showtimes, mobile sizes, both themes, optional chat, backup/
restore and cloud reconnection. Supabase tests with disposable anonymous users
verified owner isolation, stale-write rollback, generated geography and deletion;
those test users and their data were removed afterward.
