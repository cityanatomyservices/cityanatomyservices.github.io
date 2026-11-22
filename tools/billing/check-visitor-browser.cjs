/* Published visitor testing, with fresh browser contexts and no mail, posts or checkout. */
const assert = require('node:assert/strict');
const {chromium} = require('../video/node_modules/playwright-core');
const {executablePath} = require('../browser.cjs');
const origin = 'https://austin.chat';
async function check(browser, width) {
  const context = await browser.newContext({viewport:{width,height:900},isMobile:width<700,hasTouch:width<700});
  const page = await context.newPage();
  page.setDefaultTimeout(40000);
  page.on('pageerror',error=>console.error('Page error:',error.message));
  try {
    await page.goto(origin+'/geofences/manage/',{waitUntil:'domcontentloaded'});
    await page.getByRole('heading',{name:'Create a geofence'}).waitFor();
    await page.locator('#geo-pricing').filter({hasText:'Free while testing'}).waitFor();
    const guest = await page.evaluate(()=>AustinSession.testingGuest && !AustinSession.registered && AustinSession.user.id);
    assert.ok(guest);
    await page.locator('[name=name]').fill('Guest map preview');
    await page.locator('[name=description]').fill('Browser verification');
    await page.locator('[value=coordinates]').check();
    await page.locator('[name=latitude]').fill('30.2672');
    await page.locator('[name=longitude]').fill('-97.7431');
    await page.locator('#geo-size-next').click();
    await page.locator('[name=invitation]').first().fill('unsent@example.invalid');
    await page.locator('#geo-preview').click();
    await page.locator('#geo-review').waitFor();
    await page.locator('#geo-confirm').check();
    assert.equal(await page.locator('#geo-pay').isEnabled(),true);
    console.log(width+'px: geofence creation form and map preview passed.');
    await page.goto(origin+'/classifieds/',{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Post your free ad'}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('.classifieds-primary')?.disabled);
    assert.equal(await page.evaluate(()=>AustinSession.user?.id),guest);
    await page.locator('.sign-in-button').click();
    await page.waitForFunction(()=>document.querySelector('#account-google')?.disabled===false && document.querySelector('#account-send')?.disabled===false);
    assert.equal(await page.locator('#account-signout').isVisible(),false);
    await page.locator('.account-close').click();
    console.log(width+'px: classifieds and both sign-in choices passed.');
    await page.goto(origin+'/apps/moontower/',{waitUntil:'domcontentloaded'});
    await page.frameLocator('#app-window').locator('#btn-info').waitFor({timeout:65000});
    assert.equal(await page.frameLocator('#app-window').locator('title').textContent(),'Moontower');
    assert.equal(await page.evaluate(()=>AustinSession.user?.id),guest);
    console.log(width+'px: anonymous geofence preview and activation button, classifieds, sign-in choices, and private Moontower app passed.');
  } catch(error) {
    const diagnostics=await page.evaluate(()=>({
      path:location.pathname,guest:window.AustinSession?.testingGuest,member:window.AustinSession?.registered,
      messages:[...document.querySelectorAll('#geo-access-status,#geo-form-status,#geo-list-status,.pro-app-gate [role=status]')]
        .filter(el=>el.offsetHeight).map(el=>el.textContent)
    })).catch(()=>null);
    console.error(diagnostics);
    throw error;
  } finally { await context.close(); }
}
(async()=>{
  const browser=await chromium.launch({executablePath:executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try { for(const width of [1280,390])await check(browser,width); }
  finally { await browser.close(); }
})().catch(error=>{console.error(error.message);process.exitCode=1;});

