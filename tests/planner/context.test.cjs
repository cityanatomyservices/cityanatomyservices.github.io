const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync(require.resolve('../../planner/context.js'),'utf8');
async function fixture(path,events,{fail=false,now=Date.parse('2026-11-14T18:00:00Z')}={}){
 const memory=new Map([['austin:planner:v2:owner:main','main'],['austin:planner:v2:owner:event-a','event']]),sent=[],values=new Map();
 const storage=new Proxy({removeItem:k=>memory.delete(k)},{ownKeys:()=>[...memory.keys()],getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})});
 const window={AustinVisit:{set:(k,v)=>values.set(k,v)},addEventListener(){},dispatchEvent:e=>sent.push(e.type)};
 class Clock extends Date{static now(){return now;}}
 vm.runInNewContext(code,{window,location:new URL('https://austin.chat'+path),document:{addEventListener(){}},localStorage:storage,URLSearchParams,AbortSignal,CustomEvent:class{constructor(type){this.type=type;}},Date:Clock,setTimeout:()=>1,clearTimeout(){},fetch:async()=>{if(fail)throw Error('offline');return {ok:true,json:async()=>events};}});
 await window.PlanContext.ready;return {context:window.PlanContext,memory,sent,values,setNow:n=>now=n};
}
const events=[{id:'event-a',title:'Event A',page:'/maps/event-a/',dates:['2026-11-14'],expiresAt:'2026-11-16T23:00:00Z'}];
test('scope is determined by event map URL and expiry retires only that event cache',async()=>{
 const f=await fixture('/special-events/map.html?event=event-a',events);
 assert.equal(f.context.id,'event-a');f.context.assert();assert.equal(f.context.accepts({key:'special-event:event-a:1:2026-11-14',eventId:'event-a'}),true);
 assert.equal(f.context.accepts({key:'special-event:event-a:1:2026-11-14',eventId:'event-b'}),false);
 assert.equal(f.context.accepts({key:'place:coffee'}),false);
 f.setNow(Date.parse(events[0].expiresAt));assert.throws(()=>f.context.assert(),/expired/);
 assert.deepEqual([...f.memory.keys()],['austin:planner:v2:owner:main']);assert.deepEqual(f.sent,['austin:event-expired']);
});
test('a missing/expired event cannot fall back to main and an offline registry cannot disable main planning',async()=>{
 const missing=await fixture('/special-events/map.html?event=event-a',[]);assert.throws(()=>missing.context.assert(),/no longer available/);assert.equal(missing.context.id,'event-a');
 const invalid=await fixture('/special-events/map.html?event=main',events);assert.throws(()=>invalid.context.assert(),/Choose a Special Event/);
 const main=await fixture('/chat/?event=event-a',events,{fail:true});assert.equal(main.context.id,'main');main.context.assert();assert.equal(main.context.accepts({key:'place:coffee'}),true);
});
