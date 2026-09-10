# Claude Code — Project Instructions

## Git workflow

**Always merge and push directly to `main` when work is complete.**

- Never leave changes on a feature branch without merging
- Never open a pull request unless explicitly asked
- After every task: commit → merge to main → push origin main
- If a review is needed first, the user will say so explicitly

## Cache-busting the shared CSS/JS

`/style.css`, `/page.js` and `/home.js` are referenced with a version query —
`?v=20260910e`. GitHub Pages serves them with a long cache lifetime, so without
it a visitor keeps the old file after a push and simply does not see the change
(this bit the owner on 2026-09-10: a restored header button was live but
invisible to them for exactly this reason).

**Bump the number on every push that changes one of those three files**, in all
the HTML that references them:

    grep -rl 'v=20260910e' --include='*.html' . | xargs sed -i 's/v=20260910e/v=<new>/g'

Use the date. Each report folder's own `style.css` carries its own separate
`?v=` — leave those alone.
