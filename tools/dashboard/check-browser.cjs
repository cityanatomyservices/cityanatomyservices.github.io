/* Real dashboard and Excel download, isolated auth/RPC fixtures; no live writes. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('../video/node_modules/playwright-core'),{executablePath}=require('../browser.cjs');
const XLSX=require('../../dashboard/vendor/xlsx-0.20.3.min.js'),root=path.resolve(__dirname,'../..');
const session=`(()=>{
const listeners=[];window.qa={owner:null,active:true,queries:[],grants:[],delay:0};
window.setOwner=id=>{qa.owner=id;listeners.forEach(f=>f());};
window.AustinSession={get registered(){return !!qa.owner},get user(){return qa.owner?{id:qa.owner}:null},peek:async()=>{},subscribe:fn=>listeners.push(fn),client:()=>({rpc:(name,args)=>({abortSignal:signal=>new Promise(resolve=>{
 const id=qa.owner;setTimeout(()=>{
  if(signal.aborted)return resolve({error:{message:'Canceled'}});
  if(id!=='owner'||!qa.active)return resolve({error:{code:'42501'}});
  if(name==='dashboard_authorized')return resolve({data:true});
  if(name==='dashboard_catalog')return resolve({data:[{id:'members',title:'Members and memberships',description:'Confirmed member accounts.'},{id:'chat',title:'Neighborhood chat',description:'Saved registered messages; 30-day retention.'}]});
  if(name==='dashboard_query'){
   qa.queries.push(args);let all=Array.from({length:521},(_,i)=>({id:String(i+1),room:'fixture-room',handle:'Fixture member',text:i===0?'=HYPERLINK("https://example.invalid")':i===1?'<img src=x onerror="window.injected=true">':'Message '+(i+1),created_at:'2026-11-05T12:00:00Z'}));
   if(args.p_search)all=all.filter(r=>JSON.stringify(r).toLowerCase().includes(args.p_search.toLowerCase()));
   if(args.p_room&&args.p_room!=='fixture-room')all=[];
   const offset=Number(args.p_cursor||0),rows=all.slice(offset,offset+args.p_limit),more=offset+args.p_limit<all.length;
   return resolve({data:{rows,more,cursor:more?String(offset+args.p_limit):null}});
  }
  if(name==='dashboard_substack_grant'||name==='dashboard_substack_revoke'){qa.grants.push({name,args});return resolve({data:{hasSiteBilling:false}});}
  resolve({error:{message:'Unknown fixture call'}});
 },qa.delay);
})})})};})();`;
(async()=>{
 const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.geojson':'application/json','.css':'text/css'};
 const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(body);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,executablePath:executablePath()});
 try{
  for(const width of [1280,390]){
   const context=await browser.newContext({viewport:{width,height:950},acceptDownloads:true});
   await context.route('https://**',route=>route.abort());
   await context.route('**/shared/*.js?*',route=>route.fulfill({contentType:'text/javascript',body:route.request().url().includes('/session.js')?session:''}));
   await context.route('**/shell.js?*',route=>route.fulfill({contentType:'text/javascript',body:'document.body.insertAdjacentHTML("afterbegin",\'<header class="topbar"><a class="brand" href="/">Austin.Chat</a><button class="sign-in-button">Sign In</button></header>\');'}));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/dashboard/');
   await page.locator('#dashboard-signin').waitFor();assert.equal(await page.locator('#dashboard-content').isHidden(),true);
   await page.evaluate(()=>setOwner('other'));await page.locator('#gate-message').filter({hasText:'restricted'}).waitFor();
   assert.equal(await page.locator('#dashboard-content').isHidden(),true);
   await page.evaluate(()=>setOwner('owner'));await page.locator('#dashboard-content').waitFor();
   await page.selectOption('#report','chat');await page.fill('#room','fixture-room');await page.locator('#run-query').click();
   await page.waitForFunction(()=>document.querySelectorAll('#results tbody tr').length===200);
   assert.equal(await page.locator('#results img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
   await page.locator('#next').click();await page.waitForFunction(()=>document.querySelector('#page-number').textContent==='Page 2');
   await page.locator('#previous').click();await page.waitForFunction(()=>document.querySelector('#page-number').textContent==='Page 1');
   await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('main').scrollTop=0;});
   await page.screenshot({path:path.join(os.tmpdir(),'austin-dashboard-'+width+'.png'),fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const pending=page.waitForEvent('download');await page.locator('#export').click();const download=await pending;
   const bytes=fs.readFileSync(await download.path()),book=XLSX.read(bytes,{type:'buffer'}),rows=XLSX.utils.sheet_to_json(book.Sheets.Report);
   assert.equal(rows.length,521);assert.equal(new Set(rows.map(r=>r.id)).size,521);
   assert.equal(book.Sheets.Report.D2.t,'s');assert.equal(book.Sheets.Report.D2.f,undefined);
   assert.equal(rows[0].text,'=HYPERLINK("https://example.invalid")');
   await page.selectOption('#report','data:chat/data/places/allandale.json');await page.locator('#run-query').click();
   await page.waitForFunction(()=>document.querySelectorAll('#results tbody tr').length>7);
   assert.ok((await page.locator('#results th').allTextContents()).includes('category'),'places are flattened out of groups');
   await page.locator('#membership-tools summary').click();await page.fill('#grant-email','fixture@example.invalid');
   await page.fill('#grant-until','2027-11-05T12:00');await page.check('#grant-verified');await page.locator('#grant-button').click();
   await page.locator('#grant-status').filter({hasText:'saved'}).waitFor();assert.equal(await page.evaluate(()=>qa.grants.length),1);
   await page.selectOption('#report','chat');await page.evaluate(()=>qa.delay=600);await page.locator('#run-query').click();
   await page.evaluate(()=>setOwner(null));await page.locator('#dashboard-signin').waitFor();
   await page.waitForTimeout(700);assert.equal(await page.locator('#results tbody tr').count(),0);assert.equal(await page.locator('#dashboard-content').isHidden(),true);
   assert.equal(await page.inputValue('#grant-email'),'');assert.deepEqual(errors,[]);
   console.log(width+'px: guest/member denial, owner reports, pagination, safe full XLSX, place rows, manual grant and in-flight sign-out passed.');
   await context.close();
  }
 }finally{await browser.close();server.closeAllConnections();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
