/* Planner persistence. Guest plans live only in AustinVisit memory; registered
   accounts keep the existing private cache, cloud saves and revision checks. */
(() => {
  const M=window.PlanModel,R=window.PlanRepository,V=window.AustinVisit;
  const prefix='austin:planner:v1:',guestKey='planner:guest',listeners=new Set();
  const fresh=()=>({plan:M.empty(crypto.randomUUID()),revision:0,dirty:false,stamp:''});
  const temporary='Temporary plan · refresh or close clears it';
  let owner=null,client=null,key=prefix+'guest',timer,started,conflict=false,registered=false,observedClient,epoch=0;
  let status='Opening your plan…',persistent=true,envelope=fresh();
  const copy=value=>structuredClone(value);
  const lock=(name,fn)=>navigator.locks?navigator.locks.request(name,fn):Promise.resolve().then(fn);
  function read(k=key) {
    try {const e=JSON.parse(registered?localStorage.getItem(k):V.get(guestKey));if(e)e.plan=M.upgrade(e.plan);return M.valid(e?.plan)?e:null;}catch(_){return null;}
  }
  function notify(){for(const fn of listeners)fn();}
  function persist() {
    if(!registered){V.set(guestKey,JSON.stringify(envelope));return;}
    try{localStorage.setItem(key,JSON.stringify(envelope));persistent=true;}
    catch(_){persistent=false;status='Browser storage is unavailable. Keep this page open until saved online.';}
  }
  function purgeOldCaches(keep) {
    try{for(const k of Object.keys(localStorage))if(k.startsWith(prefix)&&k!==keep)localStorage.removeItem(k);}catch(_){}
  }
  const queue=()=>{clearTimeout(timer);timer=setTimeout(sync,700);};
  function observe(authClient) {
    if(observedClient===authClient)return;
    observedClient=authClient;
    authClient.auth.onAuthStateChange((event,session)=>{
      const nextRegistered=session?.user?.is_anonymous===false;
      if(event==='SIGNED_OUT'||(session&&(session.user.id!==owner||nextRegistered!==registered))) {
        const keepGuest=event!=='SIGNED_OUT'&&!registered&&nextRegistered;
        epoch++;client=null;clearTimeout(timer);started=null;conflict=false;
        if(!keepGuest){V.remove(guestKey);envelope=fresh();}
        if(registered)try{localStorage.removeItem(key);}catch(_){}
        registered=false;owner=null;key=prefix+'guest';persistent=true;
        status=temporary;notify();
        // Supabase auth callbacks must not await other auth methods.
        if(event!=='SIGNED_OUT')queueMicrotask(()=>ready());
      }
    });
  }
  async function start() {
    const run=epoch;
    if(!registered)envelope=read()||envelope;
    const guest=!registered?copy(envelope):null;
    let session,authClient;
    try {
      session=await Promise.race([window.AustinSession.ready(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Connection timed out')),9000))]);
      if(run!==epoch)return;
      owner=session.user.id;registered=session.user.is_anonymous===false;
      authClient=window.AustinSession.client();client=registered?authClient:null;key=prefix+owner;
      purgeOldCaches(registered?key:null);observe(authClient);
    }catch(_){if(run===epoch){purgeOldCaches(null);status=temporary;notify();}return;}
    if(!registered){status=temporary;persist();notify();return;}
    if(persistent)envelope=read()||fresh();
    try {
      const remote=await R.load(client,owner,read()?envelope.plan.id:null);
      if(run!==epoch)return;
      if(remote){if(envelope.dirty&&remote.revision!==envelope.revision)conflict=true;else if(!envelope.dirty)envelope=remote;}
      if(guest?.plan.items.length&&!conflict) {
        if(!remote&&!envelope.plan.items.length)envelope={...guest,revision:0};
        const keys=new Set(envelope.plan.items.map(i=>`${i.day}:${i.source.key}`));
        const added=guest.plan.items.filter(i=>!keys.has(`${i.day}:${i.source.key}`));
        if(envelope.plan.items.length+added.length>150||new Set([...envelope.plan.days,...guest.plan.days]).size>60)throw new Error('Guest plan exceeds capacity; its temporary copy is kept.');
        for(const date of guest.plan.days)if(!envelope.plan.days.includes(date)){envelope.plan.days.push(date);envelope.plan.daySettings[date]=guest.plan.daySettings[date];}
        envelope.plan.items.push(...added);envelope.dirty=true;envelope.stamp=crypto.randomUUID();persist();
        if(persistent)V.remove(guestKey);
      }
      status=conflict?'A newer saved plan exists. Choose which copy to keep.':envelope.dirty?'Saving…':remote?'Saved privately · signed-in account':'Ready · your plan is private';
      persist();notify();if(envelope.dirty&&!conflict)queue();
    }catch(_){if(run===epoch){status='Saved in this browser · online save unavailable';notify();}}
  }
  function ready(){if(!started)started=start();return started;}
  function mutate(fn) { const task=mutateReady(fn);return V.track?V.track(task):task; }
  async function mutateReady(fn) {
    await ready();
    return lock('austin-planner-edit',()=>{
      const latest=persistent?read():null;if(latest)envelope=latest;
      const next=copy(envelope.plan),result=fn(next);
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
    if(!registered||!client||conflict||!envelope.dirty)return;
    return lock('austin-planner-sync',async()=>{
      const latest=persistent?read():null;if(latest)envelope=latest;
      if(!envelope.dirty||conflict||!registered||!client)return;
      const sending=copy(envelope),savingKey=key,run=epoch;
      try {
        const result=await R.save(client,sending);
        if(key!==savingKey||run!==epoch)return;
        await lock('austin-planner-edit',()=>{
          if(key!==savingKey||run!==epoch)return;
          if(persistent)envelope=read()||envelope;
          envelope.revision=result.revision;envelope.dirty=envelope.stamp!==sending.stamp;
          status=envelope.dirty?'Saving…':'Saved privately · signed-in account';persist();notify();if(envelope.dirty)queue();
        });
      }catch(error){
        if(key!==savingKey||run!==epoch)return;
        conflict=error.code==='PT409'||error.code==='40001'||/planner_revision_conflict/.test(error.message);
        status=conflict?'A newer saved plan exists. Choose which copy to keep.':'Saved in this browser · online save unavailable';notify();
      }
    });
  }
  async function resolve(useLocal) {
    if(!registered||!client){started=null;return ready();}
    const run=epoch;
    await lock('austin-planner-sync',async()=>{
      const remote=await R.load(client,owner,envelope.plan.id);
      if(run!==epoch)return;
      await lock('austin-planner-edit',()=>{
        if(run!==epoch)return;
        envelope=useLocal?{...(persistent&&read()||envelope),revision:remote?.revision||0,dirty:true}:remote||fresh();
        conflict=false;status=useLocal?'Saving…':'Saved privately · signed-in account';persist();notify();
      });
    });
    if(useLocal&&run===epoch)queue();
  }
  window.addEventListener('storage',event=>{
    if(registered&&event.key===key&&persistent){const e=read();if(e){envelope=e;status=e.dirty?'Saving…':'Saved privately · signed-in account';notify();if(e.dirty)queue();}}
  });
  const unsubscribe=V.subscribe(changed=>{if(!registered&&changed===guestKey){const e=read();if(e){envelope=e;status=temporary;notify();}}});
  window.addEventListener('pagehide',()=>{clearTimeout(timer);unsubscribe();});
  window.addEventListener('online',()=>{if(!owner){started=null;ready();}else sync();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(!owner){started=null;ready();}else sync();}});
  window.PlanStore = {
    ready, edit, sync, resolve,
    get plan() { return M.dayView(envelope.plan); },
    get book() { return copy(envelope.plan); },
    get days() { return [...envelope.plan.days].sort().map(date => ({date,count:envelope.plan.items.filter(i => i.day === date).length})); },
    chooseDay(date) { return mutate(book => M.ensureDay(book,date)); },
    restore(plan) { return mutate(book => { const id = book.id; Object.assign(book,M.upgrade(plan),{id}); }); },
    get temporary() { return !registered; },
    get status() { return !registered || persistent ? status : 'Browser storage is unavailable. ' + status; },
    get conflict() { return conflict; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    has(source) { const date=M.targetDay(source,envelope.plan.date); return envelope.plan.items.some(i => i.day === date && i.source.key === source.key); },
    async select(source, selected) {
      return mutate(plan => {
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
