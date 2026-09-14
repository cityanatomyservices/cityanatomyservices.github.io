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

## Recording a map page as a 9:16 video

The process is written once, in `docs/datacenters-recording.md`, and applies
to every map page: give the page `?play` and `?phone` switches and container
queries (copy from `datacenters/`), then record it with the OBS browser
source at 1080x1920. Do not record a desktop layout at 1080 wide; the owner
rejected that as unreadable on 2026-09-14.
