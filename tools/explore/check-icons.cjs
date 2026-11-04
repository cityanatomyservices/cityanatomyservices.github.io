/* Real map rendering; local event fixtures and blocked account requests. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'../..'),ids=['free-cheap','movies','live-music','live-comedy','pop-up-markets','events'];
let browser,server;
async function serve(){
  server=http.createServer((req,res)=>{
    let file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.geojson':'application/json','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(data);});
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port;
}
(async()=>{try{
  const base=process.argv[2]||await serve(),now=Date.now(),start=new Date(now+3600000).toISOString(),end=new Date(now+7200000).toISOString();
  browser=await chromium.launch({executablePath:require('../browser.cjs').executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});
    await context.route('https://*.supabase.co/**',r=>r.fulfill({status:400,json:{message:'Fixtures only'}}));
    await context.route('**/chat/data/explore/*.geojson',route=>{
      const id=path.basename(new URL(route.request().url()).pathname,'.geojson').replace('events-festivals','events'),i=ids.indexOf(id),movie=id==='movies';
      const properties={id:'fixture-'+id,title:'Fixture '+id,venue:'Test venue',address:'Austin',url:'https://example.invalid/'+id,start,end,expires:new Date(now+86400000).toISOString(),checked:new Date(now).toISOString(),price:id==='free-cheap'?0:null,priceLabel:'Check admission',kind:movie?'movie':id==='free-cheap'?'event':'listing',theme:id,source:'Fixture',showtimes:movie?[{start,url:'https://example.invalid/ticket'}]:undefined};
      const features=[{type:'Feature',geometry:{type:'Point',coordinates:[-97.745+(i%3)*.0018,30.266+Math.floor(i/3)*.002]},properties}];
      // Two shows at one music venue retain a count beside the music note.
      if(id==='live-music')features.push({...features[0],properties:{...properties,id:'fixture-music-two',title:'Second concert'}});
      return route.fulfill({json:{type:'FeatureCollection',generated:new Date(now).toISOString(),sources:[],features}});
    });
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);const f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.waitForFunction(()=>window.austinExplore&&window.chatMap);
    await f.locator('#ctrlExplore').click();
    for(const id of ids)await f.locator('[data-layer='+id+']').check();
    await f.waitForFunction(()=>austinExplore.visibleItems.length===7).catch(async error=>{
      console.error(await f.evaluate(()=>({items:austinExplore.visibleItems.map(f=>f.properties.id),enabled:[...document.querySelectorAll('[data-layer]:checked')].map(el=>el.dataset.layer),when:document.querySelector('[data-filter=when]').value,status:document.querySelector('.explore-count').textContent,errors:document.querySelector('.explore-freshness').textContent})));
      throw error;
    });
    await f.locator('#explore-panel .explore-close').click();
    await f.evaluate(()=>chatMap.jumpTo({center:[-97.7432,30.267],zoom:16,pitch:0,bearing:0}));
    await f.waitForFunction(()=>!chatMap.isMoving());
    for(const id of ids){
      const info=await f.evaluate(id=>({type:chatMap.getLayer('explore-'+id+'-points').type,image:chatMap.getLayoutProperty('explore-'+id+'-points','icon-image'),present:chatMap.hasImage('explore-'+id+'-icon')}),id);
      assert.deepEqual(info,{type:'symbol',image:'explore-'+id+'-icon',present:true});
      await f.waitForFunction(id=>chatMap.queryRenderedFeatures({layers:['explore-'+id+'-points']}).length>0,id);
    }
    await page.screenshot({path:'/tmp/explore-icons-'+width+'.png'});
    await f.evaluate(()=>document.documentElement.dataset.theme='dark');await f.locator('#ctrlMapLayers').click();await f.locator('#ctrlSatellite').click();await f.locator('#map-layers-close').click();
    await page.screenshot({path:'/tmp/explore-icons-'+width+'-satellite-dark.png'});
    // An icon still opens all events sharing its venue without selecting chat.
    const at=await f.evaluate(()=>{const p=chatMap.project([-97.7414,30.266]);return{x:p.x,y:p.y};});
    await f.locator('#map').click({position:at});await f.locator('.explore-popup').waitFor();assert.match(await f.locator('.explore-popup').innerText(),/Fixture live-music/);assert.match(await f.locator('.explore-popup').innerText(),/Second concert/);
    // Reloading the base style re-creates the icon images, symbols and listeners.
    await f.evaluate(()=>chatMap.setStyle(MAP_CONFIG.basemap));
    await f.waitForFunction(()=>chatMap.hasImage('explore-live-music-icon')&&chatMap.getLayer('explore-live-music-points')?.type==='symbol');
    assert.deepEqual(errors,[]);await context.close();console.log(width+'px: all six card icons rendered, co-located counts/details, satellite/dark styling and style reload passed.');
  }
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
