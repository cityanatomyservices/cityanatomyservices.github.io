# STATUS — cityanatomyservices.github.io (anatomy.city)

## 2026-09-10 — popups cut back to a name, two fields and two links

Owner: "let's make the pop-ups for all the maps much simpler, less formatting and
just the name, and 2 more fields on it so it is smaller, and add the links just
for Google and apple maps on the bottom and small buttons."

Done across all nine report maps — they share one `app.js`, so one edit covers
every one of them.

**What a popup is now:** the name, the first **two** populated fields from
`CONFIG.popupFields`, and small **Google** and **Apple** buttons. That is the
whole thing. It measures 127–230px wide and about 110px tall, against roughly
300×300 before.

**What went:**
- the **Info / Course App tab bar** — two tabs, one of which had nothing in it
  (`svContent` was an empty string, so the second tab opened a blank pane);
- every field past the second;
- the coloured **score badge** for `inspection_score`;
- the **Waze** and **Reddit** links;
- the rule under the title, the flexed label/value rows, and the full-width
  coloured link bar. A row now reads as one line — a small grey label in front of
  the value — and the links are small pills rather than four stretched buttons.

`switchPopupTab()` had nothing left to switch and is gone, along with the CSS for
the tabs, the panes and the badges.

Nothing is lost from the map: the rest of a place's detail is a row away in the
left panel, which shows every column.

Verified across all nine: exactly 2 field rows, exactly the two links in the
order Google then Apple, zero tabs, zero badges, no console errors.

Cache version `?v=20260910k`.

## 2026-09-10 — a data table on the left, one row per feature, click to fly

Owner: "add a data table on the left side for the data from the geojson with 1
row for each item with a marker, and when that line is clicked the map zooms to
that marker. the table is a panel that opens from the left."

**The panel slides in from the left over the map**, with the same chevron handle
riding on its edge. One row per feature in `data.geojson` — row counts match the
files exactly (46 / 5 / 5 / 20 / 17 / 8 / 18 / 8 / 9). Clicking a row flies the
map to that marker at zoom 15.5 and opens its popup.

**Almost none of this was new code.** `updateTable()` already built the rows and
already had the fly-to-and-popup click handler — it has been sitting there
guarded, returning early because there was no `#tableBody` on the page. Adding
the markup back switched it on. Two real changes:

1. **The marker no longer lands under the panel.** The click now passes
   `padding: { left: <panel width> }` to `flyTo`, so the place you picked ends up
   in the part of the map you can actually see. Without it, clicking a row flew
   the marker to a spot hidden behind the panel you clicked it in.
2. **Rows are one line, clipped with an ellipsis.** Letting the text wrap made a
   five-column row 200px tall — the panel showed three courses and you scrolled
   for the rest. All twenty fit on screen now. A row is a way *in* to a place,
   not the place itself: the full value is in the popup the row opens, and in the
   cell's tooltip (`td.title`).

The title still centres itself on whatever map is left beside the panel and
slides back when it closes. On a phone the panel takes 84% and the title stays
put behind it.

Still no filtering, as agreed — `buildFilters()` returns immediately because
there is no filter UI, so nothing is filtered out and every feature has a row.

Verified across all nine at 1280×800: rows match each `data.geojson` feature
count, headers built from `CONFIG.columns`, panel flush to the left edge, a row
click moves the centre and takes zoom from ~10.6 to 15.5 with a popup, no page
scroll in either direction, no console errors.

Cache version `?v=20260910j`.

## 2026-09-10 — a map, its data, and a title. Nothing else.

Owner: "let's remove all of the controls and have the title just as text on the
map along the top centered and the data from the geojson in the map."

`/apps/reports/<slug>/` is now three things. The whole page body is:

```html
<div class="page">
  <div id="map"></div>
  <h1 class="map-title" id="pageTitle"></h1>
</div>
```

**Every control is gone** — zoom, compass, geolocate, Satellite, Layers, Topo,
Buildings, 2D/3D, dark mode, ⓘ, Draw, Clear, Measure, Map PNG. Zero `<button>`
elements on the page.

**What went is the BUTTONS, not the map.** It still pans and zooms by hand, and
`data.geojson` is still on it: `addPlacesLayers()` and `applyFilters()` still run,
so every feature is plotted and the camera still fits to them.

**The attribution notice in the corner stays.** It is OpenStreetMap's licence
requirement, not a control.

Their initialisers are still in `app.js`, just not called — with a comment saying
so. Turning any one back on is one line in the init sequence, not a rewrite.

**The title** is plain text across the top, centred, no bar and no box, with
`pointer-events: none` so the map keeps the whole of itself. It is **dark ink
with a white halo, not white with a dark one**: the satellite and dark-mode
toggles are gone, so the pale street map is the only ground it ever sits on, and
white-on-pale was barely readable.

Verified across all nine at 1280×800: features plotted (12–103 each), title
centred to the pixel at the same top offset, **zero buttons**, attribution
present, map fills the viewport, no scroll in either direction, no console
errors.

Cache version `?v=20260910i`.

## 2026-09-10 — each report becomes just a map of its data

Owner, after two wrong turns of mine: "I don't want the reports recreated in the
middle I mispoke, I want the maps made of the data with the same mapping controls
once we have those done we will consider how to filter it" — and "you don't have
to rebuild them ... just make a map of the data that they are based on and add
the same map controls."

**`/apps/reports/<slug>/` is now a map and nothing else.** The map fills the page
and everything that remains floats on top of it:

- the data — every location plotted, nothing filtered out;
- the map controls, unchanged: Satellite, Layers, zoom / compass / geolocate,
  Topo, Buildings, 2D-3D, dark mode, and the ⓘ panel;
- the map tools: Draw, Clear, Measure, Map PNG, in a floating pill;
- a small title, so you can tell which map you are looking at in the carousel.

**Gone:** the block header, the footer, the side panel, its collapse handle, the
filters, the location table, Export CSV, and the Report modal. No page chrome
survives — nothing to scroll past.

**Filtering is deliberately not here yet** ("once we have those done we will
consider how to filter it"). The code that built it is not deleted, just
guarded: `buildFilters`, `buildTableHead`, `updateTable` and `updateCount` each
return early when their element is missing, so `applyFilters()` still does its
map-side work — it finds no filter selects, filters nothing, and every feature
stays on the map. Putting a filter UI back is adding markup, not rewriting logic.

`app.js`, `style.css` and `index.html` remain byte-identical across all nine
report folders (`index.html` differs only by its `<title>`).

Positioning bugs found and fixed along the way: `.toolbar` was never actually
positioned, so it sat as a static block across the top overlapping the title;
the draw bar's rail is `pointer-events: none` so the map keeps the gaps, which
left the buttons themselves dead until the pill took clicks back; a stale
`#map { height: 46vh }` in the phone block fought `inset: 0` and left the map
388px tall on a phone.

Verified at 1280×800 and 390×844 across all nine: the map fills the viewport,
six map controls present, the four map tools present, **no** table / filters /
count / panel / handle / report modal in the DOM, no page scroll in either
direction, no console errors. Golf's twenty course pins render as before.

Cache version `?v=20260910h`.

## 2026-09-10 — the report panel opens and closes; the header is just a title

Owner, clarifying the earlier ask: the side panel should "be opened and closed
with an arrow on the side"; and separately, "there shouldn't be a header and
stuff like in the reports, just the map and the controls and a title at top".

**The panel now collapses.** A handle rides on the panel's edge — a chevron in a
small tab, vertically centred — and slides with it, so it is always the thing
you reach for. Closed, the panel folds to nothing and the map takes the whole
row; the arrow flips to point back out. Below 900px the panel is stacked under
the map, so the handle becomes a full-width strip between them and the panel
closes upward instead of sideways. Filters, list and click-to-fly are unchanged.

**Getting MapLibre to follow it took three tries** and is worth writing down.
MapLibre sizes its canvas once and does not watch its container, so it has to be
told the box changed. Both obvious hooks resize exactly ONCE, at a moment that
turns out to be wrong:
1. `transitionend` — fired early on the way back OPEN; canvas stayed ~400px too
   wide with a blank strip down the side.
2. A `ResizeObserver` calling `map.resize()` inside its own callback — that trips
   the browser's resize-loop guard and notifications stop being delivered
   mid-slide. Same symptom: measured 1263px against an 870px box.

What works is following the whole animation: `map.resize()` on every animation
frame for 380ms after the click. A ResizeObserver is still there, deferred to the
next frame, for the window resizing and for this page being resized inside the
home page's window.

**The header is a title bar now.** It was a block: an eyebrow line above a 30px
title with a 3px rule under it, and a social-icon footer below everything. Both
are gone — what is left is the title and the ⓘ / 2D / theme controls in a 7px-tall
strip. The map gained 84px of height on a 800px screen, which matters most in the
small home-page window where every pixel it gives up is map.

`CONFIG.eyebrow` and `CONFIG.socialLinks` are no longer read; the config keys are
left alone.

**One near-miss worth recording:** the first attempt at removing the social-icon
code walked back from the `socialIcons` line to find its enclosing function and
found `init()` — deleting the app's entire startup routine, 94 lines, in every
report. Caught by reading the diff before committing. Restored from git and
redone as an exact-string removal of just that block.

Verified headless at 1280×800 and 390×844: the panel closes and reopens, the
canvas width matches the map box exactly both ways, aria-expanded and the label
flip, and there are no console errors. Full sweep re-run: nine map apps 200 with
rows populated, eight written reports 200 with word counts intact, home Reports
chip previewing the map app.

Cache version `?v=20260910g`.

## 2026-09-10 — story maps removed; report map apps get a side panel

Owner: "I like for the cards to advance the reports like that but I want to
change story maps that each shows to be more like the reports and get rid of the
story maps completely, I like the map and controls on the reports but want them
to have a side panel that has table data and filters there instead of being
underneath and I want those there instead of the story map."

### The map app is now two columns

The table and its filters used to sit **underneath** the map, so you scrolled
away from the map to read them. They are now a **side panel beside it** and both
are on screen at once. The map, its draw bar and every control are unchanged.

- `.page` is a flex column and `.app-body` the row, so the app is exactly one
  screen tall and **only the panel's list scrolls**. That matters because the app
  is now what plays inside the small window on the home page.
- **In the panel the table is not a table.** Four columns will not fit 380px —
  the first attempt sliced the last column clean off the edge. Each row now
  **stacks into a labelled record**: first column as the name, the rest as
  label/value lines. `app.js` puts the column header on each cell
  (`td.dataset.label`, a one-line change) and `style.css` draws it. Rows still
  click to fly the map. Nothing is cut off and nothing scrolls sideways. Fields
  that were invisible before — golf's PRICE, for one — are readable now.
- Below 900px the panel goes back under the map and the page scrolls normally.

`app.js`, `style.css` and `index.html` stay byte-identical across all nine report
folders (`index.html` differs only by its `<title>`); `template/` was edited and
copied out, and each title was preserved on the way.

### The story maps are gone, the writing is not

Deleted from all nine reports and the template: `storymap/index.html`,
`engine.js`, `ui.js`, `story.json`, `data/` — the cinematic scene player.

**Kept and moved up one level**, because the written reports are real work and
were only ever stored in that folder:
`{slug}/report.html` (8 of them, 1,310–6,267 words each), the toy-store report's
three images, and every `promo.mp4`. `template/report-template.html` was pulled
back out of the deleted folder too — the written-report build still needs it.

Everything that pointed into `storymap/` was repointed: `reports.json` hrefs →
`{slug}/report.html`; the eight reports' own "Story map →" nav links removed
(they had nowhere to go); `apps/reports/index.html` cards and seven hard-coded
links in `apps/index.html` → the map app; `content/report-videos/build.js` and
`GUIDE.md` → the new `promo.mp4` path; `apps/reports/CLAUDE.md` rewritten.

### The home page

Report cards now **play the map app in the window** instead of the story map;
clicking still opens the same app in its own window. The carousel behaviour from
earlier today is untouched — swipe the row, leftmost card drives the window.

Renamed while the story maps were going: `#storymap-frame` → `#app-window`,
`.storymap-nav-bar` → `.chip-bar`, `.storymap-nav` → `.chip-row`. Those names
described a thing that no longer exists.

### Verified headless

All nine map apps: 200, side panel on the right at x=896, rows populated
(5–46), no horizontal scroll, no console errors. All eight written reports: 200,
full word counts intact, zero remaining story-map links. Home page: Reports chip
renders 9 cards and previews `/apps/reports/austin-chambers/`; the swipe test
still walks the Apps row both directions. Responsive sweep re-run at twelve
sizes — still no scrollbars, footer on the bottom edge.

Cache version `?v=20260910f`.

## 2026-09-10 — the card row is now the control for the window

Owner: "can we have the middle section change by swiping the card? so whatever
card is in the 1st left position is what the middle section will be."

**One rule now governs the home page: whichever card is snapped to the LEFT EDGE
of the row is what plays in the window.** Swipe the row, two-finger scroll it, or
roll a wheel over it and the window follows. The leftmost card also takes the
`is-active` accent fill, so it is obvious which one is driving.

Clicking a card still opens its real web app in a new browser window. A swipe is
not a click, so the two never collide.

Three things had to change for "leftmost" to mean anything:

1. **Snapping.** `scroll-snap-type: x mandatory` on the row, `scroll-snap-align:
   start` on the cards, plus `scroll-padding-left: 16px` so a resting card keeps
   the row's gutter instead of sitting flush against the window edge. Snapping is
   what makes "leftmost" a definite answer rather than wherever a swipe stopped.
2. **The row has to actually overflow.** It didn't. Three 280px cards on a
   1280px screen fit with room to spare, so nothing could ever be swiped and the
   feature was dead on the desktop — the first test showed `scrollLeft` stuck at
   0. Cards are now `clamp(240px, 44%, 420px)`, a share of the row, so a slice of
   the next card always shows — that peek is what says "this swipes".
3. **Runway.** Even overflowing, three cards only gave a few dozen pixels of
   scroll — not enough for the last card to ever reach the left edge. The row now
   carries a trailing `::after` spacer of `100% - card - gap`, which is what lets
   the last card sit at the left and take the window.

**The demo reel now advances the ROW instead of the window** (`scrollToCard`, not
`show`). One thing decides what plays, so the row can never disagree with what is
on screen. The moment a visitor touches the row — pointer, touch, key or wheel —
the reel stops and the row is theirs.

The page never scrolls vertically, so a wheel over the card row would otherwise
be dead input; it is spent sideways instead, which is how a plain mouse moves the
row the way a finger does.

**Side effect worth knowing:** picking **Reports** now loads the first report's
story map into the window, where before it left the window alone. That follows
from the same rule and makes the Reports chip do something again — but say so if
you'd rather it stayed put.

Verified headless: leftmost card and window agree in both directions across all
three cards; clicking card 2 still opens `/1885murdertour/`; a wheel over the row
moved it 16 → 446 and the window followed; the reel advanced the row at 62s and
stopped dead after a touch. Re-ran the responsive sweep — twelve sizes from
1600×900 to 320×568, still zero vertical and zero horizontal scroll with the
footer on the bottom edge.

Cache version `?v=20260910e`.

## 2026-09-10 — the Moontower WebApp link was dead: an invisible overlay ate the click

Owner: "can you have the card on the animation map link to
https://anatomy.city/moontowertour/". It already did — the `href`, `target` and
text were all correct from the previous commit. **The link was simply not
clickable**, and the owner was reading the symptom exactly right.

**Cause: `#fallback`.** It is the "map data did not load" message, an
`inset: 0` overlay at `z-index: 3`, carrying the `hidden` attribute so it only
appears on failure. But the stylesheet said `#fallback { ... display: grid; }`,
and **a `display` rule in a stylesheet outranks what the `hidden` attribute
does**. So the overlay was never hidden at all — an empty, invisible, full-page
box sitting on top of everything and swallowing every click on the page.
`elementFromPoint` at the middle of the pill returned `DIV#fallback`, not the
link.

Fix: `[hidden] { display: none !important; }` — the same one-liner
`moontowertour/` and `1885murdertour/` already carry, which is why those two
were never affected. Checked all four map pages; `/moontower/` was the only one
with the bug.

This was not new. That overlay has been swallowing clicks on the demo page the
whole time, which is probably why nothing there ever seemed to respond.

Verified headless with real clicks: the pill opens
`https://anatomy.city/moontowertour/` in a new tab **both** from `/moontower/`
directly **and** from inside the home page's window — the case that matters,
since that is where the owner sees it. The home page's own Moontower card still
opens `/moontowertour/` too.

## 2026-09-10 — the Moontower demo loses its popups and gains the app link

Owner: "Remove all of the popups from the moontower animation and make the card
on there that says Moontower, change that Moontower WebApp and make it linked to
the https://anatomy.city/moontowertour/". This supersedes the earlier choice to
keep the story cards.

**`/moontower/` has no popups at all now.** `js/card.js` is deleted, the
`#story-card` element and every one of its CSS rules are gone, and the tour's
`onArrive` is an empty function. The demo is the moving map and nothing else:
the camera flies tower to tower, the lamps come on, the light pools spread.
Checked past two arrivals — nothing appears.

**The pill under the tagline is now the way into the real thing.** It was a
placeholder `href="#"` reading "Moontower"; it now reads **"Moontower WebApp"**
(the owner's own words) and links to `https://anatomy.city/moontowertour/`.
It carries `target="_blank"` deliberately — this page is embedded in the
anatomy.city home window, so without it the app would open inside that small
frame instead of a real window.

`moontower/index.html` loads its module as `js/main.js?v=20260910d`. That is not
decoration: `card.js` is gone, so a browser still holding the old `main.js`
would import a 404 and take the whole demo down. Bump it whenever main.js's
imports change; its own imports (`tour.js`, `map-bits.js`, `towers-3d.js`) are
unchanged and cache safely.

`js/tour.js` keeps `pin()` and `release()` — nothing on this page calls them,
but the file is shared with the interactive web app where clicking a tower does
pin it. Its comments now say so instead of describing a card this page no longer
has. `moontower/README.md` records all three divergences from
`MoonTowerTour/web` at the top, since a straight re-copy would undo them.

Verified headless: pill reads "Moontower WebApp" → `/moontowertour/`,
`target=_blank`; zero `#story-card` in the DOM after 16s of touring; the only
absolutely-positioned things left are the map canvas, the attribution control
and the hidden fallback. No console errors.

## 2026-09-10 — the home page fits one screen at every size

Owner: "Can you fix the footer, the site is not completely responsive for some
reason. Should resize without there needing to be a scroll bar on the right."

**One cause, both symptoms.** `.map-hero` had a fixed height — `flex: 0 0 65vh;
height: 65vh`. The other four bands are whatever they are, so the total never
matched the viewport:

- On a laptop it was too tall. At 1280×800 the parts came to 816px against
  800px of screen, so the page grew a **16px scrollbar** (27px at 1024×768,
  63px at 360×640) — the scrollbar on the right.
- On a tall screen it was too short. At 820×1180 the bands ended at 992px and
  the footer sat at 1109px, leaving a **117px dead band** above it — the footer
  problem.

**Fix:** the map window now takes the remainder instead of a fixed height
(`flex: 1 1 auto; min-height: 220px`), and `main` got `min-height: 0` so the
window is actually allowed to shrink — without it a flex child refuses to go
below its content size and the page grows a scrollbar anyway. Below 220px of
room there is genuinely no space and the page scrolls rather than squashing the
map to a sliver.

Also: `.report-cards` lost its `border-bottom`. The footer's own `border-top`
sits directly beneath it, and the two 1px rules together read as one thick
smudged line.

Verified headless at twelve sizes from 1600×900 down to 320×568: **zero vertical
scroll, zero horizontal scroll, and the footer's bottom edge exactly on the
viewport's bottom edge in every one.** `/apps/`, `/services/`, `/contact.html`
and `/apps/reports/` were checked for sideways overflow at the same twelve
widths — none.

Cache version `?v=20260910d`.

## 2026-09-10 — the original day design is back; the theme button was backwards

Owner: "The buttons seem backward and now the whole page has a glow. I just want
the day to look like it did before you changed it to the dark (which I didn't
ask for...)."

Both correct, and the second one was bigger than a palette. **`c6046fc`
(2026-09-09, "night palette") changed the whole design, not just the colours** —
it also swapped the typography to Georgia serif throughout, dropped every font
weight to 400, replaced the topbar's drop shadow with a glow, put a
`text-shadow: 0 0 18px` glow on the wordmark, turned the map window's 6px top
gradient into a page-wide `inset 0 0 80px 20px` vignette, and added glows to the
active chip, the active card and the social icons. Restoring the tokens alone
(my earlier fix) left all of that in place, which is the glow the owner saw.

**`style.css` is now `git show c6046fc^:style.css` verbatim** — the stylesheet
as it was before that commit — plus exactly two additions: `color-scheme` on
each palette block (so scrollbars and form controls follow the theme), and the
comment at the top saying why. Nothing else. That was safe because only three
selectors had been added to the file since, and all three belonged to the night
styling being removed. So the day page is the **exact** design it was: Helvetica
body, Poppins headings at weight 700, real drop shadows, no glow anywhere, and
the original `#0067c5` blue.

The dark option is the site's OWN original dark theme, which was already in that
file (`:root[data-theme='dark']`, `#0e1117` / `#4cc3ff`) — not the Moontower
one. Day is still the default; night is only ever chosen.

**The button was backwards.** It showed the theme you were already in, so the
day page said "Light" and clicking it gave you dark. It now says where a click
will take you: 🌙 Dark on the day page, ☀️ Light on the night page.

Cache version bumped to `?v=20260910c`.

Verified headless with the browser set to dark: day loads by default at
`rgb(245,247,250)` with Helvetica, no wordmark text-shadow and no vignette on
`.map-hero::after`, offering "🌙 Dark"; the click gives `rgb(14,17,23)` offering
"☀️ Light"; back again. No console errors.

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
