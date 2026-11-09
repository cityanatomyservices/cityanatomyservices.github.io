# Special Events maps

The first map is `/maps/austin-studio-tour/`, linked from the main map's
Explore → Special Events card. It is available to guests and Free/Pro members.
`home.json` owns the catalog entry (`category: "Special Events"`).

The iframe uses `/special-events/map.html?event=austin-studio-tour-2026`.
This generated page reuses the main MapLibre engine and complete planner,
routing and export UI. It has Stops, Plan and Chat controls, plus the same
GPS, map layers, 3D and satellite controls. It has no Explore button. The tour
panel is a left-side drawer with an always-available arrow handle; Stops opens
the same drawer. Opening Plan or Chat closes it.
Run `node tools/special-events/make-map.cjs` after changing `chat/index.html`
or its shared asset versions. Do not hand-edit `map.html`.

## Event backgrounds

An event can set `"basemap": "stamen-watercolor"` in its GeoJSON metadata.
The Studio Tour uses this art theme by default; an event without that setting
keeps the shared street map. Future themes belong in `basemap.js`, selected
by event metadata, rather than in the shared map engine.

**Map layers → Background → Map style** switches between Watercolor and
Street map without moving the camera or changing stops, geofences or plans.
Satellite temporarily covers either background and restores the selection
when turned off; 3D buildings remain available. A failed watercolor request
automatically restores the street base and offers a retry through the selector.

The painting is historic Stamen artwork from 2012–2014, with current
OpenFreeMap street/place labels above it. As the visitor zooms closer to a stop,
the painting fades to reveal current streets and buildings underneath. The
historic artwork is not a current street survey.
The owner chose an Austin copy hosted with the site, with no new subscription.
The [tile README](tiles/stamen-watercolor-austin/README.md) records the museum
source, Creative Commons licenses, bounded coverage and reproducible download.
The map displays the required attribution. Other event areas need coverage
before enabling this Austin-specific background.

## Event data

Each event has a GeoJSON FeatureCollection in `data/<event-id>.geojson`.
It declares its title, dates, Austin-time hours and UTC offset, source links,
checked timestamp, map bounds and stop features. Stops have stable IDs,
organizer numbers, titles, addresses, categories, coordinates and official URLs.
Optional `dates`, `hours`, `start` and `end` support restricted attendance or
fixed performances. A fixed performance must have a matching `dates` entry.
Each stop's `chatBoundary` supplies a Polygon/MultiPolygon. Event bounds only
control the map extent; they never grant access to event chat. Bounds must
include every stop. Model validation rejects missing chat boundaries.
Configure the offset for the event dates; split occurrences across different
DST offsets into explicit timestamps. The base planner handles Austin DST.

Stops creates one flexible source per stop and chosen event date. The planner
keeps the existing personal day collection: an event day may also include
nearby businesses and other plans. Visit durations remain unconfirmed until
the visitor edits them. Exports retain source URLs and attendance caveats.
No artist's attendance on every tour day is inferred from its location pin.

## Dates, filters and opening hours

The date selector now shows only stops with published opening windows on that
day. **Time & availability** adds an optional visit window, an all-event-hours
option and an explicit option to include schedules needing confirmation.
Missing days, missing endpoints and suspicious time ranges are never filled
with the tour's general 11 AM–5 PM hours. Times before 5 AM in the visitor's
time filter mean the following morning, matching the planner's day boundary.
Published evening/overnight openings are retained.

**More filters** uses the organizer's Explore choices: art mediums, activities,
overall vibe, accessibility, communities highlighted, indoor/outdoor,
artists/groups/hosts and family-friendly content. The owner explicitly removed
venue/location type. Search covers names, addresses and exact stop numbers.
Multiple choices within a group are alternatives; accessibility requires all
selected features. Groups are combined against the **same participant on the
selected day**, not against unrelated artists sharing a building. Dates and
hours stay attached to the correct location for participants who move.

Rows/popups show the matching participants and visit hours. Selected filters,
participants, day and intersected time windows are copied into the planner
source and calendar descriptions. The scheduler and travel fitting preserve
separate opening windows and never fill a closed gap. A visit must fit entirely
within one window. Unknown event hours require a confirmed manual availability
window before automatic scheduling/calendar export. Invalid scheduled event
visits are excluded from calendar and route exports, with an explanation.

Changing discovery filters keeps existing planned visits. **Update planned
visit** applies new choices to an already selected stop, retaining notes and
locked arrivals and clearing an unlocked arrival for rebuilding. When a saved
day opens, older event source snapshots refresh against this dataset; visits
and user edits remain, and unavailable/out-of-hours visits are flagged. This
also repairs plans previously saved with uniform hours for every stop.

`filters` declares each group and its public choices. Each profile has
`facets` and `availability: {status, days, text}`; a published day's value is
an array of `{open, close, nextDay?}` windows. An empty array means the day was
listed without usable hours. `status: "unknown"` means no schedule is published.
`availabilityChecked` versions these source snapshots. Future event datasets
can use the same format and controls. Legacy event-wide or per-stop hours
remain supported for events without participant schedules.

The complete 307-zone GPS/chat collection is unchanged. Discovery outlines
follow the visible results; planning filters do not change chat membership.

## Austin Studio Tour 2026 source snapshot

- Dates/hours: [organizer homepage](https://atxstudiotour.com/), November
  14–15 and 21–22, 11 AM–5 PM, 2026. The Explore page's SEO title still
  displays 2025 dates and is not used for scheduling.
- 307 coordinates and location numbers come from the organizer's public
  [map](https://atxstudiotour.com/explore/?view=map), matched by post ID to its
  public WordPress location records and each location's displayed address.
- The fully loaded [participant index](https://atxstudiotour.com/index/)
  supplies names/profile links for 303 of those stops. Four stops without
  numbered index participants use their published street address as the title.
  Unnumbered index entries are not assigned guessed coordinates.
- The map feed has 307 locations although the event publicity mentions 309.
  We retain the published map's actual stops without fabricating missing pins.
  Original organizer coordinates are preserved to seven decimals; the source
  applies small offsets to separate nearby pins. Confirm entrances on arrival.
- The bounding rectangle is the stop envelope with 0.002° padding. It is the
  event map extent, not chat coverage or an official event boundary.
- On November 9, the organizer's public profile pages and
  [Explore filters](https://atxstudiotour.com/explore/) supplied 811
  participant/location associations from 789 distinct profiles across all
  307 stops. The public API contains 813 profiles; profiles with no published
  location or established index link are not assigned a guessed stop.
  115 associations have no published schedule and 14 have at least one
  incomplete/invalid day. The original index preserves known locations when
  the profile's Location/Open sections are empty, without inventing hours.
  Four previously unnamed stops now have linked profile information.
- Default date results with usable published hours are 258, 256, 250 and 249
  stops, respectively. General tour hours are not used to override individual
  schedules. Raw pages are retained only in the external source cache.

To refresh, save `explore.html`, extracted `markers.json`, public
`location-records.json`, each `<post-id>.html` and a `participants.json`
mapping number → `{name,url,kind}[]` outside the repository. Read all pages of
the public location API and scroll the public index until no more rows load.
Then run `python tools/special-events/import-studio-tour.py <source-directory>
--profiles-cache <filter-source-directory>` (one command).
The importer checks number/address/coordinate consistency and fails on missing
records. Then rebuild the chat zones as described below before publishing.
Review date/hour changes separately and bump the data's asset version.
Do not commit full website downloads, account data or credentials.

To refresh the filter/schedule enrichment without rebuilding any geometry:

```sh
python3 tools/special-events/enrich-studio-tour.py /path/outside/repo/tour-source --fetch
```

Omit `--fetch` to reproduce from that cache. The standard-library importer
reads public WordPress records and public profile pages with four concurrent
requests; only filter labels, profile links and factual availability enter
the GeoJSON. Keep the existing participant/index links when doing a full
location reimport; `--profiles-cache` applies this enrichment during that import.
The importer refuses to discard existing availability when that argument is
omitted. Bump the event data version after either refresh path.
Review the dates/counts and run the parser and planner checks before publishing.

## Chat and GPS

Visitors open **Chat**, allow location access, turn on **Visible**, then use
the **Chat N** button when another visible visitor is at their stop. The
participant list includes everyone currently visible in that stop's room.
It is one group conversation, not private messages to a selected person.
Guests need no registration and get a random nickname/emoji. Signed-in
members use their saved public chat profile (including an opted-in photo).
An unattended host must still keep this map open, Visible, and receiving
fresh location readings at the stop. There is no offline inbox or history
for later arrivals. Phone backgrounding/sleep can interrupt GPS or networking;
fresh GPS and a working connection are required to participate again.

`ChatRoom.start(..., {event})` uses `event-<event-id>-stop-<stop-id>` as both
the room and channel key. Only a Visible visitor with a fresh GPS reading
inside that stop's zone subscribes. Chat opens/sends only with another visible
visitor in that same room; incoming lines require current peer presence.
Messages are live-only for both guests and members, with no saved-history
read/write. Moving to another stop clears the old conversation and avatars;
hiding, leaving all zones or losing GPS disconnects. Main-map neighborhood
and business rooms retain their existing behavior and history.

High-accuracy GPS is requested; fixes older than 60 seconds or with reported
accuracy worse than 35 m cannot join. Stationary visitors get a new fix every
25 seconds. A 60-second presence lease and send-time expiry check prevent a
stale location from keeping chat active. This is browser GPS gating, not
server-enforced proof of location. GPS accuracy and source building matches
remain approximate. Test-room URL parameters do not bypass event geofences.

GPS independently chooses the neighborhood business directory, including
outside studio zones. Business picks remain map/planner targets and never
change the stop conversation or join neighborhood chat on the event map.

### Building zones

`tools/special-events/build-geofences.py <external-cache> --fetch` reads the
[City's Building Footprints 2023](https://maps.austintexas.gov/arcgis/rest/services/Shared/PlanimetricsSurvey_1/MapServer/0)
within 60 m of each organizer pin. Install `shapely>=2.1` and `pyproj` in a
temporary environment. Omit `--fetch` to rebuild from the saved responses.
Recreate the cache when reordering or changing the source stops.

301 stops match a containing or nearest footprint within 40 m. Six stops
(17, 39, 149, 151, 305, 308) have no close mapped footprint and use a 40 m
approximate radius. Footprint zones include about 20 m of surrounding space;
outdoor overlaps are divided by proximity to sampled building edges. Shared
building cores are divided between organizer stop pins: 21/104, 47/233,
97/100 and 132/135. Complete shared-building coverage per individual stop
would conflict with the owner's no-overlap rule.

The builder preserves each non-shared matched building, includes each stop
pin, and checks every pair for any intersection, including after GeoJSON
serialization. Tiny neutral seams prevent boundary ambiguity. Purple zones
appear at street zoom; the current GPS zone has a green outline. Per-stop
metadata records approximate/shared cases; the popup explains them.

The chat transport ignores old channel callbacks and history after leaving,
switching rooms or identity changes. Other maps keep neighborhood/business
room behavior.

Channel teardown is serialized: rapid GPS loss/recovery waits for the SDK to
remove the old channel before rejoining the same topic. Presence tracking waits
for subscription. Lost connections clear the event peer list and block sends;
reconnection publishes fresh presence. Event sends wait for the service's
acknowledgement before showing the sender's line. A failed send retains its
draft, and late results cannot edit a different room or a newer draft. This
confirms service receipt, not a read receipt from every participant. See the
[Supabase acknowledgement contract](https://supabase.com/docs/guides/realtime/broadcast#acknowledge-messages).
The event roster wraps on phones and scrolls when needed.

## Checks

- `node --test tests/planner/*.test.cjs`
- `python3 -m unittest discover -s tests/special-events -p 'test_*.py'`
- `node tools/special-events/check-map.cjs [https://austin.chat]`
- `node tools/planner/check-map.cjs [https://austin.chat]`
- `node tools/special-events/check-chat-live.cjs [https://austin.chat]`

The last check is manual and uses real guest Auth and Realtime. It requires
the logged-in Supabase CLI with project access to clean up its own disposable
guest records. It intercepts event data to assign a random test event ID, and
simulates GPS readings; all subscriptions, presence, messages and acknowledgements
use the deployed service. It never joins the published tour's rooms, blocks
saved-message API requests, and deletes the guests in `finally`. Credentials
stay in memory and are not printed. Set `EVENT_CHAT_LOCAL=true` to substitute
the checkout's chat engine/panel and event CSS before deployment. Screenshots
and a result summary go to the OS temporary directory, outside the repository.
The check covers multiple independent sessions, hidden/alone visitors, a
three-person group, adjacent stops sharing a building, late arrivals, rapid
GPS recovery, stationary presence beyond 60 seconds, offline sends, reconnect
and browser closure. It is not a physical iPhone/Android GPS or load test.

The event browser check covers desktop/phone, guest/member, all four tour dates,
pins/search, dated plans, rendered routing, calendar download, map export links,
GPS directory changes, same-stop peers, shared-building room separation,
hidden/alone/outside/inaccurate/stale/denied-location gating, drawer controls,
theme layout and the main Explore link. All account/chat/route writes use local
fixtures. It also loads actual hosted watercolor JPEGs and checks background
switching, satellite/3D, camera preservation, attribution, a simulated tile
outage and recovery. Availability checks cover actual weekend exceptions,
unknown schedules, all-day/time/medium filters, narrowed planner windows,
calendar details and updating an already planned visit. Shared references in private tour/shop pages require repackaging
with `tools/billing/package-apps.py --upload` before workflow-only Pages deploy.

## Separate plans and event retirement

Each event owns a planner collection keyed by its event ID. The main collection
uses `main`. A date is unique within its collection, so the same account can
have a main itinerary and independent event itineraries on the same date.
`planner/context.js` determines ownership from the map page before storage
starts; browser caches, guest visit memory, locks, cloud RPCs, backup/restore
and exports keep that boundary. Main/catalog selections cannot be added to an
event plan, and an event backup must be restored on that event's page. The
Special Events Explore card navigates the shared frame without ending a guest
visit. Guests still lose their temporary plans on a full refresh or closure.

Migration `0016_special_event_plans.sql` moves existing event items to their
own collections, retaining item IDs, notes, scheduled times and day settings.
It increments the original collection's revision. Older clients load only the
main collection; attempts to save a mixed collection are rejected atomically.
Unsaved legacy browser copies are partitioned for recovery and use the existing
explicit revision-conflict choices. The account and shared city database are
never treated as event-owned data.

The owner approved removal **48 hours after the final scheduled closing**.
`registry.json` supplies the browser/build metadata; `public.special_events`
supplies the authoritative server deadline. For this tour the final published
closing is November 22, 2026 at 10 PM CST, so retirement is **November 24 at
10 PM CST** (November 25, 04:00 UTC). Participant evening/overnight closings
count; the general 5 PM tour hours do not truncate them.

At the deadline, current browser maps retire and clear their event cache.
Server policies immediately reject event reads/writes; a database cron running
every minute deletes the event's plans and items, event-linked Favorites,
reminders/jobs, any legacy event messages/progress and registry row. Event chat
uses live Presence/Broadcast and has no stored chat history. Other events,
main plans, accounts, preferences and the shared routing network are retained.
An offline browser's physical cache is removed when it next runs current site
code; a website cannot remotely wipe a powered-off device or exported files.

Every Pages build excludes retired event pages, GeoJSON and explicitly assigned
unique assets, removes their catalog cards and prevents folder discovery from
relisting them. Existing scheduled sports refreshes trigger Pages publication
roughly every 15 minutes, even without changed scores; Actions delays/failures
can delay artifact removal. The browser/server deadline is independent of
that deployment. Shared event code and reusable basemap tiles remain available
for future maps. This is live-data retirement: public Git source history,
provider backups and visitor-downloaded calendar/JSON copies are not rewritten.

For a future event, add its page/data entry to `registry.json`, then run:

```
python3 tools/special-events/register.py EVENT-ID
python3 tools/special-events/register.py EVENT-ID --apply
```

The first command previews the latest published closing and 48-hour deadline.
The second uses the authorized Supabase CLI without printing credentials,
updates server metadata and the local registry/catalog, and refuses an already
expired event. Publish the resulting metadata with the event's page. Re-run
after organizer schedule changes so browser and server deadlines agree.
Unique assets may be listed under `/special-events/assets/EVENT-ID/`; retirement
never accepts a shared or traversal asset path.

Verification:

```
node --test --test-isolation=none tests/planner/*.test.cjs
python3 -m unittest discover -s tests/special-events -p 'test_*.py'
python3 tools/special-events/check-database.py
node tools/special-events/check-map.cjs
```

Database checks create disposable fixtures and always roll back. Before applying
migration 0016, `check-database.py --migrate` also verifies the migration against
existing items without exporting private data. Browser checks use account,
chat and route fixtures, and cover same-day main/event plans, guest navigation,
registered reload, exports, retained notes and deadline expiry.
