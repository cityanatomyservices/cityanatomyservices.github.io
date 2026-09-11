# apps/reports

This folder powers the **Product Intelligence Reports** — interactive map apps, story maps, and written reports. Each topic lives at its own URL slug and is built from the same modular template.

## Folder structure

```
apps/reports/
  {slug}/           ← one self-contained report folder per topic
    index.html      ← interactive map app (copied from template/)
    config.js       ← only file that changes per topic (map config)
    data.geojson    ← only file that changes per topic (location data)
    report.html     ← the written HTML report
    promo.mp4       ← promo clip, rendered by content/report-videos/
    app.js, style.css, favicon.*  ← copied unchanged
  reports.json      ← registry that drives the cards
  staging/          ← drop files here to trigger a new report build (see staging/PROMPT.md)
  template/         ← canonical source files (never edit directly)
    report-template.html  ← HTML shell with {{TOKEN}} placeholders; filled in at build time
```

**The story maps were REMOVED on 2026-09-10** (owner: "get rid of the story maps
completely"). The cinematic scene player — `storymap/index.html`, `engine.js`,
`ui.js`, `story.json`, `data/` — is gone from every report and from the template.
The written reports were NOT deleted: each `report.html` moved up one level to
`{slug}/report.html`, along with its images and `promo.mp4`. Everywhere that
linked into `storymap/` now points at the map app or the report.

**To create a new report:** copy any existing `{slug}/` folder, rename it, then edit only `config.js` and `data.geojson`. Everything else is drop-in identical.

## Files that differ per app

Everything else is copied unchanged from `template/`. Only these two files are customized:

| File | Purpose |
|------|--------|
| `config.js` | Title, theme, map center, filters, columns, popup fields |
| `data.geojson` | Location data for the topic |


---

## The map app's layout (changed 2026-09-10)

The map app is **two columns**: the map and its draw bar on the left, a **side
panel** on the right holding the result count, Export CSV, the filters and the
location list. The table used to sit *underneath* the map, so you scrolled away
from the map to read it.

- The page is exactly one screen tall (`.page` is a flex column, `.app-body` the
  row). Only the panel's list scrolls. That matters because the app is also
  shown inside the small window on the home page.
- **In the panel the table is not a table.** Four columns will not fit 380px, so
  each row stacks into a labelled record — first column as the name, the rest as
  label/value lines. `app.js` puts the column header on each cell
  (`td.dataset.label`) and `style.css` draws it. Rows still click to fly the map.
- Below 900px the panel goes back under the map and the page scrolls normally.

`app.js`, `style.css` and `index.html` are identical in every report folder
(`index.html` differs only by its `<title>`). Edit `template/`, then copy out.

## Staging workflow — creating a new Product Report

See `staging/PROMPT.md` for the Perplexity prompt to generate standardized input.

Place these files in `apps/reports/staging/` before triggering a build:

| File | Contents |
|------|----------|
| `report.md` | Perplexity output — front-matter block + Markdown body + `---CSV---` + CSV rows |
| `data.csv` | CSV rows extracted from `report.md` (same data, separate file for easy import) |
| `image1.png` | Topic/category hero photo |
| `image2.png` | Photo of `featured_location_1` |
| `image3.png` | Photo of `featured_location_2` |

Then tell Claude: *"Build the new Product Report from staging."*

### What Claude does — zero rewrite, mechanical conversion

1. **Parse** `report.md` — split on `---CSV---`; extract front-matter (`title`, `subtitle`, `category`, `accent`, `slug`, `featured_location_1`, `featured_location_2`, `stats`)
2. **Convert** Markdown body → HTML mechanically (h2→`<h2>`, `[n]`→`<sup>`, tables→`<table>`, etc.) — **no rewording**
3. **Insert images** into converted HTML: `image1.png` goes in hero; `image2.png` / `image3.png` are inserted as floated figures inside the `<h3>` sections matching `featured_location_1` / `featured_location_2`
4. **Build scoreboard HTML** from the `stats:` front-matter list
5. **Fill** `template/report-template.html` — substitute `{{TITLE}}`, `{{SUBTITLE}}`, `{{ACCENT}}`, `{{SLUG}}`, `{{SCOREBOARD_HTML}}`, `{{BODY_HTML}}`, `{{REFS_HTML}}`
6. **Copy images** `image1.png`, `image2.png`, `image3.png` → `apps/reports/{slug}/`
7. **Write** `apps/reports/{slug}/report.html`
8. **Convert** CSV → GeoJSON (lat/lng → Point geometry; all other columns → properties)
9. **Copy** `template/` → `apps/reports/{slug}/`; write `data.geojson`
10. **Write** `config.js` using the GeoJSON property profile rubric (see rules below)
12. **Add** entry to `reports.json`
13. **Clear** staging — delete `report.md`, `data.csv`, `image1.png`, `image2.png`, `image3.png`
14. **Commit and push** to main

### Slug convention

Use lowercase kebab-case matching the topic, e.g. `austin-coffee-shops`, `austin-food-trucks`.

### reports.json entry shape

```json
{
  "id": "{slug}",
  "category": "Shopping | Recreation | City Government",
  "title": "Full report title",
  "eyebrow": "Austin Metro · Report",
  "blurb": "One-sentence description for the homepage card.",
  "href": "/apps/reports/{slug}/report.html",
  "accent": "#hexcolor"
}
```

## Cache-busting the report apps

Each report's `index.html` loads its own `style.css`, `config.js` and `app.js`
with a `?v=` query. GitHub Pages caches those files hard, and without the query
a push is invisible — the CDN keeps serving the old `app.js` at the same URL.
This bit us on 2026-09-10: the simplified popups deployed, but the live app.js
was still the old one.

**Bump the version in `template/index.html` whenever `app.js` or `style.css`
changes, then copy the template out to every report** (preserving each
`<title>`). One line:

    grep -rl 'v=20260910p' --include='index.html' apps/reports \
      | xargs sed -i 's/v=20260910p/v=<new>/g'

Use the date. The site-wide `/style.css`, `/page.js` and `/home.js` carry their
own separate version — see the repo root `CLAUDE.md`.
