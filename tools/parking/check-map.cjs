/* Real parking data and rendering; account requests are intercepted. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),shots=path.resolve(root,'../.tmp');let server,browser;
async function serve(){
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};
 server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return `http://127.0.0.1:${server.address().port}`;
}
async function frame(page){const f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.waitForFunction(()=>window.AustinParking?.hit&&window.austinExplore&&window.chatMap);await f.evaluate(()=>PlanStore.ready());return f;}
async function loaded(f){await f.waitForFunction(()=>document.querySelector('#ctrlParking').getAttribute('aria-busy')!== 'true'&&!!chatMap.getLayer('parking-facilities-points'));}
(async()=>{try{
 const base=process.argv[2]||await serve();browser=await chromium.launch({executablePath:require('../browser.cjs').executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500}),requests=[],errors=[];
  await context.route('https://*.supabase.co/**',route=>{
   if(new URL(route.request().url()).pathname!=='/auth/v1/signup')return route.fulfill({status:400,json:{message:'No production writes in parking check'}});
   const id=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+3600,enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');return route.fulfill({json:{access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,exp,role:'authenticated',is_anonymous:true})+'.fixture',refresh_token:crypto.randomUUID(),expires_in:3600,expires_at:exp,token_type:'bearer',user:{id,is_anonymous:true,app_metadata:{},user_metadata:{},aud:'authenticated'}}});
  });
  const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/chat/data/parking/'))requests.push(r.url());});
  await page.goto(base);let f=await frame(page);await f.waitForFunction(()=>!chatMap.isMoving());
  assert.equal(await f.locator('.maplibregl-ctrl-top-left #ctrlParking').count(),1);assert.equal(await f.locator('#ctrlParking').getAttribute('aria-pressed'),'false');assert.equal(requests.length,0,'no data downloaded before parking is enabled');
  const plan=await f.evaluate(()=>JSON.stringify(PlanStore.book));
  await f.evaluate(()=>{window.parkingErrors=[];chatMap.on('error',e=>{if(/parking-/.test(e.error?.message||''))parkingErrors.push(e.error.message);});chatMap.jumpTo({center:[-97.7431,30.2672],zoom:16.3,pitch:0,bearing:0});});
  const camera=await f.evaluate(()=>({center:chatMap.getCenter().toArray(),zoom:chatMap.getZoom()}));
  await f.locator('#ctrlParking').click();await loaded(f);
  assert.equal(requests.length,3);assert.equal(await f.locator('#parking-key').isVisible(),true);assert.match(await f.locator('#parking-status').textContent(),/not live availability/);
  assert.deepEqual(await f.evaluate(()=>({center:chatMap.getCenter().toArray(),zoom:chatMap.getZoom()})),camera,'toggle does not move the map');
  await f.waitForFunction(()=>chatMap.queryRenderedFeatures({layers:['parking-facilities-points','parking-spaces-points','parking-zones-line']}).length>0);
  assert.ok(await f.evaluate(async()=>(await chatMap.getSource('parking-spaces').getData()).features.length>5000));
  assert.ok(await f.evaluate(async()=>(await chatMap.getSource('parking-facilities').getData()).features.length>100));
  await page.screenshot({path:path.join(shots,`parking-map-${width}.png`)});
  // Click a rendered parking point below the legend, rather than invoking a popup helper.
  const target=await f.evaluate(()=>{
    const map=chatMap,box=map.getContainer().getBoundingClientRect();
    for(const layer of ['parking-facilities-points','parking-spaces-points'])for(const feature of map.queryRenderedFeatures({layers:[layer]})){
      const p=map.project(feature.geometry.coordinates);if(p.x>45&&p.x<box.width-65&&p.y>420&&p.y<box.height-80)return {x:p.x,y:p.y};
    }
    return null;
  });assert.ok(target,'parking point available for a real map click');
  await f.locator('#map').click({position:target});await f.locator('.parking-popup').waitFor();
  assert.equal(await f.locator('.parking-popup a').count(),2);assert.equal(await f.locator('.parking-popup .plan-select').count(),0);assert.match(await f.locator('.parking-popup').textContent(),/not an available-space guarantee/);
  await page.screenshot({path:path.join(shots,`parking-popup-${width}.png`)});
  await f.locator('#ctrlParking').click();assert.equal(await f.locator('.parking-popup').count(),0);assert.equal(await f.locator('#parking-key').isHidden(),true);assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('parking-spaces-points','visibility')),'none');
  await f.locator('#ctrlParking').press('Enter');await loaded(f);assert.equal(requests.length,3,'cached snapshots are reused');
  await f.evaluate(()=>chatMap.fire('style.load'));assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('parking-facilities-points','visibility')),'visible');
  await f.locator('#ctrlChat').click();assert.equal(await f.locator('#parking-key').isHidden(),true);assert.equal(await f.evaluate(()=>chatMap.getLayoutProperty('parking-spaces-points','visibility')),'none');
  await f.evaluate(()=>PlanPanel.browse());await f.locator('#plan-panel-close').click();assert.equal(await f.locator('#parking-key').isVisible(),true);
  assert.equal(await f.evaluate(()=>JSON.stringify(PlanStore.book)),plan,'parking and map-mode changes do not edit or create a plan');
  await page.locator('.theme-toggle').click();await page.screenshot({path:path.join(shots,`parking-map-dark-${width}.png`)});
  assert.deepEqual(await f.evaluate(()=>parkingErrors),[]);assert.deepEqual(errors,[]);
  const n=requests.length;await page.reload();f=await frame(page);assert.equal(requests.length,n,'refresh starts with parking off');
  if(await f.locator('#plan-panel').isVisible())await f.locator('#plan-panel-close').click();
  // Failure is explicit, and toggling off during a delayed retry cannot repaint the map.
  await context.route('**/chat/data/parking/*',r=>r.fulfill({status:503,body:'Unavailable'}));await f.locator('#ctrlParking').click();await f.locator('#parking-status').filter({hasText:'could not load'}).waitFor();assert.equal(await f.locator('#ctrlParking').getAttribute('aria-pressed'),'false');await context.unroute('**/chat/data/parking/*');
  let release;const gate=new Promise(r=>release=r);
  await context.route('**/chat/data/parking/*',async r=>{await gate;await r.continue();});await f.locator('#ctrlParking').click();await f.locator('#ctrlParking').click();release();await f.waitForFunction(()=>!document.querySelector('#ctrlParking').hasAttribute('aria-busy'));assert.equal(await f.locator('#parking-key').isHidden(),true);assert.equal(await f.evaluate(()=>!!chatMap.getSource('parking-spaces')),false);
  await f.locator('#ctrlParking').click();await loaded(f);assert.equal(await f.locator('#parking-key').isVisible(),true);assert.deepEqual(errors,[]);
  await context.close();console.log(`${width}px: real parking, left P control, lazy load, on/off, popup, stable camera, unchanged planner, Chat isolation, themes, refresh, retry and late responses passed.`);
 }
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
