/* Shared identity only. Guest credentials live in the current page visit;
   only a registered account may persist a session across visits. */
(() => {
  const visit=window.AustinVisit;
  const config={url:'https://aqbyxpiwugcvoephsvpm.supabase.co',key:'sb_publishable_QMWSj0CLYe3k3XSGCsWOhw_5RsI-nmN'};
  const permanentKey='sb-aqbyxpiwugcvoephsvpm-auth-token';
  const registered=value=>value?.user?.is_anonymous===false;
  let client,pending,current;
  let saved;
  try {
    saved=JSON.parse(localStorage.getItem(permanentKey));
    if(!registered(saved)) {
      localStorage.removeItem(permanentKey);saved=null;
      for(const key of Object.keys(localStorage)) if(key.startsWith('austin:planner:v1:')) localStorage.removeItem(key);
    }
    // These old, unscoped values belong to the former persistent guest UI.
    localStorage.removeItem('austinchat:identity');localStorage.removeItem('austinchat:visible');
  } catch (_) {saved=null;}
  const storageKey=saved ? permanentKey : 'austin-guest-'+visit.id;
  const storage={
    getItem(key) {
      if(key===storageKey) {
        try {const value=localStorage.getItem(permanentKey);if(registered(JSON.parse(value)))return value;} catch (_) {}
      }
      return visit.get('auth:'+key);
    },
    setItem(key,value) {
      visit.set('auth:'+key,value);
      if(key===storageKey) {
        try {const data=JSON.parse(value);if(registered(data))localStorage.setItem(permanentKey,value);}catch(_){}
      }
    },
    removeItem(key) {
      visit.remove('auth:'+key);
      if(key===storageKey)try{localStorage.removeItem(permanentKey);}catch(_){}
    }
  };
  function getClient() {
    if(!client) {
      client=window.supabase.createClient(config.url,config.key,{
        auth:{storage,storageKey,persistSession:true},
        realtime:{params:{eventsPerSecond:5}},
        global:{fetch:(url,options={})=>fetch(url,{...options,signal:options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)})}
      });
      client.auth.onAuthStateChange((_event,session)=>{current=session;});
    }
    return client;
  }
  async function session() {
    const c=getClient(),{data,error}=await c.auth.getSession();
    if(error)throw error;
    if(data.session){current=data.session;return current;}
    const fresh=await c.auth.signInAnonymously({options:{data:{austin_guest_visit:true}}});
    if(fresh.error)throw fresh.error;
    current=fresh.data.session;return current;
  }
  window.addEventListener('pagehide',()=>client?.auth.stopAutoRefresh());
  window.AustinSession={
    client:getClient,
    get registered(){return registered(current);},
    ready() {
      if(!pending)pending=(navigator.locks ? navigator.locks.request('austin-session-start:'+visit.id,session) : session()).finally(()=>{pending=null;});
      return pending;
    }
  };
})();
