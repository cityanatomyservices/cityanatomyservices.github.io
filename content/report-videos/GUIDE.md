# Report Promo Video Guide

Videos are 1280×720, 10 seconds, rendered by GitHub Actions via HeyGen Hyperframes.
One video per report — stored at `apps/reports/{slug}/promo.mp4`.

---

## How the pipeline works

```
reports/{slug}.json   ←  you edit this (text, color)
        ↓
    build.js          ←  substitutes tokens, generates inline QR SVG
        ↓
template/promo-template.html  ←  you edit this (design, animations)
        ↓
  npx hyperframes render      ←  Chromium + GSAP → mp4
        ↓
apps/reports/{slug}/promo.mp4
```

Pushing any file inside `content/report-videos/` auto-triggers a re-render of all 9 videos via GitHub Actions (~20–30 min). To render just one report, go to **Actions → Render Report Promo Videos → Run workflow → pick a slug**.

---

## Improving videos through prompts (tell Claude)

The most effective way to change the look is to describe what you want visually, like:

- *"Make the title white with a subtle drop shadow and increase the font size to 100px"*
- *"Change the background from near-black to a dark navy #0d1b2a"*
- *"Make the accent bar at the top thicker — 12px instead of 7px"*
- *"Slow the title animation down — it feels too fast"*
- *"Add a subtle fade-out in the last 2 seconds so the video ends gracefully"*
- *"Move the QR code to the bottom-right corner instead of top-left"*
- *"Add a second line below the narrative that always reads 'anatomy.city' in the accent color"*

Claude edits `template/promo-template.html` and pushes — Actions re-renders everything automatically.

---

## Directory reference

```
content/report-videos/
  template/
    promo-template.html   ← THE design file (HTML + CSS + GSAP)
  reports/
    austin-toy-stores.json
    austin-bike-shops.json
    ... (one per report)
  build.js                ← don't touch unless adding token logic
  package.json            ← deps: gsap, qrcode
  GUIDE.md                ← this file
```

---

## Editing a report's text or color

Open `content/report-videos/reports/{slug}.json`. Five fields:

```json
{
  "title":      "Austin Toy Stores",          // ≤30 chars — fits on one line
  "eyebrow":    "City Anatomy Shopping App & Report - Austin",
  "accentColor":"#d4380d",                    // drives bar, QR border, glow, divider
  "appPath":    "/apps/reports/austin-toy-stores",
  "narrative":  "Marketing paragraph ≤250 chars. End with a store list."
}
```

Push the changed JSON → Actions re-renders that report (or all of them). If you only want to re-render one report, use the manual workflow_dispatch dropdown.

---

## Editing the visual design (template)

The file is `content/report-videos/template/promo-template.html`.

### Key CSS values to tweak

| What | Where in CSS | Default |
|------|-------------|--------|
| Background | `body { background: ... }` | `#0a0a0f` |
| Dot grid opacity | `radial-gradient(circle, rgba(255,255,255,X)...)` | `0.055` |
| Accent glow size | `#bg-glow { width/height }` | `560px` |
| Top bar height | `#bar { height }` | `7px` |
| Eyebrow size | `#eyebrow { font-size }` | `26px` |
| Title size | `#title { font-size }` | `92px` |
| Narrative size | `#narrative { font-size }` | `34px` |
| Narrative color | `#narrative { color }` | `#bcc5d8` |
| QR code size | `#qr-frame svg { width/height }` | `104px` |

`{{ACCENT}}` is replaced at build time with the report's `accentColor`. You can use it anywhere in CSS — including with 2-digit hex alpha suffix: `{{ACCENT}}40` = accent at 25% opacity.

### Key GSAP animation tweaks

Animations are in the `<script>` block at the bottom of the template. Each `tl.fromTo()` call has three numbers you can tune:

```js
tl.fromTo('#title',
  { opacity: 0, y: 26 },           // start state
  { opacity: 1, y: 0,
    duration: 0.9,                  // seconds — increase to slow down
    ease: 'back.out(1.7)' },        // easing — controls the "spring feel"
  0.75                              // delay from timeline start (seconds)
);
```

**Common eases and what they feel like:**
- `power2.out` — smooth deceleration (default for most elements)
- `back.out(1.7)` — overshoots slightly, then settles (spring bounce on title)
- `power2.inOut` — smooth in and out (used for the divider)
- `elastic.out(1, 0.3)` — dramatic elastic bounce
- `expo.out` — fast start, very slow finish (great for text reveals)

**To add a hold before fade-out** (last 2 seconds go dark):
```js
tl.to('#comp', { opacity: 0, duration: 1, ease: 'power1.in' }, 9);
```

---

## Creating a new template (alternate visual style)

If you want a different look for a specific report (e.g. a light theme or a video-style layout), you can have multiple templates.

**Steps:**
1. Duplicate `template/promo-template.html` → `template/promo-light.html` (or any name)
2. Edit the new file to your liking
3. In `build.js`, add a `TEMPLATE_MAP` to pick which template to use per slug:

```js
const TEMPLATE_MAP = {
};

// Then replace the template read line:
const templateFile = TEMPLATE_MAP[slug] || TEMPLATE;
const template = fs.readFileSync(templateFile, 'utf-8');
```

4. Push — only the reports in `TEMPLATE_MAP` use the alternate template; the rest use the default.

---

## Adding a new report video

1. Create `content/report-videos/reports/{new-slug}.json` with the 5 fields above
2. Add `"render:{new-slug}": "node build.js {new-slug} --render"` to `package.json` scripts
3. Add `{new-slug}` to the `workflow_dispatch` options list in `.github/workflows/render-report-videos.yml`
4. Push — Actions renders it; the mp4 lands at `apps/reports/{new-slug}/promo.mp4`

---

## What makes a great promo video

- **Title ≤30 chars** so it always fits on one line at 92px
- **Narrative ≤220 chars** — end with a store/location list ("Terra Toys, Toy Joy, … and more inside.")
- **Accent color** should contrast well on the dark `#0a0a0f` background — avoid very dark colors like `#1a3a1a`; prefer saturated mid-tones
- **Eyebrow** is the category signal — keep it consistent: `City Anatomy [Shopping|Recreation|City Government] App & Report - Austin`
- The video holds the final frame for ~7 seconds after animation finishes — make sure the narrative is readable at a glance
