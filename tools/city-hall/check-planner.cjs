/* Meeting selections through the real UI; city feeds and auth are fixtures. */
const {chromium} = require('../video/node_modules/playwright-core');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http'), os = require('node:os');
const M = require('../../planner/model.js'), root = path.resolve(__dirname,'../..');
let browser, server;
async function serve() {
  const types = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};
  server=http.createServer((req,res)=>{
    let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${server.address().port}`;
}
async function frame(page,home=false){
  const f=await(await page.locator('#app-window').elementHandle()).contentFrame();
  await f.waitForFunction(home?()=>window.AustinCityHall?.close&&window.austinExplore&&window.PlanSelection:()=>window.PlanStore&&window.PlanPanel,{}, {timeout:45000});
  await f.evaluate(()=>PlanStore.ready());return f;
}
(async()=>{try{
  const base=process.argv[2]||await serve(),now=Date.now(),today=M.day(now),future=M.nextDay(M.nextDay(M.nextDay(M.nextDay(M.nextDay(today)))));
  const meeting=(id,title,time,dateOnly=false)=>({id,title,category:'meetings',source:'fixture',url:`https://www.austintexas.gov/events/${id}`,date:M.instant(`${future}T${time}`),dateOnly,expires:new Date(now+86400000).toISOString(),scope:'citywide',districts:[],board:'Fixture Board',location:'Austin City Hall · 301 W. 2nd Street'});
  const rows=[meeting('first','Future council meeting','10:00'),meeting('second','Future board meeting','10:30'),meeting('tba','Meeting awaiting a time','00:00',true)];
  const snapshot={version:1,generated:new Date(now).toISOString(),sources:[{id:'fixture',title:'City calendar fixture',url:'https://www.austintexas.gov/boards-commissions/events',category:'meetings',checked:new Date(now).toISOString(),ok:true}],records:rows};
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||path.join(os.homedir(),'.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  for(const width of [1280,390]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500});
    await context.route('https://*.supabase.co/**',route=>route.fulfill({status:400,json:{message:'No production account requests in this check'}}));
    await context.route('**/chat/data/city-hall.json',route=>route.fulfill({json:snapshot}));
    const page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);let f=await frame(page,true);
    await f.evaluate(async today=>{
      await PlanStore.chooseDay(today);
      await PlanStore.select({key:'place:today-fixture',title:'Today’s coffee',kind:'place',timing:'unknown',coordinates:[-97.743,30.267]},true);
      await PlanStore.edit(p=>{p.items[0].schedule.note='Keep my current day';p.items[0].schedule.duration=25;});
    },today);
    const original=await f.evaluate(()=>PlanStore.plan.items);
    await f.locator('#ctrlCityHall').click();await f.locator('[data-category=meetings]').click();
    const first=()=>f.getByRole('checkbox',{name:'Add Future council meeting to Day Planner',exact:true});
    const second=()=>f.getByRole('checkbox',{name:'Add Future board meeting to Day Planner',exact:true});
    const tba=()=>f.getByRole('checkbox',{name:'Add Meeting awaiting a time to Day Planner',exact:true});
    await first().check();await f.waitForFunction(day=>PlanStore.plan.date===day&&PlanStore.plan.items.length===1,future);
    assert.equal(await f.evaluate(()=>PlanStore.plan.items[0].schedule.start),rows[0].date);
    await second().check();await tba().check();
    await f.waitForFunction(()=>PlanStore.plan.items.length===3);
    assert.equal(await f.locator('#city-hall-panel .plan-select').count(),3);
    await f.locator('#city-hall-panel .explore-close').click();await f.locator('#ctrlDayPlan').click();
    assert.deepEqual(await f.locator('#day-plan-saved option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean)),[today,future]);
    await f.locator('#day-plan-saved').selectOption(today);
    await f.waitForFunction(day=>PlanStore.plan.date===day,today);
    assert.deepEqual(await f.evaluate(()=>PlanStore.plan.items),original);
    await f.locator('#day-plan-saved').selectOption(future);
    await f.locator('.plan-open').click();await page.waitForURL('**/dayplan/');f=await frame(page);
    await f.waitForFunction(()=>document.querySelectorAll('#plan-items .plan-item').length===3);
    assert.equal(await f.locator('#plan-day').inputValue(),future);
    assert.equal(await f.evaluate(()=>PlanModel.check(PlanStore.plan).conflicts),3);
    await f.locator('#build-day').click();
    await f.waitForFunction(()=>PlanStore.plan.items.find(i=>i.source.title==='Meeting awaiting a time').schedule.start===null);
    assert.match(await f.locator('#plan-items').innerText(),/check the agenda/i);
    await f.getByLabel('Visit length (min) for Future council meeting',{exact:true}).fill('10');
    await f.getByLabel('Visit length (min) for Future council meeting',{exact:true}).press('Tab');
    await f.getByLabel('Arrival time for Meeting awaiting a time',{exact:true}).fill('13:00');
    await f.getByLabel('Arrival time for Meeting awaiting a time',{exact:true}).press('Tab');
    await f.waitForFunction(()=>PlanModel.check(PlanStore.plan).conflicts===0);
    const saved=await f.evaluate(()=>PlanStore.plan.items);
    assert.equal(saved.find(i=>i.source.title==='Future council meeting').schedule.duration,10);
    assert.equal(saved.find(i=>i.source.title==='Future board meeting').schedule.start,rows[1].date);
    await f.locator('#plan-day').selectOption(today);await f.waitForFunction(day=>PlanStore.plan.date===day,today);
    assert.deepEqual(await f.evaluate(()=>PlanStore.plan.items),original);
    await f.locator('#plan-day').selectOption(future);await f.waitForFunction(day=>PlanStore.plan.date===day,future);
    assert.deepEqual(await f.evaluate(()=>PlanStore.plan.items),saved);
    await page.screenshot({path:`/tmp/city-hall-planner-${width}.png`});
    await page.locator('.brand').click();await page.waitForURL(base+'/');f=await frame(page,true);
    await f.locator('#ctrlCityHall').click();await f.locator('[data-category=meetings]').click();
    await first().waitFor();assert.equal(await first().isChecked(),true);assert.equal(await second().isChecked(),true);
    // Re-rendering a filtered list must preserve selection and avoid duplicates.
    await f.locator('#city-hall-panel [data-filter=query]').fill('council');assert.equal(await first().isChecked(),true);
    await f.locator('#city-hall-panel [data-filter=query]').fill('');
    await second().uncheck();await f.waitForFunction(()=>PlanStore.plan.items.length===2);
    assert.equal(await first().isChecked(),true);assert.equal(await tba().isChecked(),true);
    assert.deepEqual(await f.evaluate(today=>PlanStore.book.items.filter(i=>i.day===today),today),original);
    await page.screenshot({path:`/tmp/city-hall-checkboxes-${width}.png`});
    await page.reload();f=await frame(page,true);assert.equal(await f.evaluate(()=>PlanStore.book.items.length),0,'guest visit reset remains intact');
    assert.deepEqual(errors,[]);await context.close();
    console.log(`${width}px: meeting checkboxes, automatic new/same-day plans, dropdown navigation, existing-day preservation, timing review, conflict resolution, removal, selection restore and guest reset passed.`);
  }
}finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
