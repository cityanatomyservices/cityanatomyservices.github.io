# Citywide Template — Deployment Instructions

## Workflow at a glance

1. **User copies the folder manually.** `apps/templates/citywide/` → `apps/citywide/<NewName>/`. The template is fully self-contained — all paths in `index.html`, `app.js`, and `config.js` are relative, so the live URL `https://austin.chat/apps/citywide/<NewName>/` works as soon as the folder exists on `main`.
2. **User drops `data.geojson` into the new folder** (and optionally a `NOTES.md` — see below).
3. **User says:** "deploy `apps/citywide/<NewName>/`".
4. **Claude reads `data.geojson` directly**, profiles the properties, then edits `config.js` and `index.html` `<title>` in place.
5. **Claude commits and pushes to `main`.** Live at `https://austin.chat/apps/citywide/<NewName>/`.

No spec markdown to fill out. Each deployed folder is self-contained.

## Files Claude may edit per deployment

- `config.js` — rewrite the per-deployment fields (see below).
- `index.html` — change **only** `<title>`.

## Files Claude must NEVER modify

- `app.js`, `style.css`, `favicon.svg`, `favicon.png`, `data.geojson` — the frozen template app.
- Anything outside `apps/citywide/<NewName>/` (except commits to the repo root).

## Step 1: Read `data.geojson` and profile the properties

- Sample the first ~5 features to discover property keys.
- For each property, count unique values across all features and estimate the null rate.
- Compute the centroid of all `geometry.coordinates` — mean lng, mean lat, rounded to 3 decimals. That's the map `center`.

## Step 2: Read `NOTES.md` if it exists (optional hint sheet)

If `apps/citywide/<NewName>/NOTES.md` is present, it may contain per-deployment overrides. Anything not mentioned falls back to Claude's auto-picks or template defaults. Example:

```markdown
# Deploy notes
title: Austin Coffee Shops
eyebrow: Austin Metro
subtitle: Independent roasters and cafés
marker_color: #6f4e37
marker_icon: drop          # golf | drop | pin
theme: warm                # warm | cool | default
name_field: Shop Name      # override if Claude guesses wrong
```

All fields optional. No NOTES.md at all is a perfectly fine deploy — Claude picks everything from the data.

## Step 3: Pick fields using the Profile → Pick rubric

| Property pattern                       | nameField  | filter | column | popup |
|----------------------------------------|------------|--------|--------|-------|
| Unique per row, looks like a name      | **Yes** (one) | No  | Yes    | —     |
| 2–12 distinct values, categorical      | No         | **Yes**| Yes    | Yes   |
| 13+ distinct values, still categorical | No         | No     | Maybe  | Yes   |
| URL / phone / email                    | No         | No     | No     | Yes   |
| Hours / long text                      | No         | No     | No     | Yes   |
| Address                                | No         | No     | Yes    | Yes   |
| Mostly null (>70%)                     | No         | No     | No     | Yes   |
| `latitude`, `longitude`, raw coords    | No         | No     | No     | No    |

Hard caps: **3 filters**, **5 columns**, **9 popup rows** (the app.js UI is sized for these counts).

Property names in `filters` / `columns` / `popupFields` must match GeoJSON keys **exactly** — spaces and capitalization count (`"Pool Name"`, not `"pool_name"`).

## Step 4: Edit `config.js` in place

Overwrite these fields; leave everything else at template defaults:

- `title`, `eyebrow`, `subtitle`, `infoPanelText`
- `center` (computed centroid, rounded to 3 decimals)
- `markerColor`, `markerIconStyle` (`"golf" | "drop" | "pin"` — default `"golf"`)
- `theme` block (only if NOTES.md asks for non-default colors or fonts)
- `nameField` (the one unique-label property)
- `filters`, `columns`, `popupFields` (built from the rubric above)

Keep as-is: `maxBounds`, `overlays`, `features`, `socialLinks`, `redditCity`, `googleMapsApiKey`, `zoom`, `pitch`, `bearing`.

## Step 5: Edit `index.html`

Single line change: `<title>Citywide Template</title>` → `<title><CONFIG.title></title>`. Nothing else.

## Step 6: Commit and push

```
git add apps/citywide/<NewName>/config.js apps/citywide/<NewName>/index.html
git commit -m "Deploy <Title> citywide app"
git push origin main
```

Live at `https://austin.chat/apps/citywide/<NewName>/` after GitHub Pages rebuilds (~30 sec).

## Data notes

- Instagram handles: store without `@` (app auto-links).
- URLs: store full `https://...` (app auto-links).
- Empty `googleMapsApiKey`: Street View tab shows a fallback link.
- Coordinates in `center` and `maxBounds` are always `[lng, lat]` — lng first.
