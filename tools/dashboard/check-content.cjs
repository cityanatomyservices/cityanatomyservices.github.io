/* Deployed/local application with isolated owner/API/feed fixtures; no real account writes. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('../video/node_modules/playwright-core'),{executablePath}=require('../browser.cjs'),M=require('../../dashboard/content/model.js');
const root=path.resolve(__dirname,'../..'),shots=path.resolve(root,'../.tmp');let server,browser;
async function serve(){server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(data);});});await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;}
const day=M.day(Date.now(),1),later=M.day(Date.now(),2),start=day+'T14:00:00-06:00';
const feature=(id,title,more={})=>({type:'Feature',geometry:{type:'Point',coordinates:[-97.74,30.27]},properties:{id,title,venue:'Austin Venue',address:'123 Main St',url:'https://example.com/'+id,kind:'event',price:0,start,end:day+'T16:00:00-06:00',endKnown:true,checked:new Date().toISOString(),expires:later+'T23:00:00-06:00',...more}});
function session(owner){return `(()=>{const listeners=[];window.qa={owner:${JSON.stringify(owner)},delay:0,fail:false,active:true};window.setOwner=id=>{qa.owner=id;listeners.forEach(fn=>fn());};window.AustinSession={get registered(){return !!qa.owner},get user(){return qa.owner?{id:qa.owner}:null},peek:async()=>{},subscribe:fn=>listeners.push(fn),client:()=>({rpc:(name,args)=>({abortSignal:signal=>fetch('/__desk-rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args,owner:qa.owner,delay:qa.delay,fail:qa.fail,active:qa.active}),signal}).then(r=>r.json())})})};})();`;}
(async()=>{try{
 fs.mkdirSync(shots,{recursive:true});
 const base=process.argv[2]||await serve();browser=await chromium.launch({executablePath:executablePath()});
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:1000},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});let owner=null;const lists=new Map(),errors=[],feedRequests=[];let failFeeds=false,musicCount=34;
  await context.route('https://*.supabase.co/**',r=>r.fulfill({status:400,json:{error:'Blocked account request in isolated check'}}));
  await context.route('**/shared/*.js?*',r=>r.fulfill({contentType:'text/javascript',body:r.request().url().includes('/session.js')?session(owner):''}));
  await context.route('**/shell.js?*',r=>r.fulfill({contentType:'text/javascript',body:`document.body.insertAdjacentHTML('afterbegin','<header class="topbar"><a class="brand" href="/">Austin.Chat</a><button class="sign-in-button">Sign In</button></header>');`}));
  await context.route('**/__desk-rpc',async r=>{
    const q=r.request().postDataJSON();owner=q.owner;await new Promise(done=>setTimeout(done,q.delay));let data,error;
    if(owner!=='owner'||!q.active)error={code:'42501',message:'Restricted'};
    else if(q.name==='dashboard_authorized')data=true;
    else if(q.name==='content_desk_lists')data=[...lists.values()].map(v=>({id:v.id,title:v.document.title,count:v.document.items.length,revision:v.revision}));
    else if(q.name==='content_desk_get')data=lists.get(q.args.p_id)||null;
    else if(q.name==='content_desk_save'){
      const old=lists.get(q.args.p_id);if(q.fail)error={message:'Simulated save failure'};
      else if((old?.revision||0)!==q.args.p_revision)error={code:'PT409',message:'This list changed in another tab.'};
      else{data={id:q.args.p_id,document:q.args.p_document,revision:q.args.p_revision+1,updated:new Date().toISOString()};lists.set(data.id,structuredClone(data));}
    }else if(q.name==='content_desk_delete'){lists.delete(q.args.p_id);data=true;}
    else if(q.name==='classifieds_read'){data={ads:[{id:'ad-one',category:q.args.p_category,title:'Classified fixture',body:'Community notice',created_at:new Date().toISOString(),mine:false}],more:false,total:1};}
    else error={message:'Unexpected fixture RPC '+q.name};
    try{await r.fulfill({json:error?{error}:{data}});}catch{}
  });
  await context.route('**/chat/data/explore/*.geojson',r=>{
    feedRequests.push(r.request().url());if(failFeeds)return r.fulfill({status:503,body:'Unavailable'});
    const name=new URL(r.request().url()).pathname.split('/').pop();let features=[];
    if(name==='free-cheap.geojson')features=[feature('shared','Jazz at the Garden'),feature('art','Paper & Print Studio'),feature('later','Later event',{start:later+'T12:00:00-06:00',end:later+'T14:00:00-06:00'})];
    if(name==='live-music.geojson')features=[feature('shared','Jazz at the Garden'),...Array.from({length:musicCount},(_,i)=>feature('music-'+i,'Music session '+i))];
    if(name==='movies.geojson')features=[feature('movie','A special screening',{kind:'movie',price:null,showtimes:[{start,url:'https://example.com/show'}]})];
    return r.fulfill({json:{type:'FeatureCollection',generated:new Date().toISOString(),sources:[],features}});
  });
  await context.route('**/chat/data/city-hall.json',r=>r.fulfill({json:{generated:new Date().toISOString(),sources:[],records:[{id:'meeting',title:'Public meeting fixture',category:'meetings',date:start,dateOnly:false,expires:later+'T23:00:00-06:00',url:'https://www.austintexas.gov/meeting',districts:['1'],scope:'citywide',board:'Arts Commission',location:'City Hall'}]}}));
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/dashboard/content/');
  await page.locator('#desk-signin').waitFor();assert.equal(feedRequests.length,0);await page.evaluate(()=>setOwner('other'));await page.locator('#gate-message').filter({hasText:'restricted'}).waitFor();assert.equal(await page.locator('#desk-content').isHidden(),true);
  await page.evaluate(()=>setOwner('owner'));await page.locator('#desk-content').waitFor();await page.waitForFunction(()=>document.querySelector('#result-count').textContent==='37 listings');
  assert.equal(await page.inputValue('#when'),'tomorrow');assert.equal(await page.locator('[data-category]').count(),11);assert.equal(await page.locator('.result').count(),30);
  const bulk=page.locator('#select-matches');
  const clearPicks=page.getByRole('button',{name:'Clear all picks',includeHidden:true});
  assert.equal(await clearPicks.isDisabled(),true);
  await bulk.check();
  await page.fill('#search','Jazz');
  await page.waitForFunction(()=>document.querySelector('#result-count').textContent==='1 listing');
  if(width<650)await page.locator('#list-tab').click();
  await page.fill('#list-intro','Keep this introduction.');
  const clearId=await page.inputValue('#saved-lists'),clearTitle=await page.inputValue('#list-title');
  await clearPicks.click();
  assert.equal(await page.textContent('#selection-count'),'0 picks');
  assert.equal(await page.locator('.pick').count(),0);
  for(const selector of ['#clear-picks','#export-list','#export-map'])assert.equal(await page.locator(selector).isDisabled(),true);
  await page.locator('#save-status').filter({hasText:'Saved privately'}).waitFor();
  assert.deepEqual(lists.get(clearId).document,{title:clearTitle,intro:'Keep this introduction.',items:[]});
  if(width<650)await page.locator('#browse-tab').click();
  const jazz=page.getByRole('checkbox',{name:'Jazz at the Garden',exact:true});
  assert.equal(await jazz.isChecked(),true);
  await jazz.uncheck();assert.equal(await page.locator('.pick').count(),0);
  await jazz.check();assert.equal(await page.locator('.pick h3').textContent(),'Jazz at the Garden');
  if(width<650)await page.locator('#list-tab').click();
  await page.getByRole('button',{name:'Remove Jazz at the Garden',exact:true}).click();
  assert.equal(await page.locator('.pick').count(),0);
  if(width<650)await page.locator('#browse-tab').click();
  assert.equal(await jazz.isChecked(),false);
  await page.fill('#search','');await page.waitForFunction(()=>document.querySelector('#result-count').textContent==='37 listings');
  await bulk.check();assert.equal(await page.locator('.pick').count(),37);
  await page.fill('#search','Music session');await page.waitForFunction(()=>document.querySelector('#result-count').textContent==='34 listings');
  await bulk.uncheck();assert.equal(await page.locator('.pick').count(),3);
  await page.fill('#search','');await page.waitForFunction(()=>document.querySelector('#select-matches').indeterminate);
  await bulk.check();await bulk.uncheck();assert.equal(await page.locator('.pick').count(),0);
  await page.locator('#show-more').click();assert.equal(await page.locator('.result').count(),37);
  await page.fill('#search','Jazz');await page.waitForFunction(()=>document.querySelectorAll('.result').length===1);await page.locator('.result input').check();await page.fill('#search','Paper');await page.waitForFunction(()=>document.querySelectorAll('.result').length===1&&document.querySelector('.result').textContent.includes('Paper'));await page.locator('.result input').check();
  if(width<650)await page.locator('#list-tab').click();await page.fill('#list-title','Tomorrow’s little adventures');await page.fill('#list-intro','Two Austin ideas for tomorrow.');await page.locator('.pick textarea').first().fill('Bring a friend — my personal pick.');
  await page.locator('.pick-tools button[aria-label^="Move up"]').last().click();await page.locator('#save-status').filter({hasText:'Saved privately'}).waitFor();const firstId=await page.inputValue('#saved-lists');assert.equal(lists.get(firstId).document.items[0].title,'Paper & Print Studio');
  await page.evaluate(()=>document.querySelector('main').scrollTop=0);await page.screenshot({path:path.join(shots,'content-desk-'+width+'.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('#export-list').click();await page.locator('#export-dialog').waitFor();assert.equal(await page.locator('#export-preview section').count(),2);await page.locator('#copy-text').click();await page.locator('#export-status').filter({hasText:'copied'}).waitFor();const clip=await page.evaluate(()=>navigator.clipboard.readText());assert.match(clip,/1\. Paper & Print Studio/);assert.match(clip,/Bring a friend/);assert.doesNotMatch(clip,/Music session/);
  await page.locator('#copy-rich').click();await page.locator('#export-status').filter({hasText:/^Copied\./}).waitFor();const types=await page.evaluate(async()=>Array.from((await navigator.clipboard.read())[0].types));assert.ok(types.includes('text/html'));assert.ok(types.includes('text/plain'));
  await page.locator('#copy-substack').click();await page.locator('#export-status').filter({hasText:/^Substack body copied/}).waitFor();
  const newsletter=await page.evaluate(async()=>await(await(await navigator.clipboard.read())[0].getType('text/html')).text());assert.equal((newsletter.match(/<h2>/g)||[]).length,2);assert.doesNotMatch(newsletter,/style=|<article|Tomorrow’s little adventures/);assert.match(newsletter,/<strong>When:<\/strong>/);
  await page.evaluate(()=>{const box=document.createElement('div');box.id='clipboard-check';box.contentEditable='true';document.querySelector('#export-dialog').append(box);});await page.locator('#clipboard-check').focus();await page.keyboard.press('Control+V');await page.waitForFunction(()=>document.querySelectorAll('#clipboard-check h2').length===2);assert.equal(await page.locator('#clipboard-check hr').count(),2);assert.ok(await page.locator('#clipboard-check strong').count()>2);await page.evaluate(()=>document.querySelector('#clipboard-check').remove());
  let pending=page.waitForEvent('download');await page.locator('#download-html').click();let download=await pending;let html=fs.readFileSync(await download.path(),'utf8');assert.match(html,/Paper &amp; Print Studio/);assert.doesNotMatch(html,/<script/);assert.equal((html.match(/<section/g)||[]).length,2);
  pending=page.waitForEvent('download');await page.locator('#download-text').click();download=await pending;assert.equal(fs.readFileSync(await download.path(),'utf8').replace(/\r\n/g,'\n'),clip.replace(/\r\n/g,'\n'));await page.screenshot({path:path.join(shots,'content-export-'+width+'.png')});await page.locator('#close-export').click();
  // Older lists can export using coordinates recovered by source ID.
  for(const item of lists.get(firstId).document.items)delete item.coordinates;
  await page.locator('#new-list').click();await page.locator('#save-status').filter({hasText:'Saved privately'}).waitFor();const secondId=await page.inputValue('#saved-lists');assert.notEqual(firstId,secondId);assert.equal(lists.get(secondId).document.items.length,0);await page.fill('#list-title','Another independent list');await page.locator('#save-status').filter({hasText:'Saved privately'}).waitFor();await page.selectOption('#saved-lists',firstId);await page.waitForFunction(()=>document.querySelector('#list-title').value==='Tomorrow’s little adventures');assert.equal(await page.locator('.pick').count(),2);
  pending=page.waitForEvent('download');await page.locator('#export-map').click();download=await pending;
  assert.match(download.suggestedFilename(),/-map\.html$/);
  const mapPath=path.join(shots,'content-map-'+width+'.html');
  await download.saveAs(mapPath);
  const mapPage=await context.newPage();
  await mapPage.goto(require('node:url').pathToFileURL(mapPath).href);
  assert.deepEqual(await mapPage.locator('li button').allTextContents(),['Paper & Print Studio','Jazz at the Garden']);
  await mapPage.locator('.pin').click();assert.equal(await mapPage.locator('.maplibregl-popup p').count(),2);
  const popup=mapPage.locator('.maplibregl-popup');
  assert.deepEqual(await popup.locator('p a').evaluateAll(links=>links.map(a=>[a.textContent,a.href])),[
    ['Paper & Print Studio','https://example.com/art'],['Jazz at the Garden','https://example.com/shared']
  ]);
  assert.equal(await popup.locator('.directions a').count(),2);
  await mapPage.getByRole('button',{name:'Jazz at the Garden',exact:true}).click();assert.equal(await mapPage.locator('.maplibregl-popup p').textContent(),'2. Jazz at the Garden');
  // Intercept the external pages and verify each real click opens the intended URL.
  for(const [label,href] of [
    ['Jazz at the Garden','https://example.com/shared'],
    ['Google Maps','https://www.google.com/maps/dir/?api=1&destination=30.27%2C-97.74'],
    ['Apple Maps','https://maps.apple.com/directions?destination=30.27%2C-97.74']
  ]){
    await context.route(href,r=>r.fulfill({contentType:'text/html',body:'Destination'}));
    const opened=mapPage.waitForEvent('popup');
    await popup.getByRole('link',{name:label,exact:true}).click();
    const destination=await opened;
    await destination.waitForURL(url=>url.href===href,{waitUntil:'domcontentloaded',timeout:10000});
    await destination.close();
  }
  await mapPage.waitForFunction(()=>document.querySelector('#status').textContent==='');
  await mapPage.screenshot({path:path.join(shots,'content-map-'+width+'.png')});
  await mapPage.close();await page.locator('#save-status').filter({hasText:'Saved privately'}).waitFor();
  assert.deepEqual(lists.get(firstId).document.items[0].coordinates,[-97.74,30.27]);
  await page.reload();await page.locator('#desk-content').waitFor();await page.selectOption('#saved-lists',firstId);await page.waitForFunction(()=>document.querySelector('#list-title').value==='Tomorrow’s little adventures');assert.equal(await page.locator('.pick').count(),2);
  if(width<650)await page.locator('#list-tab').click();await page.evaluate(()=>qa.fail=true);await page.fill('#list-intro','Keep this edit through a failed save');await page.locator('#save-retry').waitFor();assert.equal(await page.inputValue('#list-intro'),'Keep this edit through a failed save');await page.evaluate(()=>qa.fail=false);await page.locator('#save-retry').click();await page.locator('#save-status').filter({hasText:'Saved privately'}).waitFor();
  // Another tab's revision cannot be silently overwritten; keep a recoverable copy.
  lists.get(firstId).revision++;await page.fill('#list-intro','Conflicting draft to preserve');await page.locator('#save-copy').waitFor();await page.locator('#save-copy').click();await page.locator('#save-status').filter({hasText:'Saved privately'}).waitFor();assert.equal(await page.inputValue('#list-intro'),'Conflicting draft to preserve');assert.notEqual(await page.inputValue('#saved-lists'),firstId);
  if(width<650)await page.locator('#browse-tab').click();await page.locator('#clear-categories').click();await page.locator('[data-category="city-hall"]').check();await page.locator('.result').filter({hasText:'Public meeting fixture'}).waitFor();await page.locator('#clear-categories').click();await page.locator('[data-category="classifieds"]').check();await page.selectOption('#when','all');await page.locator('.result').filter({hasText:'Classified fixture'}).waitFor();
  await page.locator('#clear-categories').click();await page.locator('[data-category="businesses"]').check();await page.selectOption('#neighborhood','allandale');await page.waitForFunction(()=>document.querySelectorAll('.result').length>0);assert.ok((await page.locator('#business-category option').count())>2);
  await page.locator('#clear-categories').click();await page.locator('[data-category="pro-apps"]').check();await page.waitForFunction(()=>document.querySelectorAll('.result').length>0);assert.ok(await page.locator('.result').count());
  await page.locator('#clear-categories').click();await page.locator('[data-category="special-events"]').check();await page.waitForFunction(()=>!document.querySelector('#source-status').textContent.includes('Updating'));assert.equal(await page.locator('#source-status.error').count(),0);
  failFeeds=true;await page.locator('#event-categories').click();await page.locator('#refresh-results').click();await page.locator('#source-status').filter({hasText:'Could not refresh'}).waitFor();assert.equal(await page.locator('.pick').count(),2);failFeeds=false;await page.locator('#refresh-results').click();await page.waitForFunction(()=>!document.querySelector('#source-status').textContent.includes('Could not refresh')&&!document.querySelector('#source-status').textContent.includes('Updating'));
  await page.selectOption('#when','date');await page.fill('#on-date',later);await page.waitForFunction(()=>document.querySelector('#result-count').textContent==='1 listing');assert.match(await page.locator('.result').textContent(),/Later event/);await page.selectOption('#when','tomorrow');
  // An expired saved snapshot remains in the list even if current research has changed.
  musicCount=252;await page.locator('#refresh-results').click();
  await page.waitForFunction(()=>document.querySelector('#result-count').textContent==='255 listings'&&!document.querySelector('#select-matches').disabled);
  await bulk.click();assert.match(await page.locator('#pick-status').textContent(),/248 more/);assert.equal(await page.locator('.pick').count(),2);
  await page.locator('#clear-categories').click();await page.locator('[data-category="city-hall"]').check();await bulk.check();
  if(width<650)await page.locator('#list-tab').click();
  await page.locator('#export-map').click();await page.locator('#location-dialog').waitFor();
  await page.locator('#location-fields input').fill('30.265, -97.747');
  pending=page.waitForEvent('download');await page.locator('#finish-map').click();download=await pending;
  assert.match(fs.readFileSync(await download.path(),'utf8'),/data-lng="-97.747" data-lat="30.265">Public meeting fixture/);
  if(width<650)await page.locator('#browse-tab').click();await bulk.uncheck();
  assert.ok((await page.locator('.pick').count())===2);await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:path.join(shots,'content-dark-'+width+'.png'),fullPage:true});
  await page.evaluate(()=>{qa.delay=500;});await page.locator('#refresh-results').click();await page.evaluate(()=>setOwner(null));await page.locator('#desk-signin').waitFor();await page.waitForTimeout(600);assert.equal(await page.locator('#desk-content').isHidden(),true);assert.equal(await page.locator('.pick').count(),0);assert.equal(await page.inputValue('#list-intro'),'');assert.equal(await page.inputValue('#export-text'),'');assert.deepEqual(errors,[]);
  console.log(width+'px: owner gate, Browse parity, pagination, multiple saved lists, reorder/notes, reload, rich/plain clipboard, HTML/text downloads, failure/conflict recovery, extra categories and sign-out passed.');await context.close();
 }
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
