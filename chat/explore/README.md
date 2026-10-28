# Explore Austin — main-map layers

The main page loads the chat map. Its **Explore** button (top right) opens a
tile menu with Free & cheap, Movies, Live Music, Live Comedy, Pop up markets,
Festivals, Events and Parks. Free & cheap starts on; all other categories start
off. Any combination can be selected, and the combined map/list updates
immediately. Layer
choices and filters are remembered locally. Nothing in Explore changes chat
identity, rooms, visibility or presence. Near me requests a location only when
selected, keeps coordinates in memory and does not send them to the server.

## Files and adding layers

- `config.js`: layer registry. Add a title, description, stable ID and GeoJSON
  URL to register another event or place layer in the same menu.
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
Organizer listings use `kind: listing`, a category `theme`, and `price: null`
when admission is unknown. Parks use `kind: park`, `theme: parks`, and have no
start, end or expiry dates. Parks ignore time and price controls but still
respect the shared name/location filters.

Movies use `kind: movie`, `price: null` (never assumed free), `tags` (`imax` or
`dine-in`), and a `showtimes` array of `{start, url, format}`. Each feature is one
film at one theater on one Austin calendar day. The browser removes started
screenings before filtering and advances the listing to its next showing.
The feature's `end` is one second after its final start, solely a filtering
boundary, not a claim about runtime. It is never displayed as an end time.
Movie pins/clusters are purple. Counts represent film/day listings, not seats
or individual showtimes. Popups and list update together as screenings expire.

Date/location filters affect all dated categories. Now means ongoing or
starting in the next two hours; Tonight means 6 PM through 3 AM Austin time,
including the previous evening before 3 AM. Movie showtimes must start inside
the selected window. Today is also available under More filters. Parks stay
available in every time view; this does not imply they are currently open.
Price/type controls explicitly apply only to Free & cheap. Movies has its own
theater-type selector under More filters. Search matches names and venues
across all selected categories. Settings remain local.

Filtering happens **before** venue grouping and clustering, so counts match
what the visitor selected. Co-located events share a pin; its popup lists the
matching occurrences. UT events shared by Free & cheap and a specific category
appear once when both are selected. Cluster numbers count records, not people. Map clicks on
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

### Public organizer calendars and city parks

`tools/explore/build_layers.py` and `culture_sources.py` import these free,
public sources with Python's standard library, without AI, keys or paid APIs:

- [Fallout Theater](https://falloutcomedy.com/comedy-shows/): public comedy
  cards with explicit show dates, start/end times and Eventbrite detail links.
- [Antone’s](https://antonesnightclub.com/): official live-music calendar;
  show time is used, not the earlier doors time.
- [Meanwhile Brewing](https://www.meanwhilebeer.com/events): dated concerts,
  festivals and other public events. Admission is checked on the source;
  generic template labels are not taken as evidence that a paid class is free.
- [Austin Flea](https://www.austinflea.net/): individually dated market cards
  and venues, not extrapolated weekly recurrences. Where the page omits a year,
  only an occurrence in the immediately upcoming 30-day window qualifies.
- [UT Austin](https://calendar.utexas.edu/): the same public calendar API with
  Austin coordinates and General Public eligibility; these broader categories
  do not require a known admission price. Movie screenings are excluded here.
  Explicit source categories and conservative title rules distinguish music,
  festivals and markets from other Events. No AI classification is used.

### Expanded Live Comedy coverage

`tools/explore/comedy_sources.py` supplements Fallout with eight automatically
refreshed venues:

- [Comedy Mothership](https://comedymothership.com/shows) and
  [Sunset Strip](https://www.sunsetstripatx.com/): the public SquadUP organizer
  feeds used by their ticket calendars. Mothership's organizer is published on
  [its ticket-provider page](https://comedy-mothership.squadup.com/); Sunset's
  organizer ID comes from its public embed configuration. No authentication,
  checkout, resale marketplace or browser automation is involved. Dates, Austin
  locations, room names and sold-out flags come from the feed. Links go to the
  organizer's event page on its ticket provider. Only in-person events with
  published start times qualify. Invite-only events are excluded. SquadUP's
  `private` directory setting is distinct from invite-only access: venue embeds
  publish these unlisted events on their own public calendars. The response
  must fit the requested 500-record page; a truncated response fails the import.
- [Cap City](https://www.capcitycomedy.com/calendar) and
  [The Velveeta Room](https://www.thevelveetaroom.com/): official SeatEngine
  calendars, using JSON-LD dates plus each performance's ticket-link status.
  Both months are fetched when the next 14 days cross a month boundary.
- [The Creek and The Cave](https://creekandcave.com/calendar): dated calendar
  entries lead to official show pages with structured per-performance dates,
  end times and ticket availability. At most three detail pages load at once.
- [ColdTowne](https://coldtownetheater.com/live-shows/): the same unauthenticated
  date-range JSON endpoint used by its public calendar. Only `/show/` records
  qualify; class enrollment products do not. Naive dates use Austin time.
- [East Austin Comedy](https://eastaustincomedy.com/): published ComedyEvent
  JSON-LD and the venue's own coordinates. Explicit dates only; no extrapolation
  of the site's recurring weekly schedule.
- [The Hideout](https://hideouttheatre.com/calendar/): dated show cards for the
  current and following month. These shows are at the
  [Annex](https://hideouttheatre.com/locations/hideout-annex/), 5555 N Lamar,
  Suite B103, rather than the former Congress Avenue location. Class listings
  and date-only previews are excluded; an unrecognized venue fails the update
  until its location can be verified.

Each club fails independently and retains only its own unexpired last-good
entries. An unavailable page never invents or renews a show. Explicitly sold-out
or cancelled performances are excluded where the source supplies that status;
otherwise visitors confirm availability with the venue. Admission remains
unknown rather than assuming a ticket amount includes fees or drink minimums.
The 14-day snapshot contains separate performances; the menu's default week
view shows a smaller, time-filtered subset. Overlapping month calendars are
deduplicated by performance, and venue pins combine shows at one location.
Small ticket-page coordinate differences at an identical street address are
consolidated to that address’s most frequently published coordinate.

This is initial source coverage, not a complete citywide event directory.
The sources' published schedules determine what appears in each category.
Only factual titles, dates, venue information and links are republished.
Unknown end times are not invented: those listings disappear at their start.
New market addresses are verified through the free
[US Census Geocoder](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html)
and saved in `tools/explore/venue-cache.json`. Ambiguous/non-Austin matches
fail that source update. These street-address coordinates are approximate,
not surveyed entrances. No visitor location is sent for geocoding.

[Parks come from the City of Austin park-boundary inventory](https://data.austintexas.gov/d/v8hw-gz65).
Only developed park types listed as Open are included; undeveloped parcels,
closed parks, school grounds, golf courses, cemeteries and planting strips
are excluded. Duplicate assets are merged. An interior point in the largest
boundary polygon places each marker, respecting holes; it is not an entrance.
Directions search the park name and address. Links lead to the official
[park directory](https://www.austintexas.gov/parks/locations/park-directory),
or a matching park-specific city page. Inventory status does not report live
opening hours, closures or fees. The initial snapshot contains 275 parks.
Parks refresh daily and remain browsable during a source outage, with their
actual last-checked date shown.

The import covers 14 days; the visitor's default view is the next seven calendar
days including today. Today includes ongoing events. Weekend means Saturday
and Sunday (the current weekend on Saturday/Sunday). Near me distances are
straight-line miles, not walking directions. Price filters include free items.

## Automation and failure behavior

`.github/workflows/build-explore.yml` runs at minute 43 every three hours and
supports manual dispatch. Organizer calendars run every three hours; the
park importer skips snapshots less than 24 hours old. GitHub can delay schedules. The browser checks every
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
then reports the failure. Each new organizer adapter also retains only its
own unexpired previous listings on failure; successful sources replace their
old entries. These entries expire within 24 hours of verification, or at their
known end/start boundary, whichever is earlier. Total organizer failure leaves
all category snapshots intact and still permits the park import to run.
Requests use bounded concurrency and per-run cache
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
python3 tools/explore/build_layers.py
```

UI changes require version bumps in `chat/index.html`; changes to that frame
also bump the homepage iframe query. Follow the root cache/deployment rules.
