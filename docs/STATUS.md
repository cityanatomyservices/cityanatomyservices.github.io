# STATUS — cityanatomyservices.github.io (anatomy.city)

## 2026-09-10 — News Feed off the home page; the site is a holder for the web apps

Owner: "Lets remove the news feed button and that page in the carrosel, I want
to keep the list for some way to update myself but I don't think people will
use that, I want this site more to be a holder for webapps that I have mostly
already built."

- **The News Feed chip is gone** from `home.json`, so the chip row is now
  Apps / Reports / Media / Services.
- **The page opens on Apps**, which starts the demo reel straight away
  (`"open": true` moved to the Apps chip). `index.html`'s iframe default src is
  `/moontower/` instead of `/news/`, so the first painted frame is already the
  demo rather than a news map that then gets replaced.
- **Nothing about the news feed was deleted.** The daily Action
  (`.github/workflows/build-news-feed.yml`) still rebuilds `news/feed.geojson`
  every morning and the page is still live at **https://anatomy.city/news/** —
  it is just not advertised on the home page. `news/README.md` says so at the
  top, along with how to put the chip back (a `"src": "/news/"` chip with no
  cards — a data edit, no code).
- `home.js`'s "a chip with its own src and no cards is a page in itself" branch
  is now unused but kept: it is the mechanism for putting any page back on the
  home page without writing code, which is the whole point of `home.json`.
- Cache version bumped to `?v=20260910b` on all 16 references.

Verified headless: chips are Apps/Reports/Media/Services, Apps is active on
load, the window opens on `/moontower/`, the three app cards render, and
`/news/` visited directly still lists its 102 stories. No console errors.

**Still open, and worth a decision:** the **Media** and **Services** chips have
no cards, so picking either shows an empty row under the window. If the site is
a holder for the web apps, those two either need cards or should come out the
same way the News Feed chip did.

## 2026-09-10 (fix) — day is the default, and the button is findable

Owner: "I'm not seeing the light/dark button, I do want it to default to light
but also want a dark option." The button WAS live and rendering — checked
against anatomy.city directly, all three files deployed. Two real causes:

1. **The browser was serving the previous `style.css`,** the one that still
   carried `display:none !important` on `.theme-toggle`. GitHub Pages caches
   these files hard. **Fixed properly: `/style.css`, `/page.js` and `/home.js`
   are now referenced with `?v=20260910` on all eight pages that use them, and
   `CLAUDE.md` says to bump that number on every push that touches them.** Each
   report folder's own `style.css` keeps its separate `?v=` — untouched.
2. **At night the button was nearly invisible** — `var(--surface)` on a bar
   painted from the same `--surface`, with a faint `--border`. It now carries
   the accent on its edge, its label and a 12% tint of its background, becomes
   solid accent on hover, and is a pill in small caps. Reads on either ground.

**Day is now the default.** The palette blocks were swapped rather than
patched: the day tokens live on bare `:root` (so the first painted frame is
already light — no flash) and night is `:root[data-theme="dark"]`, restating
the same eleven tokens. `page.js` no longer consults
`prefers-color-scheme` at all: `storedTheme === 'dark' ? 'dark' : 'light'`, so
an unvisited page is always day whatever the machine says, and night is only
ever a choice the visitor made. The choice is still remembered in localStorage.

Verified headless with the browser set to dark: first visit lands
`data-theme="light"`, `rgb(245,247,250)`; the button flips it to
`rgb(11,15,20)`; the choice survives a reload both ways and carries to
`/apps/`. No console errors.

## 2026-09-10 (later still) — day/night button, cards launch the apps, demos go quiet

Four owner changes.

**1. Day / night button, top right of the header.** All the machinery was
already there and had been switched off on 2026-09-09: the markup existed on
six pages, `page.js` still ran the toggle and remembered the choice in
localStorage, and `style.css` killed the button with `display:none !important`.
Now: the button is back (and added to `index.html`, which never had one — all
seven header pages carry it), the `.theme-toggle-unused` styles are `.theme-toggle`
again, and `style.css` has a **day palette** under `:root[data-theme="light"]`
— the same eleven tokens lit, with the accent darkened to `#0067c5` so it holds
on white. Night stays the `:root` default. With nothing stored the page follows
the machine's setting, so a light-mode visitor now lands on the day palette.
The map window is always a night map, so on the day palette it gets a rim
instead of dissolving into the white.

**2. App cards open the web apps.** A card is now a link: clicking one opens
its `app` in a new browser window (`/moontowertour/`, `/1885murdertour/`,
`/parcels/`, and each report's map app). It no longer swaps the preview in the
map window, so the small ↗ is gone — the whole card is the ↗ now, and its CSS
went with it. A card with no `app` still previews in the window, as before.

**3. The window plays a demo reel.** Since cards no longer drive it, a chip
marked `cycle: true` in `home.json` runs through its `demo: true` cards in
turn, each holding the window for `demoMs` (60 s each for the two tours) before
the next. So Apps shows the Moontower animation, then the 1885 lantern, and
loops. Leaving the chip stops the reel; hand-picking a non-app card stops it too.
Verified over a real 123 s run: Moontower → 1885 → Moontower, and it stops dead
when another chip is picked.

**4. Both demos are animations now — nothing in them responds to a click.**
Owner kept the story cards (they open themselves as part of the show); what
went is every hand-driven control.
- `moontower/` — the `map.on('click')` tower pin/release is gone (the map was
  already `interactive: false`). With nothing clickable the "Read more" fold
  could never be opened, so the card always carries `.open` and shows the whole
  stop; the button, its label and its CSS are removed. **This copy has now
  DIVERGED from `MoonTowerTour/web` on purpose** — `moontower/README.md` says so
  at the top, because a straight re-copy would undo it.
- The 1885 lantern is on austin1885.city, a different repo, and it is a live
  product the Play app links to — so it was NOT made non-interactive. It gained
  a **`?demo=1` mode** instead (`Austin1885/austin1885.github.io`, commit below):
  no click-to-pin, no zoom buttons, no wheel zoom; the lantern still tours and
  the cards still open themselves. `home.json` embeds
  `https://austin1885.city/annihilatortour/?demo=1`. Plain `/annihilatortour/`
  is untouched.

Verified headless (Playwright, 1280×800): toggle flips `rgb(11,15,20)` ↔
`rgb(245,247,250)` and back and writes `data-theme`; all three Apps cards render
as `<a target="_blank">` to their apps with zero ↗ arrows left; the Moontower
demo's card opens itself with no fold button and does not change when the map is
clicked; `?demo=1` hides the lantern's zoom UI while plain `/annihilatortour/`
still shows it. No console errors on any page.

**Owner to check:** whether landing in day mode (when the machine is set light)
is what you want, or whether the site should always open at night with the
button as the only way into day. And 60 s per demo is a dial in `home.json`
(`demoMs`) — a full Moontower round is about 135 s, so at 60 s the reel moves on
partway through.

## 2026-09-10 (later) — the site gets its own palette; Moontower drift cut

Owner: the site had come to look like the Moontower app, and "I have had an
issue with drift from that project ... that seems like too much of an
influence." Investigated where the pull came from and fixed three things.

**Where it came from.** Nothing instructed it. Moontower is simply the oldest
and most finished product in the workspace, so every session reaching for
"what should this look like" found it first — and each copy got written into a
STATUS file as precedent, which made the next session do it again. On
2026-09-09 the home window was set to play the Moontower map; because that map
is dark, the page around it was made dark too, and `style.css` was given the
Moontower tokens verbatim (the old comment said so). From there the palette
reached every page on the site.

**1. The rule, so it stops recurring.** `C:\Dev\CLAUDE.md` now carries
"Moontower is one module, not the house style": what is shared is the engine
and only the engine (`webtour/`, the kit / container-app code) — no palette,
no basemap style, no typography, no product identity travels with an engine,
and no non-Moontower surface reads files out of a `moontower*` folder.

**2. The News Feed is decoupled.** `news/index.html` was loading
`../moontower/vendor/arclight-1895.style.js` — an Austin news map wearing the
Moontower tour's 1895 cartography, carrying the tour's `towers`,
`illumination` and `routes` sources and their 13 layers. The news map now has
its own `news/vendor/basemap.style.js` (`window.NEWS_BASEMAP_STYLE`, 99
layers, 2 sources): started as a copy of that cartography with the tour layers
stripped and the ground set to the site ink, and it is the news map's to
change from here. Nothing outside `moontower/` reads `moontower/vendor/` now.

**3. The site palette is the site's own.** `style.css` `:root` is no longer
the Moontower tokens. It stays night-toned (the home window always holds a
dark map) but the hue is the site's own blue — `--accent: #4cc3ff`, the accent
anatomy.city used before 2026-09-09 — on a neutral ink `#0b0f14`. Every colour
on the site still flows from those 11 tokens, so the accent is one line to
change if the owner wants a different one; there is no City Anatomy brand
colour written down anywhere (`CityAnatomyAustin/docs/BRAND.md` is links only),
so this is a restoration, not an invented brand.

The tour apps were already clean — `moontowertour/vendor/` and
`1885murdertour/vendor/` each carry their own day/night styles and keep their
own looks. Only the site chrome and the news map changed.

Verified headless (Playwright, 1280x800): `/`, `/news/` and `/apps/` load with
zero console errors, body ground `rgb(11,15,20)` on all three; the generated
news style parses, 99 layers, no layer pointing at a missing source.

**Owner to decide:** whether `#4cc3ff` is the accent they want, and whether the
news basemap should stay this dark night cartography at all now that it is
free to diverge from the tour.

## 2026-09-10 — anatomy.city IS the app for now: tour web apps + home rewire

Owner: "Until we get the react native app tested and approved I want to
treat anatomy.city like a webapp version of what the react native app will
eventually be." Apps open in their own browser window, full screen, with
only what an app would show (no site header/footer); nobody uses them from
the front page. Built today:

- **`/1885murdertour/`** — the Servant Girl Murder tour module as a web app
  (map, geofences, verified "I'm here", card, story page, picker, distance,
  credits). **`/moontowertour/`** — the Moontower module as a web app (pools
  of light, the carbon-arc strike, honest ✦ visits, follow-me camera,
  hold-to-reset). Both: plain ES modules, no build, MapLibre GL JS 5 from
  unpkg, the app's own style JSON verbatim over OpenFreeMap tiles (no key).
  Each folder has a README; the shared engine is **`webtour/`** (its README
  is the overview). Every label is lifted verbatim from the phone app's
  screens into each app's `js/copy.js`; no copy was written.
- **Data**: `node tools/sync-webapps.js` copies the app's generated module
  data (`CityAnatomyAustin/src/modules/<id>/data/*`) into each app's
  `vendor/` as window globals. Re-run after any data or style change in the
  app, then commit. Never hand-edit `vendor/`.
- **Home page**: the window opens on the **News Feed** map (`open: true` on
  the chip in `home.json`; iframe default `/news/`). The Apps carousel
  keeps the animated Moontower (`/moontower/`) and the austin1885.city
  lantern map as window previews; each card now has a small **↗** that opens
  the real app (`app` field) in a new window. Reports cards preview the
  story map and their ↗ opens the report's own MapLibre map app at
  `/apps/reports/<id>/` — those map apps existed for every report but were
  linked from nowhere on the home page. `PoolOpenings` was missing from
  `apps/reports/reports.json`; added (strings taken from `apps/index.html`;
  its eyebrow "Austin Parks · Report" follows the pattern of the others —
  owner may change). `/apps/index.html` still omits the toy-store map app and
  the vintage-guitar map app; not touched.
- Cleanup: 45 `*.out` fetch dumps committed by accident with the news-feed
  research on 2026-09-09 removed; `*.out` ignored.
- Verified headless (Playwright, phone + desktop): both apps load without
  errors, picker flight → card → I'm here / strike → progress persisted;
  home opens on the news map, Apps/Reports cards carry the right ↗ links.
  Screenshots in `C:\Dev\temp\webapps\`. Real-phone GPS is untested
  (needs the live https site).

Owner to check on a phone: geolocation prompt on ◎, the strike on
`/moontowertour/`, "I'm here" at a real site on `/1885murdertour/`.

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

Same day, later: the source research (4 agents) is in `docs/NEWS-SOURCES.md`
and its top feeds went into `outlets.json` — 22 feeds now (Austin Monitor
became austincurrent.org; City of Austin, council, KUT Austin, Community
Impact topic feeds, CRE trade press). Build: 116 stories, 48 pinned.
Next step if wanted: an exact-pin layer from the geolocated city datasets
listed in NEWS-SOURCES.md §3 (zoning cases first).

## PICK UP HERE — 2026-09-10 (older items from 2026-09-09 below)

0. Phone test of `/moontowertour/` and `/1885murdertour/` on the live site
   (see the 2026-09-10 section at the top). Then: should the tour web apps
   also link from `/apps/`? Not done — owner call.

## Older — 2026-09-09, owner shut down mid-session

1. **Moontower story card on phones: owner says the "Read more" fold "doesn't
   work well"** (no detail yet — ask what they saw before touching it).
   The fold lives in `moontower/js/card.js` + the phone media query in
   `moontower/index.html`; source of truth is `MoonTowerTour/web/`, and the
   same copy is deployed at `austin1885.github.io/moontowertour/`. Fix in
   the source, then re-copy to both.
2. Owner to check in a real browser: News Feed chip (/news/), Reports chip
   (story maps in the window), Media and Services chips still empty.
3. Free Supabase account: owner may keep it (free) or delete it; nothing
   depends on it.
4. Optional next for the news map: an exact-pin layer from the geolocated
   city datasets in `docs/NEWS-SOURCES.md` §3 (zoning cases first).

## Push token — fixed 2026-09-09

The `cityanatomyservices` gh login now has the `workflow` scope, and the full
history (645 commits) is on GitHub main. Nothing is open for this repo.
Push from a non-active account with:

```
git -c credential.helper= -c credential.helper='!f(){ echo username=cityanatomyservices; echo "password=$(gh auth token --user cityanatomyservices)"; }; f' push origin main
```
