# Claude Code — Project Instructions

## Git workflow

**Always merge and push directly to `main` when work is complete.**

- Never leave changes on a feature branch without merging
- Never open a pull request unless explicitly asked
- After every task: commit → merge to main → push origin main
- If a review is needed first, the user will say so explicitly

## Cache-busting the shared CSS/JS

`/style.css`, `/page.js` and `/home.js` are referenced with a version query —
`?v=20260911a`. GitHub Pages serves them with a long cache lifetime, so without
it a visitor keeps the old file after a push and simply does not see the change
(this bit the owner on 2026-09-10: a restored header button was live but
invisible to them for exactly this reason).

**Bump the number on every push that changes one of those three files**, in all
the HTML that references them:

    grep -rl 'v=20260911a' --include='*.html' . | xargs sed -i 's/v=20260911a/v=<new>/g'

Use the date. Each report folder's own `style.css` carries its own separate
`?v=` — leave those alone.

**Do not fetch a new `?v=` URL until the Pages deploy has finished.** GitHub's
CDN caches whatever it serves for a query string for four hours, so a probe
that lands before the deploy pins the OLD file under the NEW version (this
bit `/datacenters/` on 2026-09-12 and cost another bump). Wait for the HTML
page itself to show the new version string first, then check the assets once.

## Turning a map page into a narrated 9:16 video (the formula, 2026-09-14)

Done twice (`/datacenters/`, `/AISD/`). **The order of work with every
command and the numbers to measure is `docs/new-map-checklist.md`**; the
reasons behind the recording setup are in `docs/datacenters-recording.md`.
The steps, in order:

1. **Page.** Every topic map runs on the shared engine in `/topicmap/`
   (`app.js`, `player.js`, `style.css`, lifted 2026-09-14): controls, fold
   cards, bottom timeline player with reveals at 5 s and text cards at 15 s,
   an intro card for visitors, `?play` (auto-start, no intro) and `?phone`
   (phone layout at 1080x1920) switches, container queries. A page folder
   holds only `index.html`, a two-line `style.css` (accent), `config.js`
   (data), `copy.js` (words), `map.js` (popup, steps, camera) and `data/`.
   Draft the story text from the research note, mark it as a draft in
   `copy.js`; the owner reviews the live page. Engine changes go in
   `/topicmap/` once, never into a page folder; bump `?v=` on
   `../topicmap/*` in every page's `index.html` when they change.
2. **Take.** OBS profile `wcibh-phone`, scene `Site portrait`, browser source
   `Site page` at `<page>?play&phone`; refresh, record, trim to the length
   the owner wants (`ffmpeg -t`). Never record a desktop layout at 1080 wide.
3. **Narration.** Draft a timed narration (`docs/<map>-narration.md`), well
   under the video length (about 240 words for 1:59); the owner records the
   voice and makes the emoji narrator animation themselves.
4. **Composite.** ffmpeg: colour-key the white background with a circle mask
   so the teeth survive, face bottom-left at 300 px from second 2, chin only
   while the bottom text card is up (measure the card window from the take
   with the `signalstats` line), narration audio delayed 2 s, end card
   "Navigate map / and sources at / <page address>" from the last map
   second. Output to `C:\Dev\map-exports\<map>\`.

