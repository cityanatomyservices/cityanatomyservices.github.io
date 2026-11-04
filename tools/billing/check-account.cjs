/* Full account-dialog integration with isolated identity/billing fixtures. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('../video/node_modules/playwright-core'),{executablePath}=require('../browser.cjs');
const root=path.resolve(__dirname,'../..');
const files=new Set(['account.js','account.css','membership.js','membership-ui.js','membership.css'].map(n=>'/shared/'+n));
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/shared/account.css"><link rel="stylesheet" href="/shared/membership.css"><button class="sign-in-button">Sign In</button><script>
const listeners=[];window.billing={plan:'free',hasBilling:false,checkoutEnabled:true,mode:'live'};window.invocations=[];
window.AustinSession={registered:true,user:{id:'alice',email:'alice@example.invalid'},peek:async()=>{},settings:async()=>({external:{google:true,email:true}}),subscribe:fn=>listeners.push(fn),signOut:async()=>{AustinSession.registered=false;AustinSession.user=null;listeners.forEach(fn=>fn());},client:()=>({functions:{invoke:async(name,{body})=>{invocations.push(body.action);return {data:{...billing}}}},rpc:async()=>({data:{...billing}})})};
window.AustinMemberUI={mount:()=>({open:async()=>{},close:()=>{}})};
window.switchAccount=()=>{AustinSession.user={id:'bob',email:'bob@example.invalid'};billing={plan:'free',hasBilling:false,checkoutEnabled:false,mode:'live'};listeners.forEach(fn=>fn());};
</script><script src="/shared/membership.js"></script><script src="/shared/membership-ui.js"></script><script src="/shared/account.js"></script>`;
(async()=>{
 const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname;
  if(p==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);}
  else if(p==='/auth/config.json'){res.setHeader('Content-Type','application/json');res.end('{"emailEnabled":true}');}
  else if(files.has(p)){res.setHeader('Content-Type',p.endsWith('.css')?'text/css':'text/javascript;charset=utf-8');res.end(fs.readFileSync(path.join(root,p)));}
  else{res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:executablePath()});
 try{
  const page=await browser.newPage({viewport:{width:390,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?billing=success');
  await page.waitForFunction(()=>document.querySelector('.membership-current')?.textContent==='Your plan: Free');
  assert.equal(await page.locator('#account-dialog').evaluate(n=>n.open),true);
  assert.equal(new URL(page.url()).searchParams.has('billing'),false);
  assert.equal((await page.evaluate(()=>invocations)).includes('checkout'),false,'Return URL never grants or starts a subscription');
  await page.evaluate(()=>{billing={plan:'pro',hasBilling:true,checkoutEnabled:true,mode:'live',paidThrough:'2026-12-04T12:00:00Z'};return AustinMembership.load();});
  await page.waitForFunction(()=>document.querySelector('.membership-current').textContent==='Your plan: Pro');
  await page.evaluate(()=>switchAccount());
  await page.waitForFunction(()=>document.querySelector('.membership-current').textContent==='Your plan: Free');
  assert.equal(await page.locator('.membership-manage').isVisible(),false);
  await page.locator('#account-signout').click();await page.waitForFunction(()=>!AustinSession.registered);
  assert.equal(await page.locator('#account-member').isVisible(),false);assert.equal(await page.locator('#account-guest').isVisible(),true);
  assert.equal(await page.locator('#account-email').isEnabled(),true);assert.deepEqual(errors,[]);
  console.log('Account dialog: return URL, Free/Pro display, account switch, sign-out and email controls passed');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
