# My Plan Map

`/myplanmap/` uses the existing site frame and embeds `/planner/app.html`.
The home map adds checkboxes beside Explore listings and neighborhood businesses.
Selecting a place never calls ChatRoom, joins a room, changes visibility, or
claims the visitor is at that place. The planner's optional chat button uses the
visitor's physical neighborhood through the existing chat engine.

## Module boundaries

| Module | Owns |
| --- | --- |
| `shared/visit.js` | Page-memory state and navigation between the main map and planner; no browser storage |
| `shared/session.js` | Temporary guest credentials; persistent credentials only for registered accounts |
| `sources.js` | Business/Explore snapshots, stable selection keys, movie occurrences and published timing provenance |
| `model.js` | Pure Austin-time scheduling and validation; no DOM, network, auth, chat, or routes |
| `routing.js` | Async route transport, in-memory cache, estimate provider and navigation links |
| `route-panel.js` | Route controls, travel blocks, arrival-point editing and fitting scheduled visits |
| `repository.js` | Supabase planner RPC names and response validation |
| `store.js` | Guest visit memory; registered-account cache/cloud saves, subscriptions and revision conflicts |
| `select.js` | Main-map Day Plan panel, date picker, planned-day list and Day Planner checkboxes; consumes `austin:planner-target` events |
| `panel.js` | Collapsible itinerary drawer and focus/accessibility state; no plan data |
| `map.js` | Selected-place markers and neighborhood basemap; failure does not disable the itinerary |
| `app.js` | Timeline, preferences, editing, showtime selection, conflict explanations, undo and JSON backup/restore |
| `chat/widget.js` | Optional lazy-loaded ChatRoom/ChatEngine/ChatPanel; planner has no dependency on those modules |

Other applications can load shared/visit, shared/session and the five selection scripts from
`chat/index.html`, then publish:

```js
window.dispatchEvent(new CustomEvent('austin:planner-target', {
  detail: {container: someElement, provider: 'place', data: business}
}));
// provider:'explore' takes a GeoJSON feature instead.
```

Use a sibling container beside a place's button, never a checkbox nested inside
a navigation button. Other source types can add an adapter in sources.js. The
optional chat widget can mount into its own host; load shared/visit.js,
Supabase JS and shared/session.js first. Existing home/tour maps continue using their own chat UI.

## Storage

Applied `supabase/migrations/0002_planner.sql` to project
`aqbyxpiwugcvoephsvpm` on 2026-10-29. Existing PostGIS 3.3.7 is in `public`;
its schema was not moved. `planner_plans` and `planner_items` are new tables,
with owner-only RLS, auth-user cascade cleanup and no references to chat tables.
Locations are generated PostGIS geography points with a GiST index. The base
itinerary works independently of the road network and pgRouting extension.

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
users. Migration `0007` additionally requires a non-anonymous JWT for planner
rows; an anonymous Supabase account alone cannot save or load a plan. Stale revisions return `PT409`,
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

Guest plans, credentials, chat nicknames and visibility stay in `AustinVisit`
page memory. The main map and planner switch their iframe with the History API,
keeping the outer page alive. This preserves the working plan when moving
between them or using Back, without writing selections to localStorage,
sessionStorage, URLs or history state. Refreshing, closing, opening another tab,
or leaving this pair of pages starts a fresh guest visit. BFCache restoration
reloads the page rather than reviving an old guest visit. Display preferences
(theme, Explore filters and navigation-app choice) remain remembered.

Only registered accounts use `austin:planner:v1:<auth-user-id>` and the cloud
repository. Guest code never calls planner_load/planner_save. Old guest caches
and tokens are discarded; `0007_temporary_guests.sql` clears old anonymous
plans, route caches, tour progress, saved messages and chat profile fields while
preserving registered data and unrelated profile columns. Guest route requests
still work, without a persisted per-user route cache. Guest chat is live-only.

An anonymous auth record is still necessary for the protected APIs. Browser
closure cannot reliably trigger server deletion. A scoped hourly cron removes
new guest accounts tagged `austin_guest_visit` after at least 24 hours without
auth-session activity. It excludes registered users and other apps' untagged
guest accounts. This is not a claim that Supabase auth/security logs disappear
immediately on browser closure.

Registered saves retain atomic revisions, conflict resolution and local retry
copies. JSON v2 download/import remains an explicit way for a visitor to keep
their own copy. No email/social login UI is included in this release.

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
- The 20-minute manual travel allowance is used before routing or when a route
  is unavailable. A calculated journey instead uses driving + estimated road
  access + an arrival allowance (10 minutes by default, adjustable per day/stop).
  The old manual allowance is not added to a calculated journey. Up to 60 days
  and 150 total stops can be saved in the collection.

## Routing and navigation

`Plan route` estimates journeys between scheduled stops in chronological order.
It never changes visit times. Once enabled for a day, new endpoint/order/toll
choices refresh estimates; changing arrival times rechecks conflicts against the
static estimates. `Fit travel times` preserves this order and fixed/locked starts,
moving only flexible visits within their availability. Infeasible fits change
nothing and ask the user to shorten, move, or remove a visit. Unscheduled stops
stay unscheduled. This is not stop-order optimization or live navigation.

`daySettings[date].routing` stores `{enabled,avoidTolls,arrivalMinutes}`. Optional
`schedule.arrivalMinutes` overrides the day's allowance. A user-picked
`schedule.routeCoordinates` is the driving entrance; the original source marker
is preserved. Missing locations and uncovered/unreachable destinations retain
the manual allowance and a visible warning; they are never treated as zero time.

Migrations `0004`–`0006` add private `routing` tables and a private `routing_engine`
extension schema. Existing PostGIS stays in `public`. Authenticated sessions
(including anonymous Supabase accounts) can call only `planner_routing_status`
and `planner_route_leg`. The latter validates coordinates, checks coverage,
limits concurrent expensive work to two requests across the project and one
per identity, and rate-limits cache misses. Registered users’ private route caches expire after
7 days and are capped at 200 entries; guest routes are not persisted. New versions invalidate cache keys.

The graph covers the Census Austin urban area plus 10 km. Its estimates use a
static car profile, no live traffic. Conditional prohibitions apply conservatively
all day; unresolved restricted approaches and uncertain barriers are unavailable.
Stops connect to fractions along reachable roads, with a maximum 250 m offset.
Reported road-access minutes are a walking allowance based on that offset, not
a calculated pedestrian route. Use the entrance editor for uncertain connections.

Google Maps, Apple Maps and Waze links open a destination in a new tab/app using
public URL formats, without API keys. Navigation starts from the user's current
location; the planner's exact road path is not forced on the navigation app.
Journeys to the first stop and home afterward are not included automatically.

The build, upload and network checks live in [tools/routing](../tools/routing/README.md).
Chat and parcel tables are unchanged. No recurring rebuild has been scheduled.

## Verification

`node --test tests/planner/*.test.cjs` checks scheduling, DST, locks, impossible
windows, time conflicts, guest reset/navigation, registered persistence, upload races, revision conflicts,
quota failures and account separation. GitHub Actions runs this suite on changes.
Real-browser checks cover selection without joining chat, main-map return,
cross-tab updates, showtimes, mobile sizes, both themes, optional chat, backup/
restore and cloud reconnection. Supabase tests with disposable anonymous users
verified owner isolation, stale-write rollback, generated geography and deletion;
those test users and their data were removed afterward.
