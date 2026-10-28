# Explore Austin — main-map layers

The main page loads the chat map. Its **Explore** button (top right) opens a
shared layer menu. Free & cheap starts on; visitors can turn it off. Layer
choices and filters are remembered locally. Nothing in Explore changes chat
identity, rooms, visibility or presence. Near me requests a location only when
selected, keeps coordinates in memory and does not send them to the server.

## Files and adding layers

- `config.js`: layer registry. Add a title, description, stable ID and GeoJSON
  URL to register another dated-events/activities layer in the same menu.
- `model.js`: pure date, cost, distance, viewport and expiration filtering.
  Dates use America/Chicago even if a visitor's computer uses another zone.
- `explore.js` / `explore.css`: menu, remembered filters, event list, map
  sources/layers, clusters, venue popups and organizer/directions links.
- `../data/explore/free-cheap.geojson`: generated data, never edited by hand.
- `../../tools/explore/build.py`: Python stdlib importer; no AI, keys, paid
  APIs, database or pip dependencies.
- `../../tools/explore/curated.json`: small human-reviewed recurring activity
  collection. Explicit `validUntil` deadlines are never automatically renewed.

GeoJSON point properties: `id`, `title`, `url`, `venue`, `address`, `start`,
`end`, `price` (number in USD; known admission price), `priceLabel`, `kind`
(`event` / `activity` / `offer`), `source`, `checked`, `expires`, optional
`description`, `conditions`, `allDay`, `endKnown`. IDs distinguish occurrences.
The current menu supports dated layers; an always-available places layer would
need its own time-filter behavior instead of inventing event dates.

Filtering happens **before** venue grouping and clustering, so counts match
what the visitor selected. Co-located events share a pin; its popup lists the
matching occurrences. Cluster numbers count records, not people. Map clicks on
Explore pins do not also select the neighborhood underneath. Records are
rechecked for expiration every minute. The list provides keyboard access to
all items, including off-screen pins.

## Sources and rules

- [Library events](https://library.austintexas.gov/events-feed.xml): public
  reuse feed, paired with each event page's structured Event metadata. Only
  in-person events explicitly marked free and open to the public qualify.
  Exact start/end times, cancellation status, source URL and audience tags are
  retained. Online/mobile-library/unknown venues are omitted, not guessed.
- [City library locations](https://data.austintexas.gov/resource/tc36-hn4j.json):
  branch coordinates and addresses. John Gillum's renamed branch has an explicit
  alias. No per-visitor geocoding or external proxy.
- [UT calendar API](https://calendar.utexas.edu/api/2/events): pagination is
  followed, General Public eligibility and Austin coordinates are required.
  Only explicit free admission or simple confirmed prices/ranges up to $20 are
  accepted. Missing prices, free-food mentions, from-prices, student-only and
  UT-ID-required listings are excluded. Each dated occurrence is independent.
  Timed events with unknown end times disappear at their start; all-day events
  last through their local calendar day. Paid listings retain the source price.
- Curated activities currently cover the Nature & Science Center and free
  Tuesdays at the Blanton. Venue coordinates are approximate entrance/building
  points. They are reviewed against linked official visitor information.
  Holiday/special closures may supersede regular hours: check the organizer.
  Recurring schedules use Austin time, including DST. Offers can be added with
  the same explicit cost, conditions, schedule and review deadline; none are
  fabricated to populate an empty filter.

The import covers 14 days; the visitor's default view is the next seven calendar
days including today. Today includes ongoing events. Weekend means Saturday
and Sunday (the current weekend on Saturday/Sunday). Near me distances are
straight-line miles, not walking directions. Price filters include free items.

## Automation and failure behavior

`.github/workflows/build-explore.yml` runs at minute 43 every three hours and
supports manual dispatch. GitHub can delay schedules. The browser checks every
five minutes while visible, and on returning to the tab. It reads the newest
valid deployed/raw-main snapshot, so GITHUB_TOKEN commit behavior does not
prevent data updates. Map state is preserved while refreshing.

The importer requests library detail pages with at most four concurrent
requests. Duplicate title/start/location records are merged. Failed sources or
detail requests retain previous entries only until their existing expiry; they
do not receive a new checked time. Successful feeds replace their earlier
records, removing cancellations and vanished entries. Automated entries expire
no later than 24 hours after checking; curated entries expire at their review
deadline. Total failure of both automatic sources fails the job and leaves the
published file intact. The browser still hides expired data. The Sources &
freshness panel shows partial failures and delayed updates.

Curated updates require a person to verify the organizer's current price,
hours and conditions, then update `verified`, `validUntil` and any changed
fields. They automatically disappear if nobody reconfirms them. Routine feed
updates require neither AI nor human editing.

Run from repository root:

```sh
python3 -m unittest discover -s tools/explore -p 'test_*.py'
node tools/explore/test-model.cjs
python3 tools/explore/build.py
```

UI changes require version bumps in `chat/index.html`; changes to that frame
also bump the homepage iframe query. Follow the root cache/deployment rules.
