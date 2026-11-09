const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../shared/visit.js'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(framePath='/chat/') {
  const location=new URL('https://austin.chat/'),events={},views=[],replacements=[],historyCalls=[];
  const frame={contentWindow:{location:{pathname:framePath,replace:url=>replacements.push(url)},PlanPanel:{setView:on=>views.push(on)}}};
  const document={title:'',getElementById:id=>id==='app-window'?frame:null,querySelector:()=>({setAttribute(){}}),addEventListener(){}};
  const history={pushState(_a,_b,url){historyCalls.push(url);location.href=new URL(url,location).href;},replaceState(_a,_b,url){location.href=new URL(url,location).href;}};
  const window={addEventListener:(name,fn)=>events[name]=fn};window.parent=window.top=window;
  new Function('window','location','history','document','crypto',source)(window,location,history,document,{randomUUID:()=> 'visit-id'});
  return {visit:window.AustinVisit,location,views,replacements,historyCalls,events};
}
test('legacy planner links preserve query/hash and reuse the current map and visit',async()=>{
  const h=harness();h.visit.set('guest-plan',{stops:2});
  for(const path of ['/dayplan/','/myplanmap/','/planner/app.html']){
    assert.equal(h.visit.navigate(new URL('https://austin.chat'+path+'?from=bookmark#saved')),true);await tick();
    assert.equal(h.location.href,'https://austin.chat/?from=bookmark&planner=1#saved');
    assert.equal(h.views.at(-1),true);
  }
  h.visit.navigate(new URL('https://austin.chat/'));await tick();
  assert.equal(h.views.at(-1),false);assert.deepEqual(h.replacements,[]);
  assert.deepEqual(h.visit.get('guest-plan'),{stops:2});
  h.location.search='?planner=1';h.events.popstate();await tick();assert.equal(h.views.at(-1),true);
  assert.equal(h.visit.navigate(new URL('https://other.example/dayplan/')),false);
});
test('catalog navigation waits for pending saves and only the latest request wins',async()=>{
  const h=harness('/shopmap/');let finish;
  h.visit.track(new Promise(resolve=>finish=resolve));
  h.visit.navigate(new URL('https://austin.chat/dayplan/'));await tick();assert.deepEqual(h.replacements,[]);
  h.visit.navigate(new URL('https://austin.chat/'));finish();await tick();
  assert.equal(h.replacements.length,1);assert.match(h.replacements[0],/^\/chat\/\?v=\d+[a-z]+$/);assert.equal(h.visit.get('main:planner'),'false');
});
test('panel mode changes are represented in history without replacing the frame',()=>{
  const h=harness();h.visit.plannerView(true);h.visit.plannerView(true);
  assert.deepEqual(h.historyCalls,['/?planner=1']);h.visit.plannerView(false);
  assert.deepEqual(h.historyCalls,['/?planner=1','/']);assert.deepEqual(h.replacements,[]);
  h.events.pagehide();assert.equal(h.visit.closed,true);assert.equal(h.visit.get('main:planner'),null);
});
test('Special Event navigation and history preserve distinct guest collections',async()=>{
 const h=harness();h.visit.set('special-events:pages',[{id:'event-a',title:'Event A',page:'/maps/event-a/'}]);
 h.visit.set('planner:guest:main','main notes');h.visit.set('planner:guest:event-a','event notes');
 assert.equal(h.visit.navigate(new URL('https://austin.chat/maps/event-a/')),true);await tick();
 assert.match(h.replacements.at(-1),/^\/special-events\/map.html\?event=event-a&v=/);
 assert.equal(h.location.pathname,'/maps/event-a/');
 h.visit.navigate(new URL('https://austin.chat/?planner=1'));await tick();assert.equal(h.views.at(-1),true);
 h.location.href='https://austin.chat/maps/event-a/';h.events.popstate();await tick();assert.match(h.replacements.at(-1),/event=event-a/);
 assert.equal(h.visit.get('planner:guest:main'),'main notes');assert.equal(h.visit.get('planner:guest:event-a'),'event notes');
});
