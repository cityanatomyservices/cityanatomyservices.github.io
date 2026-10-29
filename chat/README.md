# /chat/ — the austin.chat neighborhood chat

The home page's centre, and the engine every app under `/apps/` uses to be
part of the same chat. One small file per job; nothing is abstract.

| file | job |
| --- | --- |
| `index.html` | the chat map page: the map, the card, the control stack, the chat window markup |
| `config.js` | where the data is and how it draws |
| `copy.js` | every word on screen (owner writes copy; current strings are drafts) |
| `auth.js` | who you are: an anonymous Supabase account the browser keeps (shared by every app on austin.chat), your handle + emoji in your `profiles` row; falls back to a browser-only random name when offline |
| `locate.js` | GPS → which neighborhood polygon you are in (point in polygon, in the browser) and each reading, which chat.js shares with your neighborhood ONLY while you are Visible, rounded to ~10 m |
| `chat.js` | the Supabase Realtime channel per neighborhood: Presence = who is visible, Broadcast = live messages; each message also goes into the `messages` table (30 days) and a room's last lines are read back on joining |
| `panel.js` + `panel.css` | the chat window (colours from six `--chat-*` variables each page sets) |
| `room.js` | the wiring: joins your neighborhood, lists its businesses by category on the card, moves you to a business room when you tap one, keeps the Visible / Chat buttons and lines up to date; shared with the apps |
| `map.js` | the chat map itself: layers, controls, 3D, and the hooks that draw your room, the people (an emoji row on the business they picked, or on the neighborhood) and a pin on the business you picked |
| `data/` | the geofences, `categories.json` (which business types to list) and `places/` (one file per neighborhood, from OpenStreetMap by `tools/fetch-places.py`; see `data/README.md`) |

## How an app joins (what the two tours do)

1. In the app's HTML: the `--chat-*` colour variables in `:root` (from the
   app's own palette), `/chat/panel.css`, a Visible button and a Chat button
   (`data-glyph="👁"` / `data-glyph="💬"` lets them show a glyph instead of
   words), and the chat window markup (copy it from `index.html`).
2. The script tags, in this order: supabase-js, `/chat/copy.js`, `config.js`,
   `/shared/session.js`, `auth.js`, `locate.js`, `chat.js`, `panel.js`, `room.js`.
3. One line of its own: `ChatRoom.load().then((g) => ChatRoom.start(g, { ids: { visibleBtn: '…', chatBtn: '…' } }))`
   (`1885murdertour/js/chat.js`, `moontowertour/js/chat.js`).

Because every app is on austin.chat, the browser shares the same stored
name between them: visible in one, visible in all, in the neighborhood you
are standing in. Visibility starts OFF and is remembered once turned on.

## Rules kept

- Chat is only ever the neighborhood you are physically in; `?room=<id>` is
  the one exception, for testing at a desk (two tabs, two names).
- The chat window never opens by itself.
- The tables (`profiles` columns, `messages`, `tour_progress`) are in
  `supabase/migrations/0001_chat.sql`; until it has been run, the pages work
  live-only with browser-side names.
- Rooms are strings: `<neighborhood>` or `<neighborhood>/<place id>`.
  Everyone in a neighborhood shares its one Realtime channel; presence and
  every message carry the room, and a page shows only its own room's lines.
  `messages.room` in Supabase holds either form (no schema change).
- Businesses (owner 2026-10-22): anyone standing in the neighborhood may pick
  any of its businesses; a business room opens even when nobody else is
  there (a line stays 30 days); the neighborhood room still needs someone
  else. The card goes neighborhood → group → category → business, with
  "N here" counts, and the map shows each visible person on the business
  they picked. `?room=<id>&place=<place id>` picks one for testing.
# Planner integration (2026-10-29)

`/shared/session.js` now owns the Supabase client and anonymous session. Chat's
`auth.js` only adds its profile/name logic. The home map, both tour apps, and
My Plan Map use this shared session without sharing their application state.
Load shared/session.js before auth.js. `widget.js` is an optional lazy-loaded
chat UI for other applications, currently used by My Plan Map. Planner tables,
scheduling and selection controls live separately; see [planner/README.md](../planner/README.md).
