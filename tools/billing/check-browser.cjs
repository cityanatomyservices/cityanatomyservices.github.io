/* Local account membership UI fixtures; no production account or Stripe requests. */
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict'),os=require('node:os');
const {chromium}=require('../video/node_modules/playwright-core');const {executablePath}=require('../browser.cjs');
const root=path.resolve(__dirname,'../..');
const files=new Set(['/shared/account.css','/shared/membership.css','/shared/membership-ui.js']);
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--border:#ccd6d3;--surface:#fff;--text:#17322b;--muted:#526960;--finish-raised:#f6faf8;--finish-control-border:#c1cec9;--accent:#17604c;--shadow:#0002}body{font-family:system-ui;background:#edf3f1}</style><link rel="stylesheet" href="/shared/account.css"><link rel="stylesheet" href="/shared/membership.css"><dialog class="account-dialog" open style="position:relative;margin:12px auto"><div class="account-heading"><h2>Your account</h2></div><div id="host"></div></dialog><script>
let listener;window.AustinMembership={state:null,subscribe:fn=>listener=fn,load:async()=>AustinMembership.state,checkout:async()=>{window.actions.push('checkout')},manage:async()=>{window.actions.push('portal')}};window.actions=[];
window.setMembership=async state=>{AustinMembership.state=state;listener?.(state);await window.panel.open();};
</script><script src="/shared/membership-ui.js"></script><script>window.panel=AustinMembershipUI.mount(document.getElementById('host'));</script>`;
(async()=>{
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname;if(name==='/'){res.setHeader('Content-Type','text/html');res.end(html);}else if(files.has(name)){res.setHeader('Content-Type',name.endsWith('.css')?'text/css':'text/javascript');res.end(fs.readFileSync(path.join(root,name)));}else{res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:executablePath()});
 try{
  for(const width of [1100,390]){
   const page=await browser.newPage({viewport:{width,height:900}});await page.goto('http://127.0.0.1:'+server.address().port);
   await page.evaluate(()=>setMembership({plan:'free',checkoutEnabled:true,hasBilling:false}));
   assert.equal(await page.locator('.membership-levels>div').count(),2);assert.equal(await page.locator('.membership-upgrade').isEnabled(),true);
   await page.locator('.membership-upgrade').click();assert.deepEqual(await page.evaluate(()=>actions),['checkout']);
   await page.evaluate(()=>setMembership({plan:'pro',paidThrough:'2026-12-04T12:00:00Z',cancelAtPeriodEnd:true,checkoutEnabled:true,hasBilling:true}));
   assert.equal(await page.locator('.membership-upgrade').isVisible(),false);assert.equal(await page.locator('.membership-manage').isVisible(),true);
   assert.match(await page.locator('.membership-detail').innerText(),/returns to Free/);
   await page.locator('.membership-manage').click();assert.deepEqual(await page.evaluate(()=>actions),['checkout','portal']);
   await page.evaluate(()=>setMembership({plan:'pro',source:'substack',paidThrough:'2027-11-05T12:00:00Z',checkoutEnabled:true,hasBilling:false}));
   assert.match(await page.locator('.membership-current').innerText(),/included with Substack/);
   assert.match(await page.locator('.membership-detail').innerText(),/verified through.*Renewals are updated manually/);
   assert.equal(await page.locator('.membership-upgrade').isVisible(),false);assert.equal(await page.locator('.membership-manage').isVisible(),false);
   assert.match(await page.locator('.membership-bundle').innerText(),/same email/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:path.join(os.tmpdir(),'austin-substack-membership-'+width+'.png'),fullPage:true});
   await page.evaluate(()=>setMembership({plan:'pro',source:'both',paidThrough:'2027-11-05T12:00:00Z',checkoutEnabled:true,hasBilling:true}));
   assert.match(await page.locator('.membership-detail').innerText(),/avoid paying twice/);
   assert.equal(await page.locator('.membership-manage').isVisible(),true);
   await page.evaluate(()=>setMembership({plan:'free',checkoutEnabled:false,hasBilling:false}));
   assert.equal(await page.locator('.membership-upgrade').isDisabled(),true);assert.match(await page.locator('.membership-message').innerText(),/coming soon/);
   assert.doesNotMatch(await page.locator('.membership-detail').innerText(),/Dec|2026/);
   await page.screenshot({path:path.join(os.tmpdir(),'austin-membership-'+width+'.png'),fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.close();console.log(width+'px membership: Free, Pro, Substack, dual subscriptions, cancellation, billing actions and setup state passed');
  }
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
