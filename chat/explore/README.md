# Explore Austin — main-map layers

The main page loads the chat map. Its **Explore** button (top right) opens a
shared layer menu. Free & cheap starts on; Movies starts off. Either, both or
neither can be selected, and the combined map/list updates immediately. Layer
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
- `../../tools/explore/build_movies.py`: public theater feed/calendar importer.
  Generates `../data/explore/movies.geojson` without keys, AI or paid services.

GeoJSON point properties: `id`, `title`, `url`, `venue`, `address`, `start`,
`end`, `price` (number in USD; known admission price), `priceLabel`, `kind`
(`event` / `activity` / `offer`), `source`, `checked`, `expires`, optional
`description`, `conditions`, `allDay`, `endKnown`. IDs distinguish occurrences.
The current menu supports dated layers; an always-available places layer would
need its own time-filter behavior instead of inventing event dates.

Movies use `kind: movie`, `price: null` (never assumed free), `tags` (`imax` or
`dine-in`), and a `showtimes` array of `{start, url, format}`. Each feature is one
film at one theater on one Austin calendar day. The browser removes started
screenings before filtering and advances the listing to its next showing.
The feature's `end` is one second after its final start, solely a filtering
boundary, not a claim about runtime. It is never displayed as an end time.
Movie pins/clusters are purple. Counts represent film/day listings, not seats
or individual showtimes. Popups and list update together as screenings expire.

Date/location filters affect both layers. Price/type controls explicitly apply
only to Free & cheap. Movies has its own theater-type selector and title/theater
search. This prevents unknown ticket prices or a saved activity-only selection
from making Movies silently disappear when enabled. Settings remain local.

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

### Automatically refreshed movie sources

- [Alamo's public Austin market feed](https://feeds.drafthouse.com/adcService/showtimes.svc/marketFilms/austin),
  also described in [Alamo's own API example](https://github.com/drafthouse/adc-mcc):
  South Lamar, Slaughter Lane, Mueller, Village and Lakeline. Imports only future
  `onsale` sessions and uses feed-supplied theater coordinates, local dates,
  formats, ratings and food/beverage requirements. A feed older than 12 hours
  is rejected. Where no session sales URL exists, links open the official movie
  schedule so the visitor can choose their theater/time. No ticket prices are
  inferred from ticket category codes.
- [Bullock Museum calendar](https://www.thestoryoftexas.com/calendar/): date-filtered,
  paginated public showtime cards. Only cards explicitly labeled IMAX Theatre
  qualify; Texas Spirit Theater is not mislabeled as IMAX. Exact start times
  and film-page links come from the calendar. The building coordinate comes
  from the museum's [own map link](https://maps.app.goo.gl/ajgF8BTW6cyByE4Y7).
- [Violet Crown Austin](https://austin.violetcrown.com/cinema/): public cinema and
  movie-page JSON-LD `ScreeningEvent` data, official checkout URLs and theater
  coordinates. Only available, uncancelled future screenings qualify. No
  authenticated API or browser automation is needed. Coverage follows the
  dates published in these pages and may be shorter than the full week.

This is an initial selection of seven theaters, not a complete Austin cinema
directory. All movie sources update automatically; none require a person to
enter weekly schedules. No posters, trailers or film synopses are republished.
Availability and prices are confirmed on the theater's own site. Movie feeds
carry a 12-hour expiry, and each showing disappears at its actual start time.
Alamo and museum times without offsets are interpreted in America/Chicago,
including daylight saving changes. Dates are never extrapolated from a film's
release date or multiweek screening range.

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
requests and uses a fresh query on the RSS feed to avoid stale CDN snapshots.
An unexpectedly empty verified library import is treated as a source failure.
Duplicate title/start/location records are merged. Failed sources or
detail requests retain previous entries only until their existing expiry; they
do not receive a new checked time. Successful feeds replace their earlier
records, removing cancellations and vanished entries. Automated entries expire
no later than 24 hours after checking; curated entries expire at their review
deadline. Total failure of both automatic sources fails the job and leaves the
published file intact. The browser still hides expired data. The Sources &
freshness panel shows partial failures and delayed updates.

Movie imports use the same rules for last-good data: failed sources, film
pages or individual calendar days may retain their previous unexpired records
without renewing them. Complete movie-source failure fails that import. The
workflow publishes successful layer updates even if the other importer fails,
then reports the failure. Requests use bounded concurrency and per-run cache
queries; museum pagination/date matching are checked rather than silently
publishing partial or wrong-day results.

Curated updates require a person to verify the organizer's current price,
hours and conditions, then update `verified`, `validUntil` and any changed
fields. They automatically disappear if nobody reconfirms them. Routine feed
updates require neither AI nor human editing.

Run from repository root:

```sh
python3 -m unittest discover -s tools/explore -p 'test_*.py'
node tools/explore/test-model.cjs
python3 tools/explore/build.py
python3 tools/explore/build_movies.py
```

UI changes require version bumps in `chat/index.html`; changes to that frame
also bump the homepage iframe query. Follow the root cache/deployment rules.
