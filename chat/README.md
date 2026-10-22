# /chat/ — the austin.chat neighborhood chat

The home page's centre, and the engine every app under `/apps/` uses to be
part of the same chat. One small file per job; nothing is abstract.

| file | job |
| --- | --- |
| `index.html` | the chat map page: the map, the card, the control stack, the chat window markup |
| `config.js` | where the data is, how it draws, the Supabase project (publishable key — public by design) |
| `copy.js` | every word on screen (owner writes copy; current strings are drafts) |
| `identity.js` | your random name + emoji, remembered in this browser (`austinchat:identity`) |
| `locate.js` | GPS → which neighborhood polygon you are in (point in polygon, in the browser; coordinates never leave the phone) |
| `chat.js` | the Supabase Realtime channel per neighborhood: Presence = who is visible, Broadcast = messages |
| `panel.js` + `panel.css` | the chat window (colours from six `--chat-*` variables each page sets) |
| `room.js` | the wiring: joins your room, keeps the Visible / Chat buttons and lines up to date; shared with the apps |
| `map.js` | the chat map itself: layers, controls, 3D, and the two hooks that draw your room and the people |
| `data/` | the geofences (see `data/README.md`) |

## How an app joins (what the two tours do)

1. In the app's HTML: the `--chat-*` colour variables in `:root` (from the
   app's own palette), `/chat/panel.css`, a Visible button and a Chat button
   (`data-glyph="👁"` / `data-glyph="💬"` lets them show a glyph instead of
   words), and the chat window markup (copy it from `index.html`).
2. The script tags, in this order: supabase-js, `/chat/copy.js`, `config.js`,
   `identity.js`, `locate.js`, `chat.js`, `panel.js`, `room.js`.
3. One line of its own: `ChatRoom.load().then((g) => ChatRoom.start(g, { ids: { visibleBtn: '…', chatBtn: '…' } }))`
   (`1885murdertour/js/chat.js`, `moontowertour/js/chat.js`).

Because every app is on austin.chat, the browser shares the same stored
name between them: visible in one, visible in all, in the neighborhood you
are standing in. Visibility starts OFF and is remembered once turned on.

## Rules kept

- Chat is only ever the neighborhood you are physically in; `?room=<id>` is
  the one exception, for testing at a desk (two tabs, two names).
- The chat window never opens by itself.
- Nothing is stored yet (messages are live only); accounts and history come
  with the Supabase Auth step in `docs/CHAT-PLAN.md` §2.
