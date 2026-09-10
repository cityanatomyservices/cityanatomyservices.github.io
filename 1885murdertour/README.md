# 1885murdertour/ — The 1885 Murder Tour as a web app

https://anatomy.city/1885murdertour/ — the browser version of the
`servantgirlmurdertour` module of the CityAnatomy - Austin phone app. Full
screen, no site header or footer, no login: only the map and the app's own
controls, so it can be used on a phone in the street exactly like the app.
Built 2026-09-10. Shared engine: `../webtour/` (read its README first).

Not a showcase: the animated lantern map stays at
https://austin1885.city/annihilatortour/ and is what the home page previews.

## What it replicates

- The midnight-1885 map (night, with the day toggle), the walking / biking
  routes, the eight stops with the owner's case numbers as labels.
- Free-roam geofences: standing inside a stop's radius for three readings
  opens its card and records the visit. "I'm here" is **verified**: it only
  counts inside the geofence (plus GPS accuracy, capped at 50 m), because
  the tour exists to get people out to the sites.
- The stop card (name, date, address, the austin1885.city page pill, the
  full story, visited / I'm here), the stop picker in case order, the
  full-story page (historian sections, labelled lore, the site today,
  survivors, next stop), the walked-distance pill, the credits drawer.
- Progress survives reloads (localStorage key
  `cityanatomy:1885murdertour:tour-v1`).

## Files

- `index.html` — markup and all styling; palette = the app's `palette.ts`.
- `js/main.js` — wiring: map, GPS, engine, chrome.
- `js/card.js`, `js/story.js` — the card and the full-story page.
- `js/names.js` — "3. Irene Cross" (case number + name), as in the app.
- `js/copy.js` — every label the page shows, lifted from the app. Owner edits here.
- `vendor/` — **generated**, never hand-edit: `node tools/sync-webapps.js`
  copies the app's `src/modules/servantgirlmurdertour/data/*` here.

## Deliberate differences from the phone app

- The story page is a URL hash (`#stop-03-mary-ramey`), so a story can be
  linked to and the browser's back button closes it.
- No in-app browser sheet: the stop's austin1885.city page opens in a new tab.
