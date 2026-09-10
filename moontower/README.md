# moontower/ — COPY of MoonTowerTour/web (source of truth)

**This copy has DIVERGED on purpose (owner, 2026-09-10) — a straight re-copy would undo it.**
This page is a **demonstration** shown in the anatomy.city home window: it self-tours and that is
all — **no popups, nothing to click**. Three deliberate differences from the source:

1. `js/main.js` — the `map.on('click')` tower pin/release handler is gone (the map was already
   `interactive: false`). `js/tour.js` still carries `pin()`/`release()` because it is shared with
   the web app, but nothing here calls them.
2. **There is no story card at all** (owner, 2026-09-10: "Remove all of the popups"). `js/card.js`
   is DELETED, the `#story-card` element and every one of its CSS rules are gone, and the tour's
   `onArrive` is an empty function. The demo is the moving map and nothing else.
3. `index.html` — the pill under the tagline (`#app-link`) is the owner's own text, **"Moontower
   WebApp"**, linking to `https://anatomy.city/moontowertour/` with `target="_blank"`. It was a
   placeholder `href="#"` reading "Moontower". The `_blank` matters: this page is embedded in the
   anatomy.city home window, and without it the app would open inside that small frame.

Re-copy from the source only if you re-apply all three, or the demo grows popups again.

---

Copied 2026-09-09 from `/mnt/c/Dev/projects/atxmapdata/MoonTowerTour/web` so anatomy.city does not depend on austin1885.city. To refresh: re-copy that folder over this one (`cp -r .../MoonTowerTour/web/. moontower/`). Never hand-edit `vendor/` here either.

# web/ — the Moontower page

A self-touring page for austin1885.city's sibling app. It opens on the dark
`arclight-1895` map and flies tower to tower on its own, striking each alight as
it arrives, so the city fills with light over one round. Nothing waits for the
visitor. Clicking a tower pins it (holds the card, pauses the tour); clicking
empty map lets the tour go on. Modelled on the Austin 1885 front page.

## Run it locally
ES modules need a real server — `file://` will not work:

    cd web && python3 -m http.server 8099
    # then open http://localhost:8099/index.html

## Files
- `index.html` — markup and all styling; palette tokens mirror `map/style/PALETTE.md`
- `js/main.js` — wiring only
- `js/tour.js` — the self-driving tour (order, dwell, lighting, pin/release)
- `js/card.js` — the story card; **adds no prose**, only field labels
- `js/map-bits.js` — geodesic circles and the three GeoJSON sources the style expects
- `js/towers-3d.js` — the Blender tower, standing at all 17 sites (see below)
- `vendor/` — **generated copies, never hand-edit.** Refresh with `node scripts/sync-web.js`
  after `npm run theme:build` or any change to `data/locations.js` / `data/routes.js`.
  That script also copies in `moontower.glb` and bundles `three.bundle.js`
  (three.js + GLTFLoader, from `node_modules`, so the page works offline).

## Pacing
Each tower gets a **fixed 3s flight + 7s dwell**, so a full 17-tower round is about
135 seconds. The flight duration is deliberately fixed rather than set by MapLibre's
`speed`: with `speed`, flight time scales with distance and the cross-town hops crawled,
stretching one round to roughly ten minutes.

## The lean
The camera **travels flat and arrives tilted**. Landing on a tower it eases to
`PITCH` (50°) over 1.4s as the lamp is struck, so the tower rises out of the map
instead of sitting flat on it; the outbound flight sets pitch back to 0, standing
the camera up over the 3s hop. The lean belongs to the tower being visited, never
to the empty city in between. A tower you click and pin is held tilted too.

Both dials are at the top of `js/tour.js` (`PITCH`, `TILT_MS`). Note the trade-off:
tilting spreads the illumination circle of the tower you are parked on across more
screen, so it reads a little softer than the compressed halos of towers further up
the frame. Drop `PITCH` if that bothers you.

## Trails
The walking/biking trails are drawn once on load from `vendor/routes.js` — the same
lines the app follows, as a **static** layer that never changes during the tour. The
style already carried six route layers (foot / bike / bike-on-street, each with a
glow, connectors dimmed) over an empty `routes` source; `drawTrails()` in `js/main.js`
just hands them their data. They sit below the light pools and the towers, so a tower
coming alight still reads on top of them.

## The towers themselves
The 17 towers are 3D objects drawn **inside MapLibre's own WebGL context** as a
custom layer, not on a second canvas over the top. There is still one canvas on the
page and MapLibre still owns it; the towers live in the map's 3D space, so they keep
correct perspective, lean with the camera and land in the right place at every zoom
for free. `js/towers-3d.js`.

This is what the lean was always for. The camera eases to 50° on arrival so the tower
"rises out of the map instead of sitting flat on it" — until now there was no tower
there to rise.

They are added **on top of** the existing 2D dots and light pools, not instead of them:
the dot marks the exact corner at any zoom, the pool is the light, the model is the
tower. A tower is struck alight from the same `lit` set that drives the 2D layers, in
the same `redraw()` — its lamps come on and its steel goes from a faint glow to a hard
one, so a lit tower reads from across the map.

### Why this is not the Blender model
It was, first — `assets/3d/moontower.glb`, the real open steel lattice, the same model
the app's splash screen uses. On the map it disappeared, for reasons of arithmetic
rather than taste. At the tour's parked zoom of 15.4, one pixel is about **3.1 m**. A
real tower is 47.5 m tall and 3.9 m wide, so it lands **15 px tall and one pixel
wide**. Scale it up 3x for a readable height and the shaft is still under 2 px: a tall
thin spike, too tall and barely visible, which is exactly how it looked.

A lattice is holes held together by thin steel; below a few pixels the steel vanishes
and only the holes are left. So at map scale the tower stops being a model and becomes
a **symbol** — the same reason a road is drawn far wider than its true width, because
at true width nobody could see the road.

The tower is therefore built from three primitives in code, sized in metres so you can
still reason about it. Three passes were needed on the silhouette: a crown platform
wider than everything else read as a **hammer**, a lump on a stick; a hard-tapered
spire glowing all over when lit read as a **cone**, a Christmas tree. What works is a
**slim mast of constant width** carrying a ring of lights wider than itself, with the
glow confined to the top — the tower is a stalk, the light belongs to the crown. The
map's own illumination circles already show how far that light reaches, so the tower
does not need to shout.

The falloff is an **emissiveMap**: a one-pixel strip, black at the bottom and white at
the top, multiplying the mast's emissive colour per texel so the arc light spills down
from the crown and dies out a third of the way, the way it does in the Blender render.
A cylinder's UVs run v=0 at the bottom to v=1 at the top, and three.js flips textures
vertically by default, so the canvas is drawn black-at-bottom to land black at the
mast's feet.

Bringing the detailed model back is a small job if it is ever wanted: add GLTFLoader to
the bundle and the `.glb` to the copy list in `scripts/sync-web.js`. It is worth it only
at zooms far closer than the tour uses.

### The dials
All at the top of `js/towers-3d.js`, all in metres, with the true value noted beside
each one that departs from it:

- `SCALE_MULTIPLIER` (2.0) — blows the whole tower up. With the widening below, this is
  the only untrue thing on the page. **Set it to 1 to see the truth**: the towers will
  be there, just very small.
- `SHAFT_W_M` (5, true ~3.9) — the mast, a constant width top to bottom.
- `CROWN_W_M` / `CROWN_H_M`, `LAMP_RING_M` / `LAMP_R_M` — the crown and its ring of lamps.
  The lamp ring is the widest thing on the tower, deliberately.
- `SHAFT_DARK` / `SHAFT_LIT`, `CROWN_DARK` / `CROWN_LIT`, `LAMP_DARK` / `LAMP_LIT` — how
  hard each part glows in each state. Unlit, the mast has no glow at all and is simply
  steel picked out by the moonlight; the colour stops in `topGlowTexture()` control how
  far down the lit glow reaches.

`vendor/three.bundle.js` is core three.js only (no GLTFLoader), bundled from
`node_modules` by `scripts/sync-web.js` so the page works offline and stays pinned to
the same three the app uses.

## Recording it as a video
Same rig and procedure as the sibling site — see
`../../austin1885/austin-1885/docs/site-tour-recording.md`. The only difference is that
this page needs the local server running, so point the kiosk at
`http://localhost:8099/index.html` instead of a public URL. Run one lap before recording
so the map tiles are cached, then restart the kiosk so the take begins at tower 1.
First recording: 2026-08-29, `C:\Dev\map-exports\moontower-site\` (155s, 1920x1080, silent).

## Copy rules
All prose on this page is the owner's:
- Stop text comes from `data/locations.js` (`title`, `corner`, `erected`, `site_1895`, `site_today`).
- The title `MOONTOWER` is taken from the app splash (`src/ui/splash-intro.tsx`).
- The one-line tagline is lifted **verbatim** from this repo's `README.md`.

Nothing here invents sentences. Per `src/data/stops.json`, the page also makes no
claim about how many towers stand — that number changes.

## Open
- The store link in `index.html` (`#app-link`) is a placeholder `href="#"` until the
  Play listing URL is supplied.
- No per-tower imagery exists yet (`images` is empty for all 17). The card's media
  slot is wired and will render the first image the moment one is added.
