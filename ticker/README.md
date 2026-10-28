# Austin now

The shared `shell.js` loads a 42px ticker immediately above the footer on
Austin.chat's framed pages. Click **Austin now** or the up arrow to browse,
filter by category, or expand the Austin-area stock quotes. All item links
open a new tab. The ticker pauses on hover, focus, touch, or its pause button;
reduced-motion users start paused. The manual pause preference is remembered.

## Sources

- KUT Austin, housing, and transportation RSS; KXAN Austin RSS; City of Austin
  releases. Titles, links, source names, and dates only; no full article copies.
- Texas Tribune RSS, limited to three stories that mention the Austin area
  **and** a federal topic. This is keyword filtering, not an editorial judgment
  about relevance, and may produce no stories on some days.
- UT Austin's public Localist calendar API: upcoming in-person events located
  in Austin and tagged General Public. Check each organizer's admission details.
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

GitHub Actions commits made with `GITHUB_TOKEN` do not trigger Pages builds.
The client therefore reads both the deployed feed and the raw file on `main`,
then uses the newer valid snapshot. This keeps hourly updates independent of
site deployment. It checks every 15 minutes while the tab is visible. GitHub
can delay scheduled runs; an old snapshot is labeled as delayed in the panel.

News expires seven days after publication; events expire at their start time.
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
is keeping the ticker paused or focused. The rolling strip has up to 28 varied
items; the expanded list contains all available items.

To adjust sources/categories, edit the builder and `ticker.js`. Bump the ticker
asset versions in `shell.js` and the shell version in all referring HTML files
(including `tools/page-template.html`) when changing the UI.
