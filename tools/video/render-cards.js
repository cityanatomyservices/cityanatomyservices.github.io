// render-cards.js — one PNG per beat, 1080x1920, from card.html.
//
//   node tools/video/render-cards.js austin-pizza
//
// Reads C:/Dev/map-exports/<id>/story/beats.json (make-story.py) and writes
// card-01.png, card-02.png ... beside it. Uses the Chromium that Playwright
// keeps in ~/.cache/ms-playwright (CHROME env overrides the path) through
// playwright-core; `npm install` once in tools/video.
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const app = process.argv[2];
if (!app) { console.error('usage: node tools/video/render-cards.js <app id>'); process.exit(1); }
const dir = `/mnt/c/Dev/map-exports/${app}/story`;
const story = JSON.parse(fs.readFileSync(path.join(dir, 'beats.json'), 'utf8'));
const CHROME = process.env.CHROME || '/home/citya/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto('file://' + path.join(__dirname, 'card.html'), { waitUntil: 'networkidle' });
  for (let i = 0; i < story.beats.length; i++) {
    await page.evaluate(([b, i, n, s]) => window.showBeat(b, i, n, s), [story.beats[i], i, story.beats.length, story]);
    const file = path.join(dir, `card-${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
  await browser.close();
})();
