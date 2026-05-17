# Chat Maps — Claude Guide

This folder (`apps/chats/`) contains a family of geofence-based ephemeral chat
apps. Each subfolder is one self-contained chat map for a different category of
location (bars, libraries, free-meal sites, etc.). Maps under this folder share
identical code and styling — only the data file (`hotspots.json`), branding
text, and intro-screen disclaimer differ.

**This file is for Claude.** When the user asks for a new chat map, follow the
workflow in this doc.

---

## Folder layout

```
apps/chats/
├── CLAUDE.md            ← this file
├── overview/            ← read-only index page that links all chat maps
├── staging/             ← user drops CSVs here for Claude to convert
├── pubchat/             ← bars, dance halls, live-music + comedy clubs
├── librarychat/         ← Austin Public Library branches
└── homelesschat/        ← free-meal / feeding sites (a.k.a. Feedingschat)
```

Each chat-map subfolder has the same nine files:

| File                 | Purpose                                                          |
|----------------------|------------------------------------------------------------------|
| `index.html`         | HTML shell + MapLibre setup + permission/intro modal             |
| `style.css`          | Shared styles (dark UI chrome, sheet, modal, social footer)      |
| `pubchat-engine.js`  | Geofence/position engine — loads hotspots, fires enter/leave     |
| `schedule.js`        | Pure helpers `isActive(schedule, now)` + `nextChange(...)` for temporal geofences |
| `chat.js`            | Supabase Realtime channel wiring (broadcast + presence)          |
| `ui.js`              | Bottom-sheet, message rendering, info pane, recenter, banner     |
| `identity.js`        | Random anonymous handle + emoji generator                        |
| `config.js`          | Public Supabase URL + anon key (Realtime only — no DB writes)    |
| `hotspots.json`      | The list of geofenced locations for this map                     |

The JS / CSS files are **identical across every chat map**. When fixing or
extending shared code (`pubchat-engine.js`, `schedule.js`, `ui.js`, `style.css`),
mirror the change to every chat folder with `cp` after editing one.

---

## How a chat map works

1. On first load the permission modal shows the app title, a brief
   description, a red "not affiliated" disclaimer, and a yellow privacy
   notice. User taps "Allow GPS location."
2. `PubchatEngine` (in `pubchat-engine.js`) `fetch()`es `hotspots.json`,
   centers the map on `initialCamera`, and renders each hotspot as a circle
   layer plus a label.
3. The engine watches the user's GPS position. When the user enters the
   geofence radius of a hotspot, it emits `pubchat:hotspot-changed` with the
   new `enteredId`. Leaving fires the same event with `enteredId: null`.
4. `chat.js` listens for that event, joins (or leaves) a Supabase Realtime
   channel keyed on the hotspot id, and `ui.js` opens the bottom-sheet chat.
5. Messages are broadcast-only — **nothing is persisted**. Walk away and the
   chat is gone.

### `hotspots.json` schema

```json
{
  "cityId": "atx",
  "title": "Pubchat · Austin",
  "initialCamera": { "center": [<lng>, <lat>], "zoom": 12 },
  "hotspots": [
    {
      "id": "kebab-case-unique-id",
      "title": "Display Name",
      "subtitle": "Short one-line description",
      "geofence": { "center": [<lng>, <lat>], "radiusMeters": 100 },

      "schedule": {                                     // OPTIONAL — temporal geofence
        "timezone": "America/Chicago",
        "windows": [
          { "days": ["mon","tue","wed","thu","fri"], "from": "07:00", "to": "19:00" },
          { "days": ["sat","sun"], "from": "09:00", "to": "17:00" }
        ]
      },

      "info": {                                         // OPTIONAL — static linked data
        "description": "Specialty coffee + breakfast tacos. Dog-friendly patio.",
        "hours":       "Mon–Fri 7am–7pm · Sat–Sun 9am–5pm",
        "phone":       "512-555-0123",
        "website":     "https://example.com",
        "menu":        ["Drip coffee — $3", "Breakfast taco — $4"]
      }
    }
  ]
}
```

- `center` is **`[longitude, latitude]`** (GeoJSON order — easy to flip
  accidentally).
- `id` must be unique within the file and stable (it keys the Supabase
  Realtime channel).
- `radiusMeters` is the geofence size. Typical values:
  - 60–80 m for compact venues (bars, single-building clubs)
  - 100 m for venues with patios/outdoor space (current default)
  - 200 m for spread-out facilities (library campuses, large feeding sites)
- `schedule` is **optional**. Without it, the hotspot is always active.
  - `timezone` defaults to `America/Chicago` if omitted.
  - `windows[]` is OR-composed — active if any window matches.
  - Overnight wrap supported (e.g. `from: "20:00", to: "02:00"`).
  - Engine re-evaluates exactly at the next window edge (`schedule.js`).
- `info` is **optional**. The bottom-sheet renders any subset of
  `description`, `hours`, `phone`, `website`, `menu[]`. Engine doesn't read
  it — just `ui.js` does, so adding new keys is safe.

### Map UI conventions

- **Always-dark UI chrome.** The brand card, identity badge, recenter
  button, basemap toggles, and social footer use hardcoded
  `rgba(22, 27, 35, 0.92)` backgrounds with `#2a3040` borders and
  `#f5f7fa` / `#c0c7d1` text. Do not switch them back to CSS variables.
- **Map controls:** Satellite toggle and 2D/3D pitch toggle. The Buildings
  toggle was removed — do not re-add it.
- **Intro modal must include the red disclaimer block** (`.pc-perm-disclaimer`)
  stating the chat is not affiliated with the venues shown. Wording is
  category-specific (bars / library / feeding sites / etc.).

---

## The `staging/` folder — adding a new chat map

`apps/chats/staging/` is where the user drops a **CSV** (and optionally a
short markdown brief) describing a new category of locations they want a chat
map for. When you see a new file there, treat it as a request to scaffold a
new chat map. The expected workflow is:

### 1. Read the staged CSV

Typical CSV columns (see `staging/53a4d63f (1).csv` for an example):

```
name, service_type, provider, address, city, state, zip_code,
phone, website, hours, eligibility_requirements, notes,
latitude, longitude
```

Required for the chat map: a **name** (→ `title`), a **short descriptor** for
`subtitle` (combine `provider` + `hours` or pick the most useful field), and
**`latitude` + `longitude`** (→ `geofence.center` as `[longitude, latitude]`).

If lat/lng are missing, ask the user before geocoding from addresses.

### 2. Pick a folder name + branding

Ask the user (or infer from the CSV / accompanying markdown):

- The new app's slug (e.g. `parkschat`, `coffeechat`) → becomes the folder
  name `apps/chats/<slug>/`.
- A display title (e.g. "ParksChat · Austin").
- A short subtitle ("Walk in. Say hi. Walk out." or similar).
- A category-appropriate emoji for the modal heading.
- The "not affiliated" disclaimer wording — name the category specifically
  (e.g. "any park, trail, or facility shown on the map").

### 3. Scaffold the new app

Copy an existing chat-map folder (`pubchat/` is the canonical reference)
into the new slug:

```bash
cp -r apps/chats/pubchat apps/chats/<new-slug>
```

Then update **only**:

- `index.html`
  - `<title>` tag
  - `.pc-brand-title` and `.pc-brand-subtitle` text
  - `<h2 id="pc-perm-title">` heading + emoji
  - The "Walk into a ___" list item
  - The yellow `.pc-perm-privacy` tone (fun / kind / respectful…)
  - The red `.pc-perm-disclaimer` wording (category-specific)
- `hotspots.json`
  - `title`, `initialCamera` (center on the bounding box of the points,
    pick a zoom that fits — 10.5–13 typical)
  - Replace `hotspots[]` with one entry per CSV row

Do **not** edit `pubchat-engine.js`, `chat.js`, `ui.js`, `identity.js`,
`style.css`, or `config.js`. The Supabase config is shared across all chat
maps — channel separation comes from the unique hotspot `id`s.

### 4. Add the new map to the overview page

`apps/chats/overview/index.html` is a single-page index that links all chat
maps. Add the new map's pin and link there too.

### 5. Commit, merge to main, push

Per the project-root `CLAUDE.md`: always merge to `main` and push when work
is complete. Never open a PR unless the user explicitly asks.

---

## Quick reference: editing existing chat maps

- **Adding/removing hotspots:** edit only that map's `hotspots.json`. The
  engine reads it dynamically; no other code changes are needed.
- **Changing shared chrome (footer, modal, basemap controls, etc.):** edit
  `pubchat/style.css` (or `pubchat/index.html`) first, then `cp` to the
  other chat-map folders. Verify with `diff` that the files stay in sync.
- **Geofence overlap is fine.** If two hotspots' radii overlap, the engine
  picks the closer one — overlapping circles look messy on the map but
  don't break anything.
