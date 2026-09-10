# STATUS — cityanatomyservices.github.io (anatomy.city)

## 2026-09-09 — site moved here from loraatx/loraatx.github.io

The City Anatomy site (anatomy.city) now lives in this repo under the
cityanatomyservices GitHub account, with the full git history copied over
(641 commits). Nothing in the site itself changed.

What was done, in order:

1. The old `cityanatomyservices.github.io` repo (austin.chat) was renamed to
   `austin-chat-archive`, its Pages disabled, and the repo archived on GitHub.
   Local folder: `C:\Dev\projects\cityanatomyservices\austin-chat-archive`.
   austin.chat no longer resolves to a site (owner: not needed).
2. `loraatx/loraatx.github.io` was renamed to `loraatx-site-archive`, its
   Pages disabled, and the CNAME file removed so the domain could be claimed
   here. Local folder: `C:\Dev\projects\loraatx\loraatx-site-archive`.
   GitHub redirects the old repo URL to the new name.
3. This repo was created, the site pushed, GitHub Pages enabled from `main`
   at `/`, custom domain `anatomy.city`.

DNS did not change: anatomy.city is proxied by Cloudflare, which forwards to
GitHub Pages. GitHub picks the repo by the `CNAME` file, so keep that file.

## Supabase — the site uses only the paid cityanatomyservices project (2026-09-09)

Owner's rule: the paid Supabase account (org `cityanatomyservices`) is the only
one that matters. It holds project **`aqbyxpiwugcvoephsvpm` ("parcels")** —
the parcel database shared with WhatCanIBuildHere (`austingraph/austingraph.github.io`)
and the CityAnatomyAustin container app — plus the "Pubber" project.

Before the move the site pointed at `tqnklodtiithbsxxyycp`, a project on the
FREE account (the austin.chat one). It held a small copy of the parcel data,
two custom RPCs and its own PMTiles file. That dependency is gone:

- `/parcels/` now reads the paid project: `parcels_public` view (anon-readable),
  PMTiles `tiles/parcels.pmtiles` (source layer `parcels`), and two RPCs.
- The two RPCs and the `austin_zoning_rules` lookup table were ADDED to the
  paid project from `scripts/sql/` (`get_parcel_constraints.sql`,
  `search_parcels.sql`, `austin_zoning_rules.sql`). They are the only objects
  this repo owns there. Re-apply by pasting a file into the SQL editor.
  Schema mapping: old `parcels.zoning` = new `zoning_base`; old
  `zoning_overlay` = `zoning_ztype` when it differs from the base district.
- The parcel tables themselves belong to the austingraph repo. **Never run
  this repo's loader SQL (`scripts/*.sql`, `scripts/sql/load_*`,
  `spatial_join_zoning.sql`, `zoning_stage_to_final.sql`) against the paid
  project** — they alter and update `parcels`. They were the free project's
  pipeline and are kept only as history. The three workflows that ran them
  (`build-parcels-pmtiles`, `load-zoning`, weekly `refresh-lists`) were
  deleted for the same reason. **No Actions secrets are needed** — the two
  remaining Remotion render workflows use none.
- `apps/chats/*` (the three austin.chat maps) and their ChatMaps cards on
  `/apps/` were REMOVED 2026-09-09 (owner: "the function is over"). The site
  now has no dependency on the free account at all. Note for the owner: the
  `/apps/` hero lede still says "live chat experiences" — owner copy, not
  touched.

The free project (`tqnklodtiithbsxxyycp`) can be deleted whenever the owner
likes: its austin.chat tables are all EMPTY (checked 2026-09-09), and its
parcel copy is superseded. The austin.chat data the owner is keeping — the
1,202 curated geofences — lives in git in the archived repo
`cityanatomyservices/austin-chat-archive` (`data/`) and in the GIS library
(`C:\GISData\austin\places.gpkg`, GeoJSON in `C:\GISData\derived\`).
The austin.chat domain stays registered but points at nothing.

## Home page — 2026-09-09 (owner: "make it look cooler", same basic layout)

Same skeleton as before: top bar, map window, chip row, card row, footer.
What changed:

- **The window plays the Moontower map** by default. `moontower/` is a COPY
  of `MoonTowerTour/web` (see `moontower/README.md` for the refresh recipe)
  so anatomy.city does not depend on austin1885.city. It self-tours; nothing
  waits for the visitor.
- **Chips = products, cards = their pages**, all from `home.json`
  (`home.js` renders it). Picking a card loads its page in the window. Every
  visible string is the owner's: module names/blurbs from
  `CityAnatomyAustin/src/content/copy.ts`, page titles from each page's
  `<title>`. Add a product or page by editing `home.json` only.
- **One palette, no light/dark toggle.** `style.css` `:root` now carries the
  Moontower night tokens (ink / paper / arc-light) and Georgia serif, so the
  window and the page match. The toggle button on the other pages is hidden
  by CSS; `page.js` still runs the mobile nav.
- **Footer links are real** (TikTok, X, Substack, Patreon from
  `docs/BRAND.md`). YouTube has no URL in the brand table yet, so no icon.
  No Play Store button until the listing is live.
- **Reports are off the home page** (owner: "I don't care about the
  reports"). They still exist: one folder per report under `apps/reports/`,
  listed at https://anatomy.city/apps/ and https://anatomy.city/apps/reports/.
  The old home-page loader read `apps/reports/reports.json`.

Owner copy flags: `/apps/` hero lede still mentions "live chat experiences".

## News Feed chip — map-based news, built 2026-09-09

Owner: "rethink the old feeds as a map-based news feed for this site",
"rewrite it in JS, use those four outlets". The old feeds were two Actions in
the austin.chat repo (daily feed + nightly Palmer Events scrape); they ran
fine but had placeholder lanes, no locations, and stopped when that repo was
archived today.

Now: `tools/news/build-feed.js` (Node, no dependencies) reads KUT, KXAN,
Austin Monitor, Community Impact RSS, pins each story on a known Austin
place (`tools/news/gazetteer.json`, generated from the austin.chat places +
`landmarks.json`), writes `news/feed.geojson`. `.github/workflows/build-news-feed.yml`
runs it daily at 06:00 Austin and commits; first run succeeded. `news/`
is the page (Moontower basemap, pins + story list); the News Feed chip
loads it in the window (a chip can carry its own `src` in `home.json`).
Details in `news/README.md`. First build: 41 stories, 25 pinned.

Known: Austin Monitor's RSS is stale since 2025-11 (kept, fail-soft);
KUT's news.rss only carries ~10 items. Research into more sources
(city government, planning, real estate, geolocated open data) was run
2026-09-09 — see `docs/NEWS-SOURCES.md` once written.

## Push token — fixed 2026-09-09

The `cityanatomyservices` gh login now has the `workflow` scope, and the full
history (645 commits) is on GitHub main. Nothing is open for this repo.
Push from a non-active account with:

```
git -c credential.helper= -c credential.helper='!f(){ echo username=cityanatomyservices; echo "password=$(gh auth token --user cityanatomyservices)"; }; f' push origin main
```
