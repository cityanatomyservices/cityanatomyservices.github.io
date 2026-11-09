/* Planner persistence. Guest plans live only in AustinVisit memory; registered
   accounts keep the existing private cache, cloud saves and revision checks. */
(() => {
  const M=window.PlanModel,R=window.PlanRepository,V=window.AustinVisit,C=window.PlanContext;
  const prefix='austin:planner:v2:',legacyPrefix='austin:planner:v1:',guestKey='planner:guest:'+C.id,listeners=new Set();
  const cacheKey=identity=>prefix+identity+':'+C.id;
  const fresh=()=>{const plan=M.empty(crypto.randomUUID());plan.scope=C.id;
    if(C.event){plan.days=[];plan.daySettings={};for(const d of C.event.dates)M.ensureDay(plan,d);plan.date=C.event.dates.find(d=>d>=M.day())||C.event.dates[0];plan.expiresAt=C.event.expiresAt;}
    return {plan,revision:0,dirty:false,stamp:''};};
  const temporary='Temporary plan · refresh or close clears it';
  let owner=null,client=null,key=cacheKey('guest'),timer,started,conflict=false,registered=false,observedClient,authSubscription,epoch=0;
  let status='Opening your plan…',persistent=true,envelope=fresh();
  const copy=value=>structuredClone(value);
  const lock=(name,fn)=>navigator.locks?navigator.locks.request(name,fn):Promise.resolve().then(fn);
  function read(k=key) {
    try {const e=JSON.parse(registered?localStorage.getItem(k):V.get(guestKey));if(e)e.plan=M.upgrade(e.plan);if(e?.plan?.expiresAt&&Date.parse(e.plan.expiresAt)<=Date.now()){localStorage.removeItem(k);V.remove(guestKey);return null;}return M.valid(e?.plan)&&e.plan.scope===C.id&&e.plan.items.every(i=>C.accepts(i.source))?e:null;}catch(_){return null;}
  }
  function notify(){for(const fn of listeners)fn();}
  function persist() {
    if(C.event)envelope.plan.expiresAt=C.event.expiresAt;
    if(!registered){V.set(guestKey,JSON.stringify(envelope));return;}
    try{localStorage.setItem(key,JSON.stringify(envelope));persistent=true;}
    catch(_){persistent=false;status='Browser storage is unavailable. Keep this page open until saved online.';}
  }
  function purgeOldCaches(identity) {
    try{for(const k of Object.keys(localStorage)){
      if(k.startsWith(prefix)&&(!identity||!k.startsWith(prefix+identity+':')))localStorage.removeItem(k);
      else if(k.startsWith(prefix)){const e=JSON.parse(localStorage.getItem(k)),scope=e?.plan?.scope;
        if(e?.plan?.expiresAt&&Date.parse(e.plan.expiresAt)<=Date.now()||scope&&scope!=='main'&&C.events&&!C.events.some(e=>e.id===scope&&Date.parse(e.expiresAt)>Date.now()))localStorage.removeItem(k);}
      else if(k.startsWith(legacyPrefix)&&k!==legacyPrefix+identity)localStorage.removeItem(k);
    }}catch(_){}
  }
  // Partition old caches for offline recovery; clean copies defer to the cloud. Unsaved browser
  // edits are partitioned into recovery copies; revision conflicts stay explicit.
  function migrateLegacy(identity) {
    try{
      const legacy=JSON.parse(identity?localStorage.getItem(legacyPrefix+identity):V.get('planner:guest'));
      if(!legacy)return;
      legacy.plan=M.upgrade(legacy.plan);if(!M.valid(legacy.plan))return;
      {
        const scopes=new Set(['main',...legacy.plan.items.map(i=>C.sourceScope(i.source))]);
        for(const scope of scopes){
          const e=copy(legacy);e.plan.items=e.plan.items.filter(i=>C.sourceScope(i.source)===scope);e.plan.scope=scope;
          if(scope!=='main'){
            const meta=C.events?.find(e=>e.id===scope);
            if(!e.plan.items.length||C.events&&!meta||meta&&Date.parse(meta.expiresAt)<=Date.now())continue;
            if(meta)e.plan.expiresAt=meta.expiresAt;
            e.plan.id=crypto.randomUUID();e.revision=0;e.plan.days=[...new Set(e.plan.items.map(i=>i.day))].sort();e.plan.date=e.plan.days.includes(e.plan.date)?e.plan.date:e.plan.days[0];
            e.plan.daySettings=Object.fromEntries(e.plan.days.map(d=>[d,e.plan.daySettings[d]]));
          }
          const target=identity?prefix+identity+':'+scope:'planner:guest:'+scope;
          if(identity){if(!localStorage.getItem(target))localStorage.setItem(target,JSON.stringify(e));}
          else if(!V.get(target))V.set(target,JSON.stringify(e));
        }
      }
      if(identity)localStorage.removeItem(legacyPrefix+identity);else V.remove('planner:guest');
    }catch(_){/* Keep the original recovery copy if storage is unavailable. */}
  }
  function assertPlan(plan){
    C.assert();
    if(plan.scope!==C.id||!plan.items.every(i=>C.accepts(i.source)))throw Error('This plan belongs to another page. Open its Special Event or the main planner to restore it.');
    if(C.event&&(!C.event.dates.includes(plan.date)||plan.items.some(i=>!C.event.dates.includes(i.day))))throw Error('Choose a day in this Special Event.');
  }
  function expire(){epoch++;client=null;clearTimeout(timer);try{localStorage.removeItem(key);}catch(_){}V.remove(guestKey);envelope=fresh();status='This Special Event has ended and its plans have expired.';notify();}
  C.subscribe(expire);
  const queue=()=>{clearTimeout(timer);timer=setTimeout(sync,700);};
  function observe(authClient) {
    if(observedClient===authClient)return;
    observedClient=authClient;
    authSubscription=authClient.auth.onAuthStateChange((event,session)=>{
      const nextRegistered=session?.user?.is_anonymous===false;
      if(event==='SIGNED_OUT'||(session&&(session.user.id!==owner||nextRegistered!==registered))) {
        const keepGuest=event!=='SIGNED_OUT'&&!registered&&nextRegistered;
        epoch++;client=null;clearTimeout(timer);started=null;conflict=false;
        if(!keepGuest){V.remove(guestKey);envelope=fresh();}
        if(registered)purgeOldCaches(null);
        registered=false;owner=null;key=cacheKey('guest');persistent=true;
        status=temporary;notify();
        // Supabase auth callbacks must not await other auth methods.
        if(event!=='SIGNED_OUT')queueMicrotask(()=>ready());
      }
    })?.data?.subscription;
  }
  async function start() {
    const run=epoch;
    await C.ready;try{C.assert();}catch(error){status=error.message;notify();return;}
    migrateLegacy(null);
    if(!registered)envelope=read()||fresh();
    let guest=!registered?copy(envelope):null;
    let session,authClient;
    try {
      session=await Promise.race([window.AustinSession.ready(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Connection timed out')),9000))]);
      if(run!==epoch)return;
      owner=session.user.id;registered=session.user.is_anonymous===false;
      authClient=window.AustinSession.client();client=registered?authClient:null;key=cacheKey(owner);
      if(registered)migrateLegacy(owner);
      purgeOldCaches(registered?owner:null);observe(authClient);
    }catch(_){if(run===epoch){purgeOldCaches(null);status=temporary;notify();}return;}
    if(!registered){status=temporary;persist();notify();return;}
    const cached=persistent?read():null;
    if(persistent)envelope=cached||fresh();
    if(envelope.pendingMerge){guest=copy(envelope);delete guest.pendingMerge;envelope=fresh();}
    try {
      const remote=await R.load(client,owner,cached&&!cached.pendingMerge?envelope.plan.id:null);
      await lock('austin-planner-edit:'+C.id,()=>{
      if(run!==epoch)return;
      // Another open guest tab may have joined this account during the load.
      const latest=persistent?read():null;
      if(latest?.dirty&&!latest.pendingMerge&&latest.stamp!==cached?.stamp)envelope=latest;
      if(remote){if(envelope.dirty&&remote.revision!==envelope.revision)conflict=true;else if(!envelope.dirty)envelope=remote;}
      if(guest?.plan.items.length&&!conflict) {
        if(!remote&&!envelope.plan.items.length)envelope={...guest,revision:0};
        const keys=new Set(envelope.plan.items.map(i=>`${i.day}:${i.source.key}`));
        const added=guest.plan.items.filter(i=>!keys.has(`${i.day}:${i.source.key}`));
        if(envelope.plan.items.length+added.length>150||new Set([...envelope.plan.days,...guest.plan.days]).size>60)throw new Error('Guest plan exceeds capacity; its temporary copy is kept.');
        for(const date of guest.plan.days)if(!envelope.plan.days.includes(date)){envelope.plan.days.push(date);envelope.plan.daySettings[date]=guest.plan.daySettings[date];}
        envelope.plan.items.push(...added);envelope.plan.date=guest.plan.date;envelope.dirty=true;envelope.stamp=crypto.randomUUID();persist();
        if(persistent)V.remove(guestKey);
      }
      status=conflict?'A newer saved plan exists. Choose which copy to keep.':envelope.dirty?'Saving…':remote?'Saved privately · signed-in account':'Ready · your plan is private';
      persist();notify();if(envelope.dirty&&!conflict)queue();
      });
    }catch(_){if(run===epoch){
      if(guest?.plan.items.length&&!envelope.plan.items.length){envelope={...guest,pendingMerge:true,revision:0,dirty:true};persist();client=null;}
      status=envelope.pendingMerge?'Signed in · saved plans unavailable. Your current plan is kept in this browser; retry to combine them.':'Saved in this browser · online save unavailable';notify();
    }}
  }
  function ready(){if(!started)started=start();return started;}
  function mutate(fn) { const task=mutateReady(fn);return V.track?V.track(task):task; }
  async function mutateReady(fn) {
    await ready();
    return lock('austin-planner-edit:'+C.id,()=>{
      const latest=persistent?read():null;if(latest)envelope=latest;
      C.assert();const next=copy(envelope.plan),result=fn(next);assertPlan(next);
      if(!M.valid(next))throw new Error('Check the day, times and visit lengths. You can save up to 60 days and 150 stops.');
      envelope={...envelope,plan:next,dirty:true,stamp:crypto.randomUUID()};
      status=!registered?temporary:conflict?'A newer saved plan exists. Choose which copy to keep.':client?'Saving…':'Saved in this browser · connection unavailable';
      persist();notify();if(client&&!conflict)queue();return result;
    });
  }
  function edit(fn,expectedDate) {
    return mutate(book=>{
      if(expectedDate&&expectedDate!==book.date)throw new Error('The selected day changed. Please edit the day shown now.');
      const view=M.dayView(book);fn(view);M.replaceDay(book,view);
    });
  }
  async function sync() {
    if(C.expired){expire();return;}
    if(!registered||!client||conflict||!envelope.dirty||envelope.pendingMerge)return;
    return lock('austin-planner-sync:'+C.id,async()=>{
      const latest=persistent?read():null;if(latest)envelope=latest;
      if(!envelope.dirty||conflict||!registered||!client)return;
      const sending=copy(envelope),savingKey=key,run=epoch;
      try {
        const result=await R.save(client,sending);
        if(key!==savingKey||run!==epoch)return;
        await lock('austin-planner-edit:'+C.id,()=>{
          if(key!==savingKey||run!==epoch)return;
          if(persistent)envelope=read()||envelope;
          envelope.revision=result.revision;envelope.dirty=envelope.stamp!==sending.stamp;
          status=envelope.dirty?'Saving…':'Saved privately · signed-in account';persist();notify();if(envelope.dirty)queue();
        });
      }catch(error){
        if(key!==savingKey||run!==epoch)return;
        if(error.code==='PT410'){if(C.retire)C.retire();else expire();return;}
        conflict=error.code==='PT409'||error.code==='40001'||/planner_revision_conflict/.test(error.message);
        status=conflict?'A newer saved plan exists. Choose which copy to keep.':'Saved in this browser · online save unavailable';notify();
      }
    });
  }
  async function resolve(useLocal) {
    if(!registered||!client){started=null;return ready();}
    const run=epoch;
    await lock('austin-planner-sync:'+C.id,async()=>{
      const remote=await R.load(client,owner,envelope.plan.id);
      if(run!==epoch)return;
      await lock('austin-planner-edit:'+C.id,()=>{
        if(run!==epoch)return;
        envelope=useLocal?{...(persistent&&read()||envelope),plan:{...(persistent&&read()||envelope).plan,id:remote?.plan.id||envelope.plan.id},revision:remote?.revision||0,dirty:true}:remote||fresh();
        conflict=false;status=useLocal?'Saving…':'Saved privately · signed-in account';persist();notify();
      });
    });
    if(useLocal&&run===epoch)queue();
  }
  window.addEventListener('storage',event=>{
    if(registered&&event.key===key&&persistent){const e=read();if(e){envelope=e;status=e.dirty?'Saving…':'Saved privately · signed-in account';notify();if(e.dirty)queue();}}
  });
  const unsubscribe=V.subscribe(changed=>{if(!registered&&changed===guestKey){const e=read();if(e){envelope=e;status=temporary;notify();}}});
  window.addEventListener('pagehide',()=>{clearTimeout(timer);unsubscribe();authSubscription?.unsubscribe();});
  window.addEventListener('online',()=>{if(!owner){started=null;ready();}else sync();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(!owner){started=null;ready();}else sync();}});
  window.PlanStore = {
    ready, edit, sync, resolve,
    get scope(){return C.id;},
    get event(){return C.event;},
    get plan() { return M.dayView(envelope.plan); },
    get book() { return copy(envelope.plan); },
    get days() { return [...envelope.plan.days].sort().map(date => ({date,count:envelope.plan.items.filter(i => i.day === date).length})); },
    chooseDay(date) { return mutate(book => M.ensureDay(book,date)); },
    restore(plan) { return mutate(book => { const restored=M.upgrade(plan);restored.scope||='main';assertPlan(restored);const id=book.id;Object.assign(book,restored,{id,expiresAt:C.event?.expiresAt||null}); }); },
    get temporary() { return !registered; },
    get unsaved() {
      if(!registered)return false;if(envelope.dirty||conflict)return true;
      // Signing out clears every scope's account cache. An inactive plan may
      // still have offline edits, so the existing explicit-discard gate must
      // protect those too, even while viewing another event.
      try{return Object.keys(localStorage).some(k=>{
        if(!k.startsWith(prefix+owner+':')&&k!==legacyPrefix+owner)return false;
        const e=JSON.parse(localStorage.getItem(k));return e?.dirty&&(!e.plan?.expiresAt||Date.parse(e.plan.expiresAt)>Date.now());
      });}catch(_){return false;}
    },
    get status() { return !registered || persistent ? status : 'Browser storage is unavailable. ' + status; },
    get conflict() { return conflict; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    has(source) { const date=M.targetDay(source,envelope.plan.date); return envelope.plan.items.some(i => i.day === date && i.source.key === source.key); },
    async select(source, selected) {
      return mutate(plan => {
        if(!C.accepts(source))throw Error('Open this place’s own map to add it to its separate plan.');
        const date=M.targetDay(source,plan.date), index = plan.items.findIndex(i => i.day === date && i.source.key === source.key);
        if (selected && index < 0) {
          M.ensureDay(plan,date);
          plan.items.push({...window.PlanSources.item(source, crypto.randomUUID()),day:date});
        }
        if (!selected && index >= 0) plan.items.splice(index, 1);
        return date;
      });
    },
    retry() { if (!client) { started = null; return ready(); } return sync(); }
  };
})();
