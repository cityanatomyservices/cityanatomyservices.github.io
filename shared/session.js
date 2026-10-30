/* Shared identity only. Guest credentials live in the current page visit;
   only a registered account may persist a session across visits. */
(() => {
  const visit=window.AustinVisit;
  // One SDK client owns a visit, even while its map iframe changes.
  try {
    if(window.parent!==window && window.parent.AustinVisit===visit && window.parent.AustinSession) {
      window.AustinSession=window.parent.AustinSession;return;
    }
  } catch (_) {}
  const config={url:'https://aqbyxpiwugcvoephsvpm.supabase.co',key:'sb_publishable_QMWSj0CLYe3k3XSGCsWOhw_5RsI-nmN'};
  const permanentKey='sb-aqbyxpiwugcvoephsvpm-auth-token';
  const registered=value=>value?.user?.is_anonymous===false;
  const listeners=new Set();
  let client,pending,current,canPersist=true,adopting=Promise.resolve();
  function member() {
    try {const value=localStorage.getItem(permanentKey);return registered(JSON.parse(value))?value:null;}catch(_){canPersist=false;return null;}
  }
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
  // Never broadcast guest sessions to another tab, including after sign-out.
  const storageKey='austin-guest-'+visit.id;
  const storage={
    getItem(key) {
      if(key===storageKey) {
        const value=member();if(value)return value;
        const previous=visit.get('auth:'+key);
        try {if(canPersist&&registered(JSON.parse(previous)))return null;}catch(_){}
      }
      return visit.get('auth:'+key);
    },
    setItem(key,value) {
      visit.set('auth:'+key,value);
      if(key===storageKey) {
        try {
          const data=JSON.parse(value),before=JSON.parse(member());
          // An old tab's in-flight refresh must not undo another tab's logout
          // or replace a newer account. Explicit guest-to-member login is allowed.
          const previous=current||saved;
          if(canPersist&&registered(data)&&registered(previous)&&data.user.id===previous.user.id&&(!before||before.user.id!==data.user.id))return;
          if(registered(data) && (before?.access_token!==data.access_token || before?.refresh_token!==data.refresh_token)) {
            // Google API tokens are not used by Austin.chat.
            delete data.provider_token;delete data.provider_refresh_token;
            localStorage.setItem(permanentKey,JSON.stringify(data));
          }
        }catch(_){canPersist=false;}
      }
    },
    removeItem(key) {
      visit.remove('auth:'+key);
      if(key===storageKey)try{
        const stored=JSON.parse(member()),previous=current||saved;
        if(!stored||stored.user.id===previous?.user?.id)localStorage.removeItem(permanentKey);
      }catch(_){}
    }
  };
  function getClient() {
    if(!client) {
      client=window.supabase.createClient(config.url,config.key,{
        auth:{storage,storageKey,persistSession:true,flowType:'pkce',detectSessionInUrl:false},
        realtime:{params:{eventsPerSecond:5}},
        global:{fetch:(url,options={})=>fetch(url,{...options,signal:options.signal ? AbortSignal.any([options.signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000)})}
      });
      client.auth.onAuthStateChange((event,session)=>{
        if(visit.closed)return;
        const changedAccount=registered(current)&&current.user.id!==session?.user?.id;
        if(event==='SIGNED_OUT'||changedAccount) {
          visit.remove('chat:identity');visit.remove('chat:visible');visit.remove('planner:guest');
          try {for(const key of Object.keys(localStorage)) {
            if(key.startsWith('austin:planner:v1:') || key.startsWith('austinchat:visible:'))localStorage.removeItem(key);
          }}catch(_){}
        }
        current=session;
        // Subscribers may use auth methods; run them outside the SDK's lock.
        queueMicrotask(()=>{if(!visit.closed)listeners.forEach(fn=>fn(event,session));});
      });
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
  // Registered logins/refreshes/sign-out follow the browser's other tabs.
  // Guest sessions never enter this channel or browser storage.
  window.addEventListener('storage',event=>{
    if(event.key!==permanentKey)return;
    adopting=adopting.catch(()=>{}).then(async()=>{
      if(visit.closed)return;
      const saved=JSON.parse(member());
      if(saved && saved.access_token!==current?.access_token) {
        await getClient().auth.setSession({access_token:saved.access_token,refresh_token:saved.refresh_token});
      } else if(!saved && registered(current)) {
        visit.remove('auth:'+storageKey);
        await getClient().auth.signOut({scope:'local'});
      }
    });
  });
  window.AustinSession={
    client:getClient,
    get registered(){return registered(current);},
    get user(){return current?.user||null;},
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    async peek(){const {data,error}=await getClient().auth.getSession();if(error)throw error;current=data.session;return current;},
    async settings(){
      const response=await fetch(config.url+'/auth/v1/settings',{headers:{apikey:config.key},signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('Sign-in options could not be loaded. Try again.');
      return response.json();
    },
    clearVerifier(){visit.remove('auth:'+storageKey+'-code-verifier');},
    async signOut(){
      const auth=getClient().auth,{error}=await auth.signOut({scope:'local'});
      if(error){
        // Still clear this device when the token-revocation server is offline.
        try{localStorage.removeItem(permanentKey);}catch(_){}
        visit.remove('auth:'+storageKey);
        const local=await auth.signOut({scope:'local'});if(local.error)throw local.error;
      }
    },
    ready() {
      if(!pending)pending=(navigator.locks ? navigator.locks.request('austin-session-start:'+visit.id,session) : session()).finally(()=>{pending=null;});
      return pending;
    }
  };
})();
