# Chat map plan — the austin.chat home page (drafted 2026-10-22)

## 0. The agreed model (owner, 2026-10-22, evening)

- **One origin, austin.chat, for everything.** austin1885.city is being
  deleted; every app lives under `austin.chat/apps/<slug>/` and holds all
  it needs to run in the browser. Many apps are coming.
- **One identity across all apps, no registration required.** Today that
  is the random name + emoji (`chat/identity.js`); because every app is on
  the same origin, the browser already shares that stored identity between
  `/`, `/apps/1885/`, `/apps/moontower/` and the rest — nothing to build,
  only one rule: every app reads the SAME file and the SAME storage key
  (`austinchat:identity`). Once Supabase Auth is set up (§2), the signed-in
  profile name replaces the random one for people who choose to sign in.
- **Signing in is optional.** An anonymous visitor gets every function
  except the ones that need history spanning logins and devices (miles
  walked, towers lit across phones, past conversations). Those read from
  the profile and `tour_progress` rows and simply stay off for a visitor
  with no account.
- **Use one app, show up in the others.** Presence is per neighborhood
  room (§3); a person visible in a room is visible in that room from any
  app, because all apps join the same channels with the same identity.
  Decided against (2026-10-22 review of the long description): live GPS
  positions on other people's maps (coordinates never leave the phone;
  people are shown on their neighborhood polygon), server-side polygon
  validation (no server; the room is a channel name), Turf.js (the
  fifteen-line test in `chat/locate.js` does the job).
- **Visibility is one global switch**, off by default for a visitor who
  only wanted GPS for a tour; it lives in the browser now and moves to the
  profile row with Auth so it follows the person across devices.
- **The shared code** is the chat files themselves, loaded by each app:
  `identity.js` (later `auth.js`), `locate.js`, `chat.js`, `panel.js`, plus
  a visibility button. One small file per job; nothing more abstract.
- **To do when the domain goes:** `home.json` still embeds the 1885 demo
  from `austin1885.city/annihilatortour/?demo=1`, and the 1885 tour's
  stops link to `austin1885.city` pages (see the Austin1885 repos) — both
  need austin.chat addresses first. The tour code itself still sits at
  `/1885murdertour/app.html` behind the framed `/apps/1885/`; moving it
  into `/apps/1885/` is a separate pass.

Owner's brief, 2026-10-22: replace the home page's demo reel with a static
chat map. One geofence per neighborhood (merged by name). You only see
people in your own geofence. Everyone can turn their visibility on and off.
When two or more people have their profile on they can chat through a popup
window. A login so people use it like an app, with the same name and login
working in the walking apps too, or a randomly assigned name instead.
Signing in shows a profile and, for the walking apps, a record of what the
person has done. Supabase: the paid project only (the free one is deleted).

## 1. Geofences (done)

- `chat/data/neighborhoods.geojson` — the city's layer, unchanged (95 rows).
- `chat/data/geofences.geojson` — one polygon per neighborhood name, 65
  features, each with `id` (URL-safe) and `name`. Made by
  `bash tools/make-geofences.sh` from the file above; re-run after a refresh.
- The chat page finds which polygon the visitor's GPS point is in (point in
  polygon in the browser, no server) — that is their room.

## 2. Accounts (Supabase Auth, paid project)

Two ways in, both real accounts in the same `auth.users` table:

- **Random name:** Supabase *anonymous sign-in*. One tap, no email. The user
  gets a generated handle (adjective-animal, like `quiet-heron`) and an emoji.
  It lives in this browser until they clear it or sign out.
- **Named account:** email + password (or a magic link). An anonymous user
  can *link* an email later and keep their handle and record — Supabase
  supports upgrading an anonymous user in place, so nothing is lost.

One `profiles` row per user: `id` (= auth user id), `handle` (unique, the
name shown everywhere), `emoji`, `created_at`. Handle changes go through a
uniqueness check. The same login works in the walking apps because they talk
to the same project: a tour app signs the person in with the Supabase JS
client and reads the same `profiles` row.

What the owner must do once in the Supabase dashboard (paid project):
1. Authentication → Providers → enable **Anonymous sign-ins**.
2. Authentication → Providers → Email: on (default). Decide: password, or
   magic link only. Set the site URL to `https://austin.chat` and add the
   redirect URLs for the apps.
3. Authentication → Rate limits: leave defaults; anonymous sign-ins are
   limited per IP by Supabase already.
4. Run the migration in SQL Editor: `supabase/migrations/0001_profiles_chat.sql`
   (to be written once this plan is approved).

## 3. Presence and visibility

- One Supabase Realtime channel per geofence (`chat:<geofence id>`), the
  same pattern as the archived pub chat engine.
- **Visible** = the user has joined the channel's Presence with their
  profile. **Hidden** = joined without Presence: they see the room, nobody
  sees them. The toggle is one button; its state is remembered per browser.
- People show on the map **on their neighborhood**, as a row of avatars on
  the polygon, never at their GPS point. The map never sends a user's
  coordinates anywhere; only which geofence they are in.

## 4. Chat

- **Popup chat:** when two or more visible people are in the geofence, any
  of them can open the popup. Proposed: the popup is the *neighborhood
  room* (everyone visible there), not a private pair, so there is one
  conversation per place. A private room can come later with the same
  engine (channel keyed by the two user ids).
- Messages travel over Realtime Broadcast (nothing stored) and, if history
  is wanted, into a `messages` table (room, user, text, created_at) kept for
  30 days. Proposed: keep 30 days so a room is not empty when you arrive.
- Rules carried from the old engine: 240 characters, one message per
  second, delete your own.

## 5. Records for the walking apps

A `tour_progress` table: `user_id`, `tour` (`moontower`, `1885`), `stop_id`,
`visited_at`, with row security so a user reads and writes only their own
rows. The tour apps, which today keep progress in the browser (the
`createStore` in `webtour/store.js`), write the same events here when the
person is signed in, so progress follows the login across phone and desktop.
The profile page shows it: towers lit, stops reached, dates.

## 6. Where it lives

- `/chat/` in the site, inside the frame (shell.js) like every other page;
  the home window points at it instead of the demo reel.
- Its own files: `index.html`, `chat.js` (engine, from the archive, trimmed),
  `map.js` (MapLibre, geofences, point-in-polygon, avatars), `auth.js`
  (sign-in, profile), `style.css`, `config.js` (project URL + public key —
  the anon key is public by design; row security is what protects data).
- `supabase/migrations/` holds the SQL that was run, so the database is
  reproducible from the repo.

## 7. Order of work

Done 2026-10-22 (same day, later): `/chat/` is built and the home window
points at it — map, geofence from GPS, random name, visible/hidden,
presence, the chat window that opens when someone else is visible in
your room. Identity is a browser-local random name for now (identity.js),
messages are Broadcast only (nothing kept). What is left:

1. Owner tests: a phone in Austin, and two desktop tabs on
   `https://austin.chat/chat/?room=hyde-park`.
2. Owner: dashboard steps in §2 (anonymous sign-ins, email) — then Claude
   swaps identity.js for Supabase Auth and adds the `profiles` migration.
3. If history is wanted (§4): the `messages` table migration, owner runs it.
4. Later: tour apps write `tour_progress`; profile page shows records.
