/* Only called by check-sandbox.py with an in-memory test Checkout session. */
const {chromium}=require('../video/node_modules/playwright-core');
const {executablePath}=require('../browser.cjs');
const fs=require('node:fs');
(async()=>{
  const input=JSON.parse(fs.readFileSync(0,'utf8'));
  if(!/^https:\/\/checkout\.stripe\.com\//.test(input.url))throw new Error('Expected hosted Checkout');
  const browser=await chromium.launch({headless:true,executablePath:executablePath()});
  let page;
  try {
    page=await browser.newPage({viewport:{width:1100,height:900}});
    await page.goto(input.url,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForTimeout(3000);
    const text=await page.locator('body').innerText();
    if(!/test mode|test payment|sandbox/i.test(text))throw new Error('Checkout did not display test mode');
    await page.locator('#email').fill(input.email);
    const cardChoice=page.getByText('Card',{exact:true});
    if(await cardChoice.count()){
      // Stripe puts an expanded hit target over the label. Click the visible
      // card row with real pointer input, as a customer would.
      const bounds=await cardChoice.boundingBox();
      if(bounds)await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
    }
    await page.locator('#cardNumber').fill('4242424242424242');
    await page.locator('#cardExpiry').fill('1234');
    await page.locator('#cardCvc').fill('123');
    await page.locator('#billingName').fill('Austin Billing Test');
    const country=page.locator('#billingCountry');if(await country.count())await country.selectOption('US');
    const zip=page.locator('#billingPostalCode');if(await zip.count())await zip.fill('78701');
    const saveWithLink=page.locator('#enableStripePass');
    if(await saveWithLink.count()&&await saveWithLink.isChecked())await saveWithLink.uncheck();
    const submit=page.locator('button[type="submit"]').last();
    await submit.click();
    await page.waitForURL(url=>url.origin==='https://austin.chat'&&url.searchParams.get('billing')==='success',{timeout:90000,waitUntil:'domcontentloaded'});
    process.stdout.write(JSON.stringify({paid:true}));
  }catch(error){
    if(page){
      await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'austin-billing-test-checkout.png'),fullPage:true});
      for(const frame of page.frames()){
        const fields=await frame.locator('input,button,[role="radio"]').evaluateAll(nodes=>nodes.map(n=>({tag:n.tagName,id:n.id,name:n.getAttribute('name'),label:n.getAttribute('aria-label'),text:n.tagName==='BUTTON'?n.textContent.trim().slice(0,70):null})));
        process.stdout.write(JSON.stringify({fields})+'\n');
      }
    }
    // No session URL, customer data, tokens or screenshots in normal output.
    process.stdout.write(JSON.stringify({paid:false,reason:error.message.replace(/https?:\/\/\S+/g,'[private URL]').slice(0,1600)}));process.exitCode=1;
  }finally{await browser.close();}
})().catch(()=>{process.stdout.write(JSON.stringify({paid:false,reason:'Checkout browser could not start'}));process.exitCode=1;});
