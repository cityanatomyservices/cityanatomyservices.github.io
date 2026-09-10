# webtour/ — the shared engine behind the tour web apps

The tour web apps on this site (`/moontowertour/`, `/1885murdertour/`) are
browser versions of the CityAnatomy - Austin phone app's modules, built so
anatomy.city works as the app until the phone app is tested and approved
(owner, 2026-09-10). They share this folder; each app keeps only what is its
own (its card, its story page, its copy, its data).

Plain ES modules, no build step, no framework. Each file is a plain-JS copy
of the matching file in the app (`CityAnatomyAustin/src/engine`, `src/lib`,
`src/ui`), so the web and the phone behave the same.

| File | What it does | App file it mirrors |
|---|---|---|
| `engine.js` | geofence maths: a stop fires after 3 consecutive GPS readings inside its radius; nearest-pending stop for the approach hint; metre-accurate circles | `src/engine/tour-engine.ts` |
| `distance.js` | the walked-distance meter with its jitter / bad-fix / teleport filters, and `formatMiles` | `src/lib/distance-tracker.ts` |
| `geo.js` | the browser's GPS: a running watch, one-shot fixes, the screen wake lock | expo-location + expo-keep-awake |
| `store.js` | a saved list of stop ids in localStorage (visited / lit); each app passes its own key | `src/store/tour-store.ts` |
| `controls.js` | banner, credits drawer, stop picker, tap-or-hold | `src/ui/map-controls.tsx`, `src/ui/info-drawer.tsx` |
| `text.js` | HTML escaping and the period-date formatter (never `Date`, which is a day out west of Greenwich) | `src/lib/format-date.ts` |

## What every app does with it

1. Loads its map style verbatim (the app's own style JSON, copied to
   `vendor/` by `tools/sync-webapps.js`). The style ships its tour sources
   empty; the page fills them after every `style.load`. **All map styling
   lives in the style file, never in the page.**
2. Draws the same chrome as the phone app: progress chip + stop picker,
   the round button stack (⌂ home, ◎ locate, ☀/☾ day-night, 🚶/🚲, 2D/3D,
   ⛶ extents, + −), the distance pill, the ⓘ credits drawer, the banner,
   the bottom card, and the full-story page (addressed by the URL hash so
   the phone's back button closes it).
3. Runs the GPS watch only after the visitor taps ◎ (that is when the
   browser asks permission). Foreground only: the watch pauses while the
   tab is hidden. Needs https (or localhost).

## Copy rule

The owner writes all copy. Every label a page shows on its own is in that
app's `js/copy.js`, lifted verbatim from the phone app's screens; the stop
text comes from `vendor/`. Nothing here invents sentences.

## Testing locally

ES modules need a real server — `file://` will not work:

    python3 -m http.server 8098          # from the site root
    # then open http://localhost:8098/moontowertour/

Geolocation works on localhost. On a phone, test on the live https site.
