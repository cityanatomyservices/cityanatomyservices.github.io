/* Run against a local site origin or the published site with a matching directory snapshot. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('../video/node_modules/playwright-core');
const {executablePath} = require('../browser.cjs');

const origin = process.argv[2] || 'http://127.0.0.1:8894';
const center = [-97.7365, 30.2668]; // Public test location near downtown and East Austin.
const folder = path.resolve(__dirname, '../../chat/data/places');
const files = Object.keys(require(path.join(folder, 'index.json')).neighborhoods);
const places = files.flatMap(id => require(path.join(folder, id + '.json')).groups.flatMap(group =>
  group.categories.flatMap(category => category.places.map(place => ({place, id})))));
const snapshots = process.env.AROUND_SCREENSHOTS;

(async () => {
  const {distance} = await import('../../geofences/model.mjs');
  const browser = await chromium.launch({executablePath: executablePath(), args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({viewport: {width, height: 900}, isMobile: width < 500, hasTouch: width < 500});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(center => {
        window.testCenter = center;
        window.gpsCalls = 0;
        Object.defineProperty(navigator, 'geolocation', {value: {
          watchPosition() { return 1; }, clearWatch() {},
          getCurrentPosition(ok, fail) {
            window.gpsCalls++;
            const [longitude, latitude] = window.testCenter;
            const deliver = () => ok({coords: {longitude, latitude, accuracy: 4}, timestamp: Date.now()});
            if (window.gpsMode === 'denied') fail({code: 1});
            else if (window.gpsMode === 'hold') window.finishGPS = deliver;
            else deliver();
          }
        }});
      }, center);
      await page.goto(origin);
      const f = await (await page.locator('#app-window').elementHandle()).contentFrame();
      await f.waitForFunction(() => window.AustinAroundMe && window.chatMap);
      const trigger = f.getByRole('button', {name: 'What is around me', exact: true});
      const dialog = f.locator('#around-dialog');
      const status = f.locator('#around-status');
      await trigger.click();
      assert.equal(await dialog.isVisible(), true);
      assert.equal(await f.evaluate(() => window.gpsCalls), 0);
      for (const miles of [0.25, 0.5, 1]) {
        await dialog.locator('[data-miles="' + miles + '"]').click();
        const expected = places.filter(({place}) => place.sources.osm && distance(center,[place.lng,place.lat]) <= miles * 1609.344);
        await status.filter({hasText: expected.length + ' mapped businesses within ' + miles}).waitFor();
        const links = await f.locator('#around-results li a').evaluateAll(rows => rows.map(a => a.href).sort());
        assert.deepEqual(links, expected.map(({place}) => 'https://www.openstreetmap.org/' + place.sources.osm[0]).sort());
        const features = await f.evaluate(async () => (await chatMap.getSource('around-me').getData()).features);
        assert.equal(features.filter(x => x.properties.kind === 'business').length, expected.length);
        assert.deepEqual(features.find(x => x.properties.kind === 'location').geometry.coordinates, center);
        const ring = features.find(x => x.geometry.type === 'Polygon').geometry.coordinates[0];
        assert.ok(ring.every(pt => Math.abs(distance(center,pt) - miles * 1609.344) < 0.1));
        await f.waitForFunction(() => !chatMap.isMoving() && chatMap.queryRenderedFeatures({layers:['around-edge']}).length > 0 &&
          chatMap.queryRenderedFeatures({layers:['around-businesses']}).length > 0);
        const hoods = new Set(expected.map(item => item.id));
        if (miles === 1) assert.ok(hoods.size > 1, 'finds businesses across neighborhood boundaries');
        assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth), false);
        if (snapshots && miles === 0.5) {
          fs.mkdirSync(snapshots, {recursive: true});
          await page.screenshot({path: path.join(snapshots,'nearby-' + width + '.png')});
        }
        console.log(width + 'px, ' + miles + ' mi: ' + expected.length + ' OSM businesses across ' + hoods.size + ' neighborhoods.');
      }
      await dialog.getByRole('button', {name:'Close nearby businesses'}).click();
      assert.equal(await trigger.evaluate(el => document.activeElement === el), true);
      assert.ok(await f.evaluate(() => AustinAroundMe.active));
      await f.locator('#ctrlDayPlan').click();
      await f.waitForFunction(() => !AustinAroundMe.active);
      await f.locator('#plan-panel-close').click();
      await trigger.click();
      await f.evaluate(() => { window.gpsMode = 'hold'; });
      await dialog.locator('[data-miles="1"]').click();
      await status.filter({hasText:'Finding your location'}).waitFor();
      await page.keyboard.press('Escape');
      await dialog.waitFor({state:'hidden'});
      await f.waitForFunction(() => !AustinAroundMe.active);
      await f.evaluate(() => window.finishGPS());
      assert.equal(await f.evaluate(() => AustinAroundMe.active), false);
      await trigger.click();
      await f.evaluate(() => { window.gpsMode = 'denied'; });
      await dialog.locator('[data-miles="0.25"]').click();
      await status.filter({hasText:'Allow location access'}).waitFor();
      await f.evaluate(() => { window.gpsMode = ''; window.testCenter = [-104,31]; });
      await dialog.locator('[data-miles="0.25"]').click();
      await status.filter({hasText:'outside the Austin business directory'}).waitFor();
      assert.equal(await f.locator('#around-results li').count(), 0);
      await dialog.getByRole('button', {name:'Clear search'}).click();
      assert.equal(await f.evaluate(() => AustinAroundMe.active), false);
      if (width === 390) {
        await page.addInitScript(() => {
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, ...args) {
            return type.includes('webgl') ? null : original.call(this, type, ...args);
          };
        });
        let omit = 'all';
        await page.route(/\/chat\/data\/places\/[^/?]+\.json/, route => {
          if (omit === 'all' || route.request().url().includes('/' + omit + '.json'))
            return route.fulfill({status:503, body:'Unavailable'});
          return route.continue();
        });
        await page.reload();
        const mobile = page.frameLocator('#app-window');
        await mobile.getByRole('button', {name:'What is around me',exact:true}).click();
        const quarter = mobile.getByRole('button', {name:'0.25 miles', exact:true});
        await quarter.click();
        await mobile.locator('#around-status').filter({hasText:'directory could not load'}).waitFor();
        omit = 'downtown';
        await quarter.click();
        await mobile.locator('#around-status').filter({hasText:'Some neighborhoods could not load'}).waitFor();
        const partial = await mobile.locator('#around-results li').count();
        assert.ok(partial > 0);
        omit = '';
        await quarter.click();
        const restored = places.filter(({place}) => place.sources.osm && distance(center,[place.lng,place.lat]) <= 0.25 * 1609.344);
        await mobile.locator('#around-status').filter({hasText:restored.length + ' mapped businesses'}).waitFor();
        assert.ok(restored.length > partial);
        console.log('Phone listing also passed with WebGL disabled, directory failures and retry.');
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
