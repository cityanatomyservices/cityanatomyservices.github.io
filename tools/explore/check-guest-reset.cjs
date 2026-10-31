/* Browser regression for visit-only Explore state. Authentication and feeds
   use fixtures: no accounts, email or production data are created or changed. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),storageKey='austin-explore-v1',authKey='sb-aqbyxpiwugcvoephsvpm-auth-token';
const memberId=crypto.randomUUID(),now=Date.now();
function session(anonymous=false){
  const id=anonymous?crypto.randomUUID():memberId,exp=Math.floor(Date.now()/1000)+3600;
  const user={id,is_anonymous:anonymous,aud:'authenticated',role:'authenticated',email:anonymous?'':'fixture@example.invalid',user_metadata:{},app_metadata:{provider:anonymous?'anonymous':'email'}};
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  return {access_token:encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:id,exp,role:'authenticated',is_anonymous:anonymous})+'.fixture',refresh_token:crypto.randomUUID(),expires_at:exp,expires_in:3600,token_type:'bearer',user};
}
async function server(){
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};
  const s=http.createServer((req,res)=>{
    let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});
  });
  await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));return s;
}
let browser,local;
(async()=>{try{
  if(!process.argv[2])local=await server();
  const base=process.argv[2]||`http://127.0.0.1:${local.address().port}`;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||path.join(os.homedir(),'.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  async function context({legacy=false,member=false}={}){
    const c=await browser.newContext({viewport:{width:1280,height:900}});
    let active=session(!member),preferences=member?{explore:{enabled:['live-music'],when:'week',price:'20',kind:'all',movieType:'all'}}:{};
    await c.route('https://*.supabase.co/**',async route=>{
      const u=new URL(route.request().url()),p=u.pathname;
      if(p==='/auth/v1/signup'){active=session(true);return route.fulfill({json:active});}
      if(p==='/auth/v1/logout')return route.fulfill({status:204});
      if(p==='/auth/v1/user')return route.fulfill({json:active.user});
      if(p==='/auth/v1/token')return route.fulfill({json:active});
      if(p==='/rest/v1/rpc/member_load')return route.fulfill({json:{profile:{handle:'FixtureFox',emoji:'🦊',show_avatar:false},favorites:[],preferences,progress:[]}});
      if(p==='/rest/v1/rpc/member_preference_set'){const body=route.request().postDataJSON();preferences[body.p_key]=body.p_value;return route.fulfill({json:null});}
      if(p==='/rest/v1/rpc/planner_load')return route.fulfill({json:null});
      return route.fulfill({status:400,json:{message:'Unexpected fixture request: '+p}});
    });
    await c.route('**/chat/data/explore/*.geojson',route=>{
      const id=path.basename(new URL(route.request().url()).pathname,'.geojson');
      const feature={type:'Feature',geometry:{type:'Point',coordinates:[-97.7431,30.2672]},properties:{id:'fixture-'+id,title:'Fixture '+id,venue:'Fixture venue',address:'Austin',kind:'event',price:0,priceLabel:'Free',url:'https://example.invalid/event',source:'Fixture',checked:new Date(now).toISOString(),start:new Date(now-60000).toISOString(),end:new Date(now+2*3600000).toISOString(),expires:new Date(now+24*3600000).toISOString()}};
      return route.fulfill({json:{type:'FeatureCollection',generated:new Date(now).toISOString(),sources:[],features:[feature]}});
    });
    if(legacy||member)await c.addInitScript(({storageKey,authKey,active,member})=>{
      if(window!==window.top||sessionStorage.getItem('fixture-seeded'))return;
      sessionStorage.setItem('fixture-seeded','yes');
      localStorage.setItem(storageKey,JSON.stringify({enabled:['live-music'],when:member?'week':'tonight',query:member?'':'Old search',where:'map'}));
      if(member)localStorage.setItem(authKey,JSON.stringify(active));
    },{storageKey,authKey,active,member});
    return c;
  }
  async function frame(page){
    await page.waitForFunction(()=>window.AustinSession);
    const f=await(await page.locator('#app-window').elementHandle()).contentFrame();
    await f.waitForFunction(()=>window.austinExplore&&window.chatMap,{},{timeout:45000});return f;
  }
  async function blank(f){
    await f.waitForFunction(()=>austinExplore.visibleItems.length===0&&!document.querySelector('[data-layer]:checked'));
    assert.equal(await f.locator('[data-filter=query]').inputValue(),'');
    assert.equal(await f.locator('[data-filter=where]').inputValue(),'all');
    assert.equal(await f.locator('#explore-panel').isHidden(),true);
    await f.waitForFunction(async()=> (await Promise.all(EXPLORE_LAYERS.map(l=>chatMap.getSource('explore-'+l.id).getData()))).every(data=>data.features.length===0));
  }
  for(const legacy of [false,true]){
    const c=await context({legacy}),page=await c.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);let f=await frame(page);await blank(f);
    const stored=await page.evaluate(k=>localStorage.getItem(k),storageKey);
    await f.locator('#ctrlExplore').click();await f.locator('label:has([data-layer=free-cheap])').click();
    await f.waitForFunction(()=>austinExplore.visibleItems.length===1);
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),storageKey),stored,'guest choices never update persistent storage');
    await f.locator('[data-filter=query]').fill('Fixture');
    await f.evaluate(async()=>{await PlanStore.ready();await PlanStore.select({key:'place:fixture',title:'Temporary stop',kind:'place',timing:'unknown',coordinates:[-97.743,30.267]},true);});
    await page.evaluate(()=>AustinVisit.navigate(new URL('/myplanmap/',location.origin)));
    await page.waitForURL('**/myplanmap/');
    let planner=await(await page.locator('#app-window').elementHandle()).contentFrame();
    await planner.waitForFunction(()=>window.PlanStore);await planner.evaluate(()=>PlanStore.ready());
    assert.equal(await planner.evaluate(()=>PlanStore.book.items.length),1);
    await page.locator('.brand').click();await page.waitForURL(base+'/');f=await frame(page);
    await f.waitForFunction(()=>austinExplore.visibleItems.length===1);assert.equal(await f.locator('[data-filter=query]').inputValue(),'Fixture');
    await page.reload();f=await frame(page);await blank(f);
    await f.evaluate(()=>PlanStore.ready());assert.equal(await f.evaluate(()=>PlanStore.book.items.length),0);
    // Another tab's persistent choices cannot enable layers in a guest tab.
    await f.evaluate(k=>window.dispatchEvent(new StorageEvent('storage',{key:k,newValue:JSON.stringify({enabled:['live-music']})})),storageKey);await blank(f);
    const other=await c.newPage();await other.goto(base);await blank(await frame(other));
    assert.deepEqual(errors,[]);console.log(`${legacy?'Legacy saved':'Fresh'} guest: blank start, working pins, visit navigation, refresh, planner reset and tab isolation passed.`);
    await c.close();
  }
  const c=await context({member:true}),page=await c.newPage();await page.goto(base);let f=await frame(page);
  await f.waitForFunction(()=>austinExplore.visibleItems.length===1&&document.querySelector('[data-layer=live-music]').checked);
  await f.locator('#ctrlExplore').click();await f.locator('label:has([data-layer=free-cheap])').click();await page.evaluate(()=>AustinVisit.settled());
  await page.reload();f=await frame(page);await f.waitForFunction(()=>document.querySelector('[data-layer=free-cheap]').checked&&document.querySelector('[data-layer=live-music]').checked);
  await page.evaluate(()=>AustinSession.signOut());await blank(f);
  await page.reload();await blank(await frame(page));
  console.log('Registered preferences still restore; sign-out and subsequent guest refresh clear all pins.');
  await page.screenshot({path:'/tmp/austin-guest-reset.png'});await c.close();
}finally{if(browser)await browser.close();if(local)await new Promise(resolve=>local.close(resolve));}})().catch(error=>{console.error(error.stack);process.exitCode=1;});
