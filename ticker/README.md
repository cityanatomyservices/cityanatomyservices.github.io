# Austin now

The shared `shell.js` loads a 42px ticker immediately above the footer on
Austin.chat's framed pages. Click **Austin now** or the up arrow to browse,
filter the selected categories, or expand enabled Austin-area stock quotes. All item links
open a new tab. The ticker scrolls by default, including while hovered or focused;
the pause button, active dragging, and expanded reader stop it. Returning after
opening a ticker link resumes scrolling and closes the reader. Manual pause is
not persisted across page loads. Reduced-motion users still start/return paused.

**Customize** (the gear on small screens) controls both the moving strip and
the reader. Visitors can select any combination of nine news/utility topics and
the six Explore Austin categories, choose news publishers, and set Explore to
Now, Tonight, This weekend or Next 7 days. Settings are saved immediately in
`austin-ticker-preferences-v1` in localStorage and synchronized across tabs.
An empty selection stays empty. Restore defaults resets topics, publishers and
dates. Storage failures only affect persistence. Map settings/presence are never
read or changed by ticker preferences.

Defaults include news, culture, weather, Texas sports, property, city,
transportation, Austin-relevant national news, Free & cheap, and Events &
Festivals. Movies, Live Music, Live Comedy, Pop up markets and stocks start off.
The stock topic adds clearly labeled quote links to the strip and enables the
TradingView reader section; the strip does not claim to have live stock prices.

## Sources

- KUT Austin, housing, and transportation RSS; KXAN Austin RSS; City of Austin
  releases. Titles, links, source names, and dates only; no full article copies.
- [Austin Chronicle news](https://www.austinchronicle.com/category/news/feed/)
  and [general/culture feed](https://www.austinchronicle.com/feed/). Its old
  `/gyrobase/rss/` addresses returned 404 when checked October 28, 2026. The
  current home page advertises the new WordPress RSS address. The news feed
  includes weekly issue coverage; the general feed adds food, music, arts and
  screens stories. News-tagged entries are not repeated as culture.
- [Austin Current](https://austincurrent.org/feed/),
  [Community Impact's Austin-area edition](https://communityimpact.com/rss/austin/),
  [KVUE local news](https://www.kvue.com/feeds/syndication/rss/news/local),
  [Austin Monthly](https://www.austinmonthly.com/feed/) (culture), and
  [The Daily Texan news](https://thedailytexan.com/category/news/feed/).
  Community Impact includes surrounding communities. All are public publisher
  feeds, require no account/API key, and returned current dated stories during
  implementation. Entries tagged as contests/sponsored/advertorials are omitted.
  There are 13 feeds from 10 selectable publishers. Publisher choices affect
  news only, not organizer listings or utility links.
- Texas Tribune RSS, limited to three stories that mention the Austin area
  **and** a federal topic. This is keyword filtering, not an editorial judgment
  about relevance, and may produce no stories on some days.
- The same [Explore Austin feeds](../chat/explore/README.md) as the main map:
  Free & cheap, Movies, Live Music, Live Comedy, Pop up markets, Events &
  Festivals. The ticker loads the shared layer registry and date/expiry model,
  fetching only enabled categories. Times are Austin time, movies advance to
  their next future showing, and overlapping categories show an occurrence
  once. Separate occurrences and venues remain distinct. This replaces the old
  UT-only ticker calendar; UT public events are included through Explore.
- [National Weather Service](https://www.weather.gov/documentation/services-web-api):
  downtown Austin forecasts and active point alerts. Forecast periods are labeled
  as forecasts, not current observations. No key or paid plan required.
- [TradingView's free ticker widget](https://www.tradingview.com/widget-docs/widgets/tickers/ticker-tape/demos/compact/):
  TSLA (Austin), DELL (Round Rock), SLAB (Austin). Loaded only when stocks are
  expanded; attribution is preserved. Exchange delays/availability apply.
  Direct company quote links remain available if the embed is blocked.
- Realtor.com and Realty Austin listing **search links**, not individual MLS
  listings. City events, DriveTexas, and CapMetro links supply more local options.
- ESPN public scoreboards: Texas NFL, NBA, WNBA, MLB, NHL, MLS (Austin FC,
  FC Dallas, Houston Dynamo), and NWSL teams; Texas Division I college football
  (FBS/FCS), men's/women's basketball, and baseball. `sports.js` keeps an explicit
  Texas college list, so an opponent or an unrelated team called the Aggies does
  not accidentally qualify. ESPN's keyless endpoint is not a contracted API;
  league availability and upstream delays can vary. Attribution and game links
  accompany every score, with the Austin FC schedule as an evergreen fallback.

## Refreshing

`python3 tools/news/build-ticker.py` writes `ticker/feed.json` with Python's
standard library. `.github/workflows/build-ticker.yml` runs at minute 17 hourly
and can be run manually in Actions. No credentials beyond the repository's
built-in `GITHUB_TOKEN`; no paid APIs or new hosting.
The workflow uses Ubuntu 24.04 and Node 24 versions of checkout/setup-python,
with Python 3.12 for imports. It runs Python parser/failure tests and JavaScript
selection tests before publishing. X is deliberately not integrated: the owner
wants free sources and declined a separate paid X API dependency.

GitHub Actions commits made with `GITHUB_TOKEN` do not trigger Pages builds.
The client therefore reads both the deployed feed and the raw file on `main`,
then uses the newer valid snapshot. This keeps hourly updates independent of
site deployment. It checks every 15 minutes while the tab is visible. GitHub
can delay scheduled runs; an old snapshot is labeled as delayed in the panel.

News expires seven days after publication. Explore's existing three-hour Actions
job updates listings; this client checks selected feeds every five minutes and
when the tab becomes visible. It uses the newest valid deployed/raw-main copy,
retains a previous copy on transport failure, and labels delayed/unavailable
updates. The shared model removes expired entries and applies the chosen Austin
time window. The ticker rechecks dates every minute, including while paused.
Movie entries advance after a showing starts. Other events expire according to
their end/verification deadlines; unknown end times remain governed by Explore.
Missing/invalid dates and unsafe links are excluded. Failed sources retain only
unexpired items from their previous successful fetch. Total source failure fails
the workflow and preserves the previous file. The browser independently filters
expiration, so even a stopped workflow cannot keep stale stories indefinitely.
Weather is fetched directly from NWS every 15 minutes, accepts forecasts updated
within 24 hours, and removes expired periods/alerts. Link-only fallbacks remain
when data is unavailable.

Sports attempt direct ESPN updates every minute while visible, and on return to
the tab. Browser access can be blocked by ESPN, so `build-sports.mjs` also writes
`scores.json` on a 15-minute Actions schedule. The client reads the newest deployed
or raw-main snapshot and overlays direct results when available. Snapshot scores
say "In progress as of [time]", never LIVE, and expire after 30 minutes. GitHub
can delay these scheduled runs; this is not a guaranteed real-time feed. Yesterday's boards refresh every 15 minutes (every minute for a game still
in progress); default boards include today's games or the current football week.
Only games within the last three days or next seven days qualify. Live scores
expire after three minutes without refresh, other scores after 20 minutes. A
source-check time is displayed, and expired links are relabeled even if a reader
is keeping the ticker paused or focused. The rolling strip has up to 48 varied
items, rotating to another batch on a complete pass when more are available;
the expanded list contains all selected available items. Categories take turns,
and news publishers take turns within headlines/culture so one feed cannot
occupy every early news slot.

To adjust sources/categories, edit the builder and `ticker.js`. Bump the ticker
asset versions in `shell.js` and the shell version in all referring HTML files
(including `tools/page-template.html`) when changing the UI.

Checks: `python3 -m unittest discover -s tools/news -p 'test_*.py'` and
`node tools/news/test-ticker.cjs`. The model tests cover empty/sanitized
preferences, publisher balance/exclusion, legacy snapshots, safe URLs,
expiration, shared occurrence deduplication, venue distinction, Austin time
windows, and movie advancement. Python covers RSS structure, dates, promotion
filters, national relevance, and partial/total source failure retention.
