# Explore Austin — main-map layers

The main page loads the chat map. Its **Explore** button (top right) opens a
tile menu with Free & cheap, Movies, Live Music, Live Comedy, Pop up markets,
and Events & Festivals. Free & cheap starts on; all other categories start
off. Any combination can be selected, and the combined map/list updates
immediately. Layer
choices and filters are remembered locally. A previously selected Events or
Festivals card enables the combined card; saved Parks selections are discarded.
Nothing in Explore changes chat
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
when admission is unknown. The historical park snapshot uses `kind: park`;
it is no longer loaded by the menu or refreshed by the scheduled job.

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
the selected window. Today is also available under More filters.
Price/type controls explicitly apply only to Free & cheap. Movies has its own
theater-type selector under More filters. Search matches names, venues and addresses
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

### Public organizer calendars

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

### Expanded Live Music coverage

`tools/explore/music_sources.py` adds eleven venues to Antone’s, Meanwhile and
UT's existing music listings. These adapters use Python's standard library,
run in the existing three-hour workflow, and need no paid service, AI,
account registration, owner API credentials, or browser automation:

- [Saxon Pub](https://thesaxonpub.com/events/): its public WordPress Events
  Calendar feed, including dated recurring instances, UTC start/end times and
  bounded pagination. Records without a separate venue object belong to this
  single-venue calendar; a conflicting venue fails the import.
- [Continental Club and Gallery](https://continentalclub.com/austin) and
  [C-Boy’s Heart & Soul](https://www.cboys.com/calendar): their embedded Timely
  calendars, with a 14-day date range and verified venue IDs. Timely requires
  the public widget's application header for anonymous reads; the importer
  reads this configuration from Timely's published frontend bundle at runtime.
  No private key is saved. A truncated result or unexpected venue fails that
  source. Timely's `instant_event` flag means the end time is unknown, even
  though the feed supplies a synthetic 23:59:59 boundary.
- [Elephant Room](https://elephantroom.com/calendar) and
  [Sam’s Town Point](https://www.samstownpointatx.com/calendar): Bandzoogle's
  public upcoming-performance lists and their linked pagination. Yearless dates
  resolve into the nearest adjacent year, then must pass the 14-day window.
  Explicit show times in a title override a doors time in the calendar field.
  Repeated pages, broken markup and unexpectedly large pagination fail safely.
- [Mohawk](https://mohawkaustin.com/): its public Prekindle widget, using the
  show time instead of `doorsTime`, available performances with a band lineup,
  and a verified indoor/outdoor venue. Both stages share a map pin; the room
  remains visible in event details. Ticket links use the venue's provider.
- [Banger’s](https://www.bangersaustin.com/pages/event-calendar): the public
  Events Calendar widget's dated Live Music entries. Artist names come from
  those entries. Separate local date/hour fields supply the performance time;
  the provider's midnight epoch fields are not show times.
- [The White Horse](https://www.thewhitehorseaustin.com/): the public Google
  calendar feed used by its embedded Events Calendar widget. The provider
  expands recurrences and exceptions into explicit dated sets. Cover-charge
  entries, dance lessons, private bookings and DJ-only entries are excluded.
- [The ABGB](https://theabgb.com/events/): explicit dated calendar cards, with
  published time ranges. Food specials, football, book signings, film screenings,
  ambiguous all-day performances and doors-only ticket events are excluded.
- [Sahara Lounge](https://www.saharalounge.com/shows/): its public Brown Bear
  calendar for each month touched by the 14-day window. Only named sets with
  an explicit am/pm time in the written lineup qualify. The generic calendar
  time sometimes conflicts with the lineup and is not used. Ambiguous times,
  buffet/opening entries, rehearsals and private events are omitted. Midnight
  sets belong to the following date of the published evening lineup.

Music source health appears only in Live Music. Each source replaces its own
old listings on success and retains only unexpired records on failure, without
renewing their checked/expiry timestamps. Cancelled and sold-out flags are
honored where published; ticket availability and admission still require
checking the organizer. Sources without individual event URLs link to their
public calendar. Every source is free to read; coverage is not exhaustive.
Skylark Lounge is not included because it
[closed in April 2025](https://www.kut.org/austin/2025-12-18/austin-tx-businesses-restaurants-stores-local-closures-2025).
Friends Bar's
site had an expired TLS certificate during setup, and Half Step did not expose
a usable dated calendar; neither is populated with guessed recurring shows.

### Expanded Pop up markets coverage

`tools/explore/market_sources.py` adds ten independent sources to Austin Flea.
The existing menu tile includes artisan, vintage, community and farmers'
markets. It remains off by default. Search includes street addresses and city
names, and the location selector says **All locations** because some markets
are in nearby cities. The existing Austin-area bounds already include the
Georgetown, Round Rock and Cedar Park locations; no citywide boundary was
expanded for other categories.
The map's pan/zoom limits include valid locations in enabled Explore layers,
so selecting a Georgetown result can actually reach its pin. Coverage uses
records before search, time and area filtering to avoid trapping the visitor
inside a shrinking map view. Disabling layers restores the remaining coverage;
the City button continues to return to the original Austin neighborhoods.

- [Sunshine Markets](https://nextdoor.com/pages/santas-sun-market-georgetown-tx/):
  the organizer's public story specifies Saturdays and **third Sundays**, 10–3,
  at the Floor & Decor parking lot, 1101 S Interstate 35, Georgetown. Generic
  business-hours widgets omit the third-Sunday restriction and are not used.
  A current explicit cancellation notice suppresses the regular listings.
- [SoCo Makers Market and Vintage Annex](https://www.socomakersmarket.com/):
  published Friday/Saturday/Sunday daytime hours at 1501 S Congress.
- [Austin Makers Collective](https://www.austinmakerscollective.com/about-3):
  RivCo's published Friday evening and Saturday/Sunday daytime hours at
  Cork & Brew, 343 S Congress. The page's other location lacks sufficient
  published hours and is not copied into the feed.
- [Texas Farmers' Market at Bell](https://texasfarmersmarket.org/farmers-markets-and-events)
  in Cedar Park and [Mueller](https://texasfarmersmarket.org/mueller): separately
  checked Saturday and Sunday schedules. Mueller's pavilion uses the map pin
  published on its own page; that pin's address must still match the market.
- [SFC Farmers' Markets](https://sustainablefoodcenter.org/farmers-markets-support/sfc-farmers-markets/):
  Saturday hours at Republic Square and the Toney Burger Center.
- [Farmer George](https://www.farmergeorge.market/): the Saturday market at
  Rock Creek Center, Round Rock. Christmas Day is excluded; the advertised
  Sunday market marked "coming soon" is not imported.
- [Austin Witches Market / Yarrow & Sage](https://yarrowandsageatx.com/pages/calendar):
  the public Google iCalendar feed embedded by the organizer. Only market
  events qualify; classes and date-only records do not. `icalendar` and
  `recurring-ical-events` expand published recurrence rules while respecting
  excluded dates, moved instances, cancellations, timezones and DST. This adds
  rotating markets at cafés, breweries and outdoor venues. No Google API key
  or account is needed. The separate moon-phase calendar is not imported.
- [The Front Market / Future Front](https://thefrontmarket.com/popups): the
  organizer's dated Squarespace event feed. Multi-day exhibitions without
  daily opening hours are omitted. A Coquito event currently retains Stubb's
  location from a reused template; it is logged and skipped instead of placing
  a knowingly incorrect marker. Separately dated Waterloo markets qualify.
- [Central Machine Works](https://events.cmwbrewery.com/calendar): dated market
  and gear-swap cards, with the current venue address verified on each event
  page. Explicit detail-page end times are used when available. Generic free
  template labels are not treated as confirmed admission prices.

Weekly/monthly hours are expanded only after that source's current page has
been fetched and its schedule/address recognized. Those entries say **Regular
published schedule; check the organizer for weather and holiday changes.**
This is different from a separately confirmed dated event. Schedule changes
that the parser cannot interpret fail that source and retain only previously
checked, unexpired entries. A successful empty calendar removes old entries.
No occurrence is generated beyond the rolling 14-day horizon, and every
listing expires within 24 hours unless successfully checked again. These
pages cannot guarantee that last-minute social-media cancellations are seen.

New nearby-city addresses are checked with the Census geocoder using an
explicit Austin/Cedar Park/Round Rock/Georgetown allowlist. Other importers
retain their Austin-only default. All market source health is shown only for
Pop up markets. Admission remains "Check admission"; vendor booth fees are
never mistaken for visitor ticket prices.

Install the pinned calendar readers and dependencies in
`tools/explore/requirements.txt` before local tests/builds. GitHub Actions
installs them automatically. They run locally in Python, require no paid
service or credentials, and do not use AI. Source pages supply factual event
names, dates, hours, venue addresses and links; vendor rosters, photographs
and descriptive articles are not republished.

This is initial source coverage, not a complete citywide event directory.
The sources' published schedules determine what appears in each category.
Only factual titles, dates, venue information and links are republished.
Unknown end times are not invented: those listings disappear at their start.
New market addresses are verified through the free
[US Census Geocoder](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html)
and saved in `tools/explore/venue-cache.json`. Ambiguous matches or addresses
outside the source's allowed cities fail that source update. These street-address coordinates are approximate,
not surveyed entrances. No visitor location is sent for geocoding.

### Expanded Events & Festivals coverage

`tools/explore/event_sources.py` and `community_sources.py` add eleven free
organizer/city calendars, using Python's standard library. These are public
website feeds and pages, with no credentials, paid API, or AI in routine updates.

| Source | Import and coverage |
| --- | --- |
| [The Contemporary Austin](https://thecontemporaryaustin.org/events/) | Public Events Calendar API; family art, tours, talks and special programs at Jones Center and Laguna Gloria. |
| [Mexic-Arte Museum](https://mexic-artemuseum.org/calendar/) | Same API for timed museum programs and celebrations. A valid empty calendar is healthy; its October Viva la Vida festival has already ended. |
| [Blanton Museum of Art](https://blantonmuseum.org/programs/) | The museum's public Juicebox calendar feed; dated tours, art activities, talks and B Scene. Uses event dates, not post publication dates. |
| [Bullock Museum](https://www.thestoryoftexas.com/calendar/?_post_type_filter=event) | Filtered public calendar cards with explicit times; museum programs, not the IMAX feed or virtual classes. |
| [Canopy](https://www.canopyaustin.com/happenings-) | Public Squarespace calendar; openings, open studios, celebrations and workshops. |
| [Preservation Austin](https://www.preservationaustin.org/events) | Public Squarespace calendar; talks, tours and community celebrations with a published meeting address. |
| [Pease Park Conservancy](https://peasepark.org/events) | Public Squarespace calendar; individually dated history, nature, wellness and family programs. |
| [City cultural centers](https://www.austintexas.gov/arts-culture/events) and [ESB-MACC](https://www.austintexas.gov/macc/events) | Paginated city calendars; Carver, Dougherty, Asian American Resource Center, MACC and other arts/museum programs. Overlapping department entries are merged. |
| [Austin Center for Events](https://www.austintexas.gov/ace/events) | Paginated city special-event calendar; dated community events and stadium events with specific street addresses. |
| [Waterloo Greenway](https://waterloogreenway.org/events/) | Individually dated community celebrations, fitness and volunteer sessions. Creek Show's explicitly published nightly hours produce separate nightly records when they enter the 14-day window. |
| [Shoal Creek Conservancy](https://shoalcreekconservancy.org/events/) | Dated volunteer and educational events with public meeting addresses. Private meeting points sent only after registration are not guessed. |

The initial production snapshot contained 212 dates at 45 coordinate locations,
including 66 distinct dates from new sources. Counts naturally change during
refreshes; a source can have no eligible dates in the next two weeks.

The menu's stable `events` ID now loads `events-festivals.geojson`. The builder
merges Events and Festivals after source-specific failure retention, deduplicates
occurrence IDs and recomputes source counts. Separate legacy files keep previously
opened tabs working. Nothing is copied manually into the combined file.

All new source health appears only under Events & Festivals. Entries keep the
existing 24-hour verification expiry, and source failures never extend stale
entries. Start/end dates use Austin time, including daylight saving. Blanton
queries start at local midnight to keep ongoing programs; other feeds are also
filtered by the actual end time. Unknown admission remains “Check admission.”

Street addresses are checked through Census rather than trusting copied template
pins. Preservation Austin's Tavern event had a mismatched pin and ZIP code; its
published street resolves correctly. City
JSON-LD can attach an incorrect timezone offset; the importer instead checks
visible times against the HTML time fields. Midnight placeholders, citywide
routes without meeting points, virtual events, explicitly private/member-only
events, and multiweek date spans without daily hours are omitted. A printed
series span is never assumed to meet every day. Separately dated sessions qualify.

The Lady Bird Johnson Wildflower Center returned valid public API data locally,
but rejected two consecutive GitHub Actions runs with HTTP 403. It is excluded
from automatic imports, and its trial records are removed rather than kept
indefinitely. Reassess only if an accessible automation feed becomes available.

Other calendars researched included Austin Parks Foundation (its current HTTP
page exposes unrendered calendar shortcodes), Zilker Botanical Garden (old feed
is unavailable), BookPeople (403), Long Center (inconsistent structured timezone
and placeholder end times), Downtown Austin Alliance, and the Texas Book Festival.
They are not imported through fragile workarounds or stale previous-year dates.
Seasonal festivals appear only when a supported source publishes an eligible date.

### Archived Parks layer

Parks was removed from the menu on October 28, 2026. Its importer and snapshot
remain in git for reuse, but the normal build no longer requests or refreshes
them. Dated activities in parks still belong in Events & Festivals.

[The archived locations came from the City of Austin park-boundary inventory](https://data.austintexas.gov/d/v8hw-gz65).
Only developed park types listed as Open are included; undeveloped parcels,
closed parks, school grounds, golf courses, cemeteries and planting strips
are excluded. Duplicate assets are merged. An interior point in the largest
boundary polygon places each marker, respecting holes; it is not an entrance.
Directions search the park name and address. Links lead to the official
[park directory](https://www.austintexas.gov/parks/locations/park-directory),
or a matching park-specific city page. Inventory status does not report live
opening hours, closures or fees. The initial snapshot contains 275 parks.
The archived snapshot retains its original checked date.

The import covers 14 days; the visitor's default view is the next seven calendar
days including today. Today includes ongoing events. Weekend means Saturday
and Sunday (the current weekend on Saturday/Sunday). Near me distances are
straight-line miles, not walking directions. Price filters include free items.

## Automation and failure behavior

`.github/workflows/build-explore.yml` runs at minute 43 every three hours and
supports manual dispatch. Organizer calendars run every three hours. GitHub can delay schedules. The browser checks every
five minutes while visible, and on returning to the tab. It reads the newest
valid deployed/raw-main snapshot, so GITHUB_TOKEN commit behavior does not
prevent data updates. Map state is preserved while refreshing.

The job uses Ubuntu 24.04 explicitly, avoiding automatic operating-system
migrations under `ubuntu-latest`. Checkout 7.0.1 and setup-python 7.1.0 use
Node 24 internally; the import scripts still run on Python 3.12. A source failure
can produce two exit-code annotations: one for the importer and one for the
final failure-report step. Successful feeds are published before that report.
Old failed runs keep their annotations after a fix; inspect the latest run.

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
all category snapshots intact, including the combined Events & Festivals feed.
Requests use bounded concurrency and per-run cache
queries; museum pagination/date matching are checked rather than silently
publishing partial or wrong-day results.

Curated updates require a person to verify the organizer's current price,
hours and conditions, then update `verified`, `validUntil` and any changed
fields. They automatically disappear if nobody reconfirms them. Routine feed
updates require neither AI nor human editing.

Run from repository root:

```sh
python3 -m pip install -r tools/explore/requirements.txt
python3 -m unittest discover -s tools/explore -p 'test_*.py'
node tools/explore/test-model.cjs
python3 tools/explore/build.py
python3 tools/explore/build_movies.py
python3 tools/explore/build_layers.py
```

UI changes require version bumps in `chat/index.html`; changes to that frame
also bump the homepage iframe query. Follow the root cache/deployment rules.
