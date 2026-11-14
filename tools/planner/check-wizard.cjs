/* Main Day Planner guidance, with isolated account/route fixtures and real map rendering. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const M=require('../../planner/model.js'),root=path.resolve(__dirname,'../..');
let browser,server;
async function serve(){
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};
 server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${server.address().port}`;
}
function session(member){const id=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+3600,enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return {access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,exp,role:'authenticated',is_anonymous:!member})+'.fixture',refresh_token:crypto.randomUUID(),expires_in:3600,expires_at:exp,token_type:'bearer',user:{id,is_anonymous:!member,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}};}
(async()=>{try{
 const base=process.argv[2]||await serve();browser=await chromium.launch({executablePath:require('../browser.cjs').executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const width of [1280,390])for(const member of [false,true]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500}),active=session(member),guest=session(false);let remote=null,routeCalls=0;
  await context.addInitScript(({active,member})=>{if(member&&window===window.top)localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(active));},{active,member});
  await context.route('https://*.supabase.co/**',route=>{
   const url=new URL(route.request().url()),body=route.request().postDataJSON(),p=url.pathname;
   if(p==='/auth/v1/signup')return route.fulfill({json:member?guest:active});
   if(p==='/auth/v1/user')return route.fulfill({json:active.user});
   if(p==='/auth/v1/token')return route.fulfill({json:active});
   if(p==='/rest/v1/rpc/member_load')return route.fulfill({json:{profile:{handle:'Fixture',show_avatar:false},favorites:[],preferences:{},progress:[]}});
   if(p==='/rest/v1/rpc/planner_load_scoped')return route.fulfill({json:remote});
   if(p==='/rest/v1/rpc/planner_save_scoped'){remote={plan:{id:body.p_id,...body.p_settings,items:body.p_items},revision:(remote?.revision||0)+1,dirty:false};return route.fulfill({json:{revision:remote.revision}});}
   if(p==='/rest/v1/rpc/planner_routing_status')return route.fulfill({json:{status:'ready',networkVersion:2}});
   if(p==='/rest/v1/rpc/planner_route_leg'){routeCalls++;return route.fulfill({json:{status:'ready',driveMinutes:6,accessMinutes:1,distanceMeters:1600,networkVersion:2,geometry:{type:'LineString',coordinates:[body.p_from,body.p_to]}}});}
   return route.fulfill({status:400,json:{message:'No production account requests in wizard check'}});
  });
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?planner=1');const f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.waitForFunction(()=>window.PlanWizard&&window.PlanStore&&window.chatMap);await f.evaluate(()=>PlanStore.ready());
  assert.equal(await f.locator('#plan-start button:visible').count(),1);assert.equal(await f.locator('#plan-upcoming-label').isHidden(),true);assert.equal(await f.locator('#plan-workspace').isHidden(),true);
  const days=await f.evaluate(()=>PlanStore.days.length);await f.locator('#add-day').click();assert.equal(await f.locator('dialog[open]').count(),0);await f.locator('#cancel-day').click();assert.equal(await f.evaluate(()=>PlanStore.days.length),days);
  await page.screenshot({path:path.resolve('..','.tmp',`planner-wizard-start-${width}-${member}.png`)});
  const date=M.nextDay(M.planDay());await f.locator('#add-day').click();await f.locator('#new-day-date').fill(date);await f.locator('#add-day-form [type=submit]').click();assert.equal(await f.locator('#plan-step-places').isVisible(),true);assert.equal(await f.locator('[data-plan-go=times]').first().isDisabled(),true);
  await f.evaluate(async()=>{for(let i=0;i<2;i++)await PlanStore.select({key:'wizard-'+i,title:['First visit','Second visit'][i],kind:'place',timing:'unknown',coordinates:[-97.7431+i*.002,30.2672+i*.002],address:'Austin',url:'https://example.invalid'},true);});
  await f.locator('[data-plan-go=times]').first().click();assert.equal(await f.locator('#plan-items .plan-item:visible').count(),1);assert.equal(await f.locator('#plan-step-times input[type=date]').count(),0);
  let card=f.locator('#plan-items .plan-item:visible');await card.locator('[data-field=start]').fill('10:00');await card.locator('[data-field=start]').press('Tab');await card.locator('[data-field=duration]').fill('60');await card.locator('[data-field=duration]').press('Tab');await f.locator('#plan-next-stop').click();
  card=f.locator('#plan-items .plan-item:visible');await card.locator('[data-field=start]').fill('10:30');await card.locator('[data-field=start]').press('Tab');await f.waitForFunction(()=>document.querySelector('#plan-time-warning').textContent.includes('time conflict'));
  assert.match(await card.locator('.stop-issues').textContent(),/overlap|overlaps|travel/i);
  await page.screenshot({path:path.resolve('..','.tmp',`planner-wizard-conflict-${width}-${member}.png`)});
  await card.locator('[data-field=start]').fill('01:00');await card.locator('[data-field=start]').press('Tab');assert.equal(await f.evaluate(()=>PlanModel.day(PlanStore.plan.items[1].schedule.start)),M.nextDay(date));
  await card.locator('[data-field=start]').fill('12:00');await card.locator('[data-field=start]').press('Tab');await f.waitForFunction(()=>document.querySelector('#plan-time-warning').hidden);
  await f.locator('#plan-finish-stops').click();await f.waitForFunction(()=>!PlanRouting.state.busy&&PlanStore.plan.routing?.enabled);assert.ok(routeCalls);assert.equal(await f.locator('#plan-panel').isVisible(),true,'phone keeps route guidance open');assert.equal(await f.locator('#plan-step-travel').isVisible(),true);
  await f.locator('[data-plan-go=review]').click();assert.equal(await f.locator('#plan-review-stops li').count(),2);await f.locator('#export-plan').click();assert.equal(await f.locator('#export-action').isEnabled(),true);await f.locator('#export-close').click();
  await page.locator('.theme-toggle').click();await page.screenshot({path:path.resolve('..','.tmp',`planner-wizard-review-dark-${width}-${member}.png`)});
  const original=await f.evaluate(()=>JSON.stringify(PlanStore.book));await f.locator('#plan-start-over').click();assert.equal(await f.locator('#plan-upcoming-label').isVisible(),true);assert.equal(await f.locator('#plan-upcoming option').count(),2);assert.equal(await f.locator('#plan-workspace').isHidden(),true);await f.locator('#plan-upcoming').selectOption(date);assert.equal(await f.evaluate(()=>JSON.stringify(PlanStore.book)),original);
  // Upcoming includes unfinished saved stops, excludes empty and past days, and never deletes them.
  await f.evaluate(async({past,empty})=>{await PlanStore.chooseDay(past);await PlanStore.select({key:'past',title:'Past stop',kind:'place',timing:'unknown'},true);await PlanStore.chooseDay(empty);},{past:M.previousDay(M.planDay()),empty:M.nextDay(date)});
  await f.locator('#plan-start-over').click();assert.deepEqual(await f.locator('#plan-upcoming option').evaluateAll(options=>options.map(o=>o.value)),['',date]);await f.locator('#plan-upcoming').selectOption(date);
  await f.locator('#plan-show-all').click();assert.equal(await f.locator('#plan-items .plan-item:visible').count(),2);await f.getByRole('button',{name:'Remove First visit',exact:true}).click();await f.getByRole('button',{name:'Remove Second visit',exact:true}).click();assert.equal(await f.locator('#plan-step-places').isVisible(),true);await f.locator('#undo').click();assert.equal(await f.evaluate(()=>PlanStore.plan.items.length),1);
  assert.equal(await f.locator('#plan-panel').evaluate(el=>el.scrollWidth>el.clientWidth),false);assert.deepEqual(errors,[]);if(member)await f.evaluate(()=>PlanStore.sync());await context.close();console.log(`${width}px ${member?'member':'guest'}: empty/upcoming entry, inline date, time-only stops, overlap warnings, next-morning times, route handoff, review, export, undo and themes passed.`);
 }
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}})().catch(error=>{console.error(error.stack);process.exitCode=1;});
