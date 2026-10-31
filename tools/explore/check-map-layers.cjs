/* Main-map controls and real boundary rendering. Auth is simulated; no real
   accounts are created and no Supabase writes leave this browser context. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');let browser,server;
async function serve(){
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};
 server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${server.address().port}`;
}
async function ready(page){const f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.waitForFunction(()=>window.chatMap&&window.austinExplore&&window.AustinMapLayers?.close,{},{timeout:45000});await f.waitForFunction(()=>!chatMap.isMoving());return f;}
async function layersOpen(f){if(await f.locator('#map-layers-panel').isHidden())await f.locator('#ctrlMapLayers').click();}
(async()=>{try{
 const base=process.argv[2]||await serve();
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||path.join(os.homedir(),'.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});
  await context.route('https://*.supabase.co/**',route=>{
   if(new URL(route.request().url()).pathname!=='/auth/v1/signup')return route.fulfill({status:400,json:{message:'No live account requests in this check'}});
   const id=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+3600,encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
   return route.fulfill({json:{access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:id,exp,role:'authenticated',is_anonymous:true})+'.fixture',refresh_token:crypto.randomUUID(),expires_in:3600,expires_at:exp,token_type:'bearer',user:{id,is_anonymous:true,app_metadata:{},user_metadata:{},aud:'authenticated'}}});
  });
  const page=await context.newPage(),errors=[],boundaryRequests=[];page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/\/(zipcodes|council_districts)\.geojson/.test(r.url()))boundaryRequests.push(r.url());});
  await page.goto(base);let f=await ready(page);
  assert.deepEqual(await f.locator('#stack > button').evaluateAll(buttons=>buttons.map(b=>b.id)),['ctrlExplore','ctrlDayPlan','ctrlChat','ctrlApps','ctrlLocate','ctrlMapLayers']);
  assert.equal(await f.locator('#ctrlMedia,#media-panel').count(),0);assert.equal(await f.locator('#map-layers-panel').isHidden(),true);
  assert.equal(boundaryRequests.length,0,'boundaries are not downloaded by default');
  assert.equal(await f.locator('#ctrlTilt').getAttribute('aria-pressed'),'true');assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('satellite','visibility')),'none');
  assert.ok(await f.evaluate(()=>chatMap.getPitch()>50));
  await f.evaluate(()=>{window.boundaryErrors=[];chatMap.on('error',e=>{if(/boundary-|zipcodes|council_districts/.test(e.error?.message||''))boundaryErrors.push(e.error.message);});});
  for(const [control,panel] of [['ctrlExplore','explore-panel'],['ctrlDayPlan','day-plan-panel'],['ctrlChat','legend'],['ctrlApps','apps-panel']]){
   await layersOpen(f);await f.locator('#'+control).click();assert.equal(await f.locator('#map-layers-panel').isHidden(),true);assert.equal(await f.locator('#'+panel).isVisible(),true);
   // Existing phone Explore/Day Plan panels span the map and cover lower
   // controls; use their normal close buttons before switching on a phone.
   if(width<500&&control==='ctrlExplore')await f.locator('.explore-close').click();
   if(width<500&&control==='ctrlDayPlan')await f.getByRole('button',{name:'Close Day Plan',exact:true}).click();
   await f.locator('#ctrlMapLayers').click();assert.equal(await f.locator('#'+panel).isHidden(),true);assert.equal(await f.locator('#map-layers-panel').isVisible(),true);
  }
  await f.locator('#map-layers-close').press('Escape');assert.equal(await f.locator('#map-layers-panel').isHidden(),true);assert.equal(await f.locator('#ctrlMapLayers').evaluate(el=>el===document.activeElement),true);
  await layersOpen(f);await f.locator('#ctrlTilt').click();await f.waitForFunction(()=>chatMap.getPitch()===0);
  await f.locator('#ctrlTilt').click();await f.waitForFunction(()=>chatMap.getPitch()>50);
  await f.locator('#ctrlSatellite').click();assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('satellite','visibility')),'visible');
  await f.locator('#ctrlSatellite').click();assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('satellite','visibility')),'none');
  await f.locator('#ctrlExtent').click();await f.waitForFunction(()=>!chatMap.isMoving()&&chatMap.getPitch()===0);assert.equal(await f.locator('#ctrlTilt').getAttribute('aria-pressed'),'false');
  const camera=await f.evaluate(()=>({center:chatMap.getCenter().toArray(),zoom:chatMap.getZoom()}));
  for(const [input,id,count] of [['layerZipCodes','zip',103],['layerCouncilDistricts','council',10]]){
   await f.locator('#'+input).check();await f.waitForFunction(id=>chatMap.getLayer('boundary-'+id+'-line')&&chatMap.getLayoutProperty('boundary-'+id+'-line','visibility')==='visible',id);
   assert.equal(await f.evaluate(async id=>(await chatMap.getSource('boundary-'+id).getData()).features.length,id),count);
   await f.waitForFunction(id=>chatMap.queryRenderedFeatures({layers:['boundary-'+id+'-line']}).length>0,id);
  }
  assert.deepEqual(await f.evaluate(()=>({center:chatMap.getCenter().toArray(),zoom:chatMap.getZoom()})),camera,'boundary toggles do not move the map');
  assert.deepEqual(await f.evaluate(()=>boundaryErrors),[]);
  const bounds=await f.locator('#map-layers-panel').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width&&bounds.height<900,'panel fits the viewport');
  await page.screenshot({path:`/tmp/austin-map-layers-${width}.png`});
  await page.evaluate(()=>{localStorage.setItem('theme','dark');document.documentElement.dataset.theme='dark';});await f.evaluate(()=>{document.documentElement.dataset.theme='dark';});
  await page.screenshot({path:`/tmp/austin-map-layers-${width}-dark.png`});
  for(const [input,id] of [['layerZipCodes','zip'],['layerCouncilDistricts','council']]){await f.locator('#'+input).uncheck();assert.equal(await f.evaluate(id=>chatMap.getLayoutProperty('boundary-'+id+'-line','visibility'),id),'none');}
  await page.reload();f=await ready(page);assert.equal(await f.locator('[data-boundary]:checked').count(),0);assert.equal(await f.evaluate(()=>!!chatMap.getSource('boundary-zip')||!!chatMap.getSource('boundary-council')),false);
  assert.equal(await f.locator('#ctrlTilt').getAttribute('aria-pressed'),'true');assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('satellite','visibility')),'none');
  // A failed load is actionable and retrying the toggle succeeds.
  await context.route('**/datacenters/data/zipcodes.geojson?*',route=>route.fulfill({status:503,body:'Unavailable'}),{times:1});
  await layersOpen(f);await f.locator('#layerZipCodes').click();await f.locator('[data-boundary-status=zip]').filter({hasText:'Could not load'}).waitFor();assert.equal(await f.locator('#layerZipCodes').isChecked(),false);
  let release;const gate=new Promise(resolve=>{release=resolve;});
  await context.route('**/datacenters/data/zipcodes.geojson?*',async route=>{await gate;await route.continue();},{times:1});
  await f.locator('#layerZipCodes').check();await f.locator('[data-boundary-status=zip]').filter({hasText:'Loading'}).waitFor();await f.locator('#layerZipCodes').uncheck();release();
  await f.waitForFunction(()=>!document.querySelector('[data-boundary-status=zip]').textContent);
  await f.locator('#layerZipCodes').check();await f.waitForFunction(()=>chatMap.getLayer('boundary-zip-line')&&chatMap.getLayoutProperty('boundary-zip-line','visibility')==='visible');
  assert.deepEqual(errors,[]);
  console.log(`${width}px: order, exclusive panels, view controls, both real boundary layers, stable camera, light/dark layout, refresh, failed-load retry and pending-load toggles passed.`);
  // Catalog maps retain their previous controls and have no new Map layers panel.
  await page.goto(base+'/apps/austin-pizza/');const catalog=await(await page.locator('#app-window').elementHandle()).contentFrame();await catalog.locator('[data-map-ui-ready=true]').waitFor();
  assert.deepEqual(await catalog.locator('#stack > button').evaluateAll(buttons=>buttons.map(b=>b.id)),['ctrlApps','ctrlMedia','ctrlDayPlan','ctrlChat','ctrlExplore','ctrlLocate','ctrlTilt','ctrlSatellite','ctrlExtent']);
  assert.equal(await catalog.locator('#ctrlMapLayers').count(),0);await catalog.locator('#ctrlMedia').click();assert.equal(await catalog.locator('#media-panel').isVisible(),true);
  console.log(`${width}px: catalog map retains its existing button order and Media menu.`);await context.close();
 }
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
