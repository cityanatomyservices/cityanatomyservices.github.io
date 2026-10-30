'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
(async () => {
  const folder = path.resolve(process.argv[2]);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1800, height: 1200 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(folder, 'Map.html')).href + '?print=1');
    await page.waitForFunction(() => window.__mapReady, null, { timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    const state = await page.evaluate(() => ({ errors: window.__mapErrors, pins: window.__pinCount }));
    if (errors.length || state.errors.length) throw new Error('Map did not render cleanly: ' + [...errors, ...state.errors].join('; '));
    await page.screenshot({ path: path.join(folder, 'Map.png'), fullPage: true });
    console.log(`Rendered map image with ${state.pins} numbered places.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
