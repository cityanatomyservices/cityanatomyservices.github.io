/* Browser proof of private frame delivery and sign-out; no real account writes. */
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('../video/node_modules/playwright-core'),{executablePath}=require('../browser.cjs');
const root=path.resolve(__dirname,'../..'),privateFiles={'/fixture/app.html':'<!doctype html><html><script>window.appPath=location.pathname;fetch("./data.json").then(r=>r.json()).then(d=>{document.body.textContent=d.message;window.privateLoaded=true;});</script><body></body></html>',
 '/fixture/data.json':'{"message":"Private Pro data"}'};
const manifest={files:{'/fixture/app.html':{mime:'text/html; charset=utf-8'},'/fixture/data.json':{mime:'application/json'}}};
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),token=encode({alg:'HS256'})+'.'+encode({sub:'fixture',exp:Math.floor(Date.now()/1000)+3600})+'.fixture';
let serverPaid=true,privateReads=0;
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/shared/pro-apps.css"><style>.map-hero{height:400px}iframe{width:100%;height:100%}</style><div class="map-hero"><iframe data-pro-src="/fixture/app.html"></iframe></div><script>
const callbacks=[],members=[];window.AustinSession={registered:true,user:{id:'fixture'},peek:async()=>{},subscribe:fn=>callbacks.push(fn),client:()=>({auth:{getSession:async()=>({data:{session:{user:{id:'fixture'},access_token:${JSON.stringify(token)}}}})}})};
window.AustinMembership={state:{plan:'pro',paidThrough:new Date(Date.now()+3600000).toISOString()},subscribe:fn=>members.push(fn),load:async()=>AustinMembership.state};
window.AustinAccount={open:()=>{}};window.demote=()=>{AustinMembership.state={plan:'free'};members.forEach(fn=>fn());};window.signout=()=>{AustinSession.registered=false;AustinSession.user=null;callbacks.forEach(fn=>fn());};
</script><script src="/shared/pro-apps.js"></script>`;
(async()=>{
 let origin;
 const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,'http://local').pathname;
  if(name==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(html);}
  if(name==='/billing/pro-assets.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(manifest));}
  if(name==='/pro-worker.js'){res.setHeader('Content-Type','text/javascript');res.setHeader('Service-Worker-Allowed','/');return res.end(fs.readFileSync(path.join(root,'pro-worker.js'),'utf8').replace('https://aqbyxpiwugcvoephsvpm.supabase.co/functions/v1/pro-app',origin+'/private-api'));}
  if(['/shared/pro-apps.js','/shared/pro-apps.css'].includes(name)){res.setHeader('Content-Type',name.endsWith('.css')?'text/css':'text/javascript');return res.end(fs.readFileSync(path.join(root,name)));}
  if(name==='/private-api'){
   privateReads++;let body='';for await(const part of req)body+=part;const resource=JSON.parse(body).path;
   if(req.headers.authorization!=='Bearer '+token||!serverPaid){res.writeHead(403);return res.end('Pro required');}
   if(!privateFiles[resource]){res.writeHead(404);return res.end();}
   res.setHeader('X-App-Content-Type',manifest.files[resource].mime);return res.end(privateFiles[resource]);
  }
  res.writeHead(404);res.end('Not a public asset');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:executablePath()});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
  const frame=await(await page.locator('iframe').elementHandle()).contentFrame();
  await frame.waitForFunction(()=>window.privateLoaded,{},{timeout:30000});
  assert.equal(await frame.evaluate(()=>appPath),'/fixture/app.html');assert.equal(await frame.locator('body').innerText(),'Private Pro data');
  assert.ok(privateReads>=2);assert.equal((await fetch(origin+'/fixture/app.html')).status,404);
  assert.equal((await fetch(origin+'/private-api',{method:'POST',body:JSON.stringify({path:'/fixture/app.html'})})).status,403);
  assert.deepEqual(await page.evaluate(()=>caches.keys()),[],'Private app bytes are never stored in CacheStorage');
  serverPaid=false;await page.evaluate(()=>demote());assert.equal(await page.locator('iframe').isHidden(),true);
  assert.equal(await page.evaluate(async()=> (await fetch('/fixture/data.json')).status),403,'A retained token cannot bypass membership expiry');
  await page.evaluate(()=>signout());assert.match(await page.locator('.pro-app-gate p').innerText(),/Sign in/);
  assert.deepEqual(errors,[]);console.log('Private delivery: original iframe URL, private subresources, public 404, unauthenticated 403, expiry, sign-out and no persistent cache passed');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
