# moontowertour/ — Moontower as a web app

https://anatomy.city/moontowertour/ — the browser version of the
`moontowertour` module of the CityAnatomy - Austin phone app. Full screen,
no site header or footer, no login: only the map and the app's own controls.
Built 2026-09-10. Shared engine: `../webtour/` (read its README first).

Not the showcase: the self-touring animated map stays at `/moontower/` and
is what the home page previews.

## What it replicates

- The arclight-1895 map (night, with the day toggle), the per-leg walking /
  biking routes, the 17 towers, and each tower's historic pool of light
  (three stacked geodesic rings at 1,500 / 1,000 / 500 ft).
- **The strike.** "I'm here — light this tower" runs the carbon-arc
  choreography (spark, sputter, catch, warm-up, bloom to the full pool, with
  the phone's vibration where the browser allows it), then the tower stays
  lit. Lighting is playable from anywhere, on purpose: the strike is the fun.
- **Honest visits.** The ✦ in the tower picker marks only towers whose
  geofence really fired (three readings inside the radius), kept separately
  from the lit list. The approach pulse breathes on the nearest unlit tower
  within 400 m.
- The tower card, the picker grouped by leg, the tower's story page, the
  camera that follows you after ◎ until you drag, the walked-distance pill,
  the credits drawer, hold-the-chip-to-reset.
- Progress survives reloads (localStorage keys
  `cityanatomy:moontowertour:tour-v1` and `...:visits-v1`).

## Files

- `index.html` — markup and all styling; palette = the app's `palette.ts`.
- `js/main.js` — wiring: map, GPS, engine, strike, chrome.
- `js/strike.js` — the pools of light, the strike keyframes, the pulse frames.
- `js/card.js`, `js/story.js`, `js/status.js` — the card, the story page,
  the two readings of a tower's status text.
- `js/copy.js` — every label the page shows, lifted from the app. Owner edits here.
- `vendor/` — **generated**, never hand-edit: `node tools/sync-webapps.js`
  copies the app's `src/modules/moontowertour/data/*` here.

## Deliberate differences from the phone app

- The story page is a URL hash (`#tower-01-22nd-nueces`), so it can be
  linked to and the browser's back button closes it.
- A picker flight parks the tower in the upper part of the screen so the
  card that opens never covers it (the phone app centres it).
- No 3D tower models: those belong to the `/moontower/` showcase
  (`moontower/js/towers-3d.js`) and could be added here the same way.
