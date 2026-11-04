/* Fixture accounts and ads only: no real sign-ins, emails or production writes. */
const {chromium}=require('../video/node_modules/playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),crypto=require('node:crypto');
const M=require('../../classifieds/model.js'),root=path.resolve(__dirname,'../..');let browser,server;
async function serve(){
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/json','.svg':'image/svg+xml'};
 server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(data);});});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return `http://127.0.0.1:${server.address().port}`;
}
function session(member){const id=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+3600,enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');return {access_token:enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:id,exp,role:'authenticated',is_anonymous:!member})+'.fixture',refresh_token:crypto.randomUUID(),expires_in:3600,expires_at:exp,token_type:'bearer',user:{id,email:member?'private-account@example.invalid':undefined,email_confirmed_at:member?new Date().toISOString():null,is_anonymous:!member,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}};}
async function frame(page){const f=await(await page.locator('#app-window').elementHandle()).contentFrame();await f.waitForFunction(()=>window.AustinClassifieds&&window.chatMap&&window.austinExplore);return f;}
(async()=>{try{
 const base=process.argv[2]||await serve();
 browser=await chromium.launch({executablePath:require('../browser.cjs').executablePath(),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const width of [1280,390])for(const member of [false,true]){
  const context=await browser.newContext({viewport:{width,height:900},isMobile:width<500,hasTouch:width<500}),active=session(member),guest=session(false),calls=[],errors=[];
  let own=null,loggedOut=false,holdRead=false,releaseRead;
  const other=(category,title,body='A note written by another member.')=>({id:crypto.randomUUID(),category,title,body,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),mine:false,revision:null});
  const others=[other('for-sale','<img src=x onerror=alert(1)>','Email chosen@example.invalid if interested.'),other('services','Help with gardening'),...Array.from({length:22},(_,i)=>({...other('community','Community note '+(i+1)),created_at:new Date(Date.now()-i*86400000).toISOString()}))];
  await context.addInitScript(({active,member})=>{if(member&&window===window.top&&!sessionStorage.getItem('classifieds-fixture')){sessionStorage.setItem('classifieds-fixture','1');localStorage.setItem('sb-aqbyxpiwugcvoephsvpm-auth-token',JSON.stringify(active));}},{active,member});
  await context.route('https://*.supabase.co/**',async route=>{
   const p=new URL(route.request().url()).pathname,body=route.request().postDataJSON();
   if(p==='/auth/v1/signup')return route.fulfill({json:guest});
   if(p==='/auth/v1/token')return route.fulfill({json:active});
   if(p==='/auth/v1/user')return route.fulfill({json:loggedOut?guest.user:active.user});
   if(p==='/auth/v1/logout'){loggedOut=true;return route.fulfill({status:204});}
   if(p==='/auth/v1/settings')return route.fulfill({json:{external:{google:true,email:true}}});
   if(p==='/rest/v1/rpc/member_load')return route.fulfill({json:{profile:{handle:'Fixture',emoji:'🦊',show_avatar:false},favorites:[],preferences:{},progress:[]}});
   if(['/rest/v1/rpc/planner_load','/rest/v1/rpc/member_preference_set'].includes(p))return route.fulfill({json:null});
   if(p==='/functions/v1/reminders')return route.fulfill({json:{enabled:false,reminders:[]}});
   if(p.startsWith('/rest/v1/rpc/classifieds_')){
    calls.push({p,body});if(!member||loggedOut)return route.fulfill({status:403,json:{message:'Sign in to use free classifieds.'}});
    if(p.endsWith('classifieds_read')){
     const all=own?[own,...others]:others,rows=all.filter(a=>a.category===body.p_category);
     const data={categories:M.categories.map(c=>({...c,count:all.filter(a=>a.category===c.id).length})),mine:own,ads:rows.slice(body.p_offset,body.p_offset+20),total:rows.length,more:body.p_offset+20<rows.length};
     if(holdRead){holdRead=false;await new Promise(resolve=>releaseRead=resolve);}
     return route.fulfill({json:data}).catch(()=>{});
    }
    if(body.p_owner_id!==active.user.id)return route.fulfill({status:403,json:{message:'Account changed.'}});
    if(body.p_expected_revision!==(own?.revision||0)||body.p_expected_id!==(own?.id||null))return route.fulfill({status:409,json:{message:'Your ad changed in another window. Refresh before editing.'}});
    if(p.endsWith('classifieds_delete')){own=null;return route.fulfill({json:null});}
    own={id:own?.id||crypto.randomUUID(),category:body.p_category,title:body.p_title,body:body.p_body,revision:(own?.revision||0)+1,mine:true,created_at:own?.created_at||new Date().toISOString(),updated_at:new Date().toISOString()};return route.fulfill({json:own});
   }
   return route.fulfill({status:400,json:{message:'No production requests in this test.'}});
  });
  const page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});page.on('dialog',d=>d.accept());
  await page.goto(base+'/');let f=await frame(page);await f.locator('#ctrlExplore').click();await f.locator('#ctrlClassifieds').click();
  const panel=f.locator('#classifieds-panel');await panel.waitFor();
  if(!member){
   assert.match(await panel.innerText(),/Create an account or sign in/);assert.equal(await panel.locator('.classifieds-categories a:visible').count(),0);assert.equal(calls.length,0);
   await panel.getByRole('button',{name:'Create an account / sign in'}).click();await page.locator('#account-dialog').waitFor({state:'visible'});await page.locator('.account-close').click();
   await page.goto(base+'/classifieds/for-sale/');await page.locator('.classifieds-guest').waitFor();assert.equal(await page.locator('.classifieds-ad').count(),0);assert.equal(calls.length,0);
   await page.screenshot({path:`/tmp/classifieds-guest-${width}.png`});
  }else{
   await panel.locator('.classifieds-categories a').first().waitFor();assert.equal(await panel.locator('[data-classifieds-filter=category] option').count(),8);
   assert.match(await panel.locator('[data-classifieds-filter=category] option[value=for-sale]').innerText(),/\(1\)/);
   await panel.getByRole('button',{name:'Post your free ad',exact:true}).click();const dialog=f.locator('.classifieds-dialog');await dialog.getByRole('button',{name:'For Sale',exact:true}).click();
   assert.equal(await dialog.locator('input,textarea,select').count(),2);assert.equal(await dialog.locator('input[type=email],input[type=file]').count(),0);
   await dialog.getByLabel('Title',{exact:true}).fill('My desk');await dialog.getByLabel('Paragraph',{exact:true}).fill('A useful desk. Write to chosen@example.invalid or call (512) 555-0123. Pickup at 123 Main Street.');
   await dialog.getByRole('button',{name:'Post free ad',exact:true}).click();await dialog.waitFor({state:'hidden'});await panel.locator('.classifieds-editor').waitFor();
   assert.equal(await panel.getByLabel('Title',{exact:true}).inputValue(),'My desk');assert.equal(await panel.getByRole('button',{name:'Post your free ad',exact:true}).isVisible(),false);
   assert.match(await panel.locator('[data-classifieds-filter=category] option[value=for-sale]').innerText(),/\(2\)/);
   assert.ok(!await panel.innerText().then(t=>t.includes('private-account@example.invalid')));
   // Date sorting must include records beyond the API's first page.
   await panel.getByLabel('Classifieds category',{exact:true}).selectOption('community');
   await f.locator('[data-filter=when]').selectOption('all');
   await panel.locator('.classifieds-status').filter({hasText:'22 matching ads'}).waitFor();
   await panel.getByLabel('Sort by date',{exact:true}).selectOption('asc');
   assert.equal(await panel.locator('.classifieds-ad h2').first().textContent(),'Community note 22');
   await panel.getByLabel('Sort by date',{exact:true}).selectOption('desc');
   assert.equal(await panel.locator('.classifieds-ad h2').first().textContent(),'Community note 1');
   await panel.getByRole('button',{name:'Show more ads',exact:true}).click();assert.equal(await panel.locator('.classifieds-ad').count(),22);
   const oldDate=await f.evaluate(value=>ExploreModel.dayKey(value),others.at(-1).created_at);
   await f.locator('[data-filter=date]').fill(oldDate);assert.equal(await panel.locator('.classifieds-ad').count(),1);assert.equal(await panel.locator('.classifieds-ad h2').textContent(),'Community note 22');
   await f.locator('[data-when=week]').click();assert.equal(await panel.locator('.classifieds-ad').count(),7);
   await panel.getByLabel('Classifieds category',{exact:true}).selectOption('for-sale');await panel.locator('.classifieds-editor').waitFor();
   await panel.getByLabel('Title',{exact:true}).fill('Unsaved draft');await f.locator('[data-filter=when]').selectOption('all');assert.equal(await panel.getByLabel('Title',{exact:true}).inputValue(),'Unsaved draft');
   await panel.evaluate(p=>p.scrollTop=0);await page.screenshot({path:`/tmp/classifieds-panel-${width}.png`});
   // Programmatic planner opening also closes classifieds on the same map.
   await f.evaluate(()=>PlanPanel.open());assert.equal(await panel.isVisible(),false);await f.locator('#plan-panel-close').click();await f.locator('#ctrlExplore').click();if(await f.locator('#ctrlClassifieds').getAttribute('aria-expanded')!=='true')await f.locator('#ctrlClassifieds').click();assert.equal(await f.evaluate(()=>PlanPanel.active),false);
   await panel.getByRole('link',{name:/For Sale/}).click();await page.waitForURL(base+'/classifieds/for-sale/');await page.locator('.classifieds-editor').waitFor();
   assert.equal(await page.locator('.classifieds-ad').count(),1);assert.equal(await page.locator('.classifieds-ad input,.classifieds-ad textarea,.classifieds-ad img').count(),0);assert.equal(await page.locator('.classifieds-ad h2').textContent(),'<img src=x onerror=alert(1)>');
   assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'My desk');
   await page.getByLabel('Title',{exact:true}).fill('My updated desk');await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByText('Your ad was saved.',{exact:true}).waitFor();
   await page.reload();await page.locator('.classifieds-editor').waitFor();assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'My updated desk');
   // A stale form keeps the user's draft and does not overwrite a newer ad.
   own={...own,revision:own.revision+1};await page.getByLabel('Title',{exact:true}).fill('Draft after another edit');await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByText(/Your ad changed in another window/).waitFor();assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'Draft after another edit');
   await page.getByRole('button',{name:'Refresh ads',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.classifieds-editor input')?.value==='My updated desk');
   await page.getByRole('button',{name:'Change category',exact:true}).click();await page.locator('.classifieds-choices').getByRole('button',{name:'Services',exact:true}).click();await page.getByRole('button',{name:'Save changes',exact:true}).click();
   await page.getByRole('link',{name:'Edit your ad in Services'}).waitFor();assert.equal(await page.locator('.classifieds-editor').count(),0);assert.equal(await page.locator('.classifieds-ad').count(),1);
   await page.getByRole('link',{name:'Edit your ad in Services'}).click();await page.waitForURL(base+'/classifieds/services/');await page.locator('.classifieds-editor').waitFor();assert.equal(await page.locator('.classifieds-ad').count(),1);
   await page.screenshot({path:`/tmp/classifieds-category-${width}.png`});await page.locator('.theme-toggle').click();await page.screenshot({path:`/tmp/classifieds-category-dark-${width}.png`});
   await page.getByRole('button',{name:'Delete your ad',exact:true}).click();await page.getByRole('button',{name:'Post your free ad',exact:true}).waitFor();assert.equal(own,null);
   await page.goto(base+'/classifieds/community/');await page.waitForFunction(()=>document.querySelectorAll('.classifieds-ad').length===20);await page.getByRole('button',{name:'Show more ads'}).click();await page.waitForFunction(()=>document.querySelectorAll('.classifieds-ad').length===22);assert.equal(await page.getByRole('button',{name:'Show more ads'}).isVisible(),false);
   holdRead=true;await page.getByRole('button',{name:'Refresh ads',exact:true}).click();for(let i=0;i<100&&!releaseRead;i++)await new Promise(r=>setTimeout(r,20));assert.ok(releaseRead);
   await page.evaluate(()=>AustinSession.signOut());releaseRead();await page.locator('.classifieds-guest').waitFor();assert.equal(await page.locator('.classifieds-ad,.classifieds-editor').count(),0);assert.equal(await page.locator('.classifieds-dialog').isVisible(),false);
   const before=calls.length;await page.reload();await page.locator('.classifieds-guest').waitFor();assert.equal(await page.locator('.classifieds-ad').count(),0);assert.equal(calls.length,before);
  }
  assert.deepEqual(errors,[]);await context.close();console.log(`${width}px ${member?'member':'guest'}: classifieds visibility, account boundaries and ${member?'create/edit/delete, category counts/pages, text-only rendering, pagination, conflicts and sign-out':'sign-in prompt and direct-page gate'} passed.`);
 }
}finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
