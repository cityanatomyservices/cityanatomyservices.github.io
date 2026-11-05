/* Same-origin delivery of private Pro resources. Never stores tokens or app data. */
const ENDPOINT='https://aqbyxpiwugcvoephsvpm.supabase.co/functions/v1/pro-app';
const PUBLIC_KEY='sb_publishable_QMWSj0CLYe3k3XSGCsWOhw_5RsI-nmN';
let token=null,manifest,manifestTime=0,pendingAuth=new Set();
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
function usable(value){
  if(typeof value!=='string'||value.length>12000)return false;
  try{return JSON.parse(atob(value.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).exp*1000>Date.now()+30000;}catch{return false;}
}
self.addEventListener('message',event=>{
  if(!event.source?.url||new URL(event.source.url).origin!==self.location.origin||event.data?.type!=='austin-pro-auth')return;
  token=usable(event.data.token)?event.data.token:null;
  for(const resolve of pendingAuth)resolve(token);pendingAuth.clear();
  event.ports[0]?.postMessage({ready:true});
});
async function identity(){
  if(usable(token))return token;
  token=null;
  return new Promise(resolve=>{
    const done=value=>{clearTimeout(timer);pendingAuth.delete(done);resolve(value);};
    const timer=setTimeout(()=>done(null),3000);pendingAuth.add(done);
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>clients.forEach(client=>client.postMessage({type:'austin-pro-need-auth'}))).catch(()=>done(null));
  });
}
async function catalog(){
  if(Date.now()-manifestTime>60000){manifest=null;manifestTime=Date.now();}
  if(!manifest)manifest=fetch('/billing/pro-assets.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Manifest unavailable');return r.json();}).catch(error=>{manifest=null;throw error;});
  return manifest;
}
const denied=()=>new Response('Pro membership is required. Open this app from Austin.chat after signing in.',{status:403,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||event.request.method!=='GET'||url.pathname==='/billing/pro-assets.json'||url.pathname==='/pro-worker.js')return;
  event.respondWith((async()=>{
    let assets;try{assets=await catalog();}catch{return fetch(event.request);}
    if(!assets.files[url.pathname])return fetch(event.request);
    const auth=await identity();if(!auth)return denied();
    const response=await fetch(ENDPOINT,{method:'POST',credentials:'omit',cache:'no-store',
      headers:{apikey:PUBLIC_KEY,Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:JSON.stringify({path:url.pathname})});
    if(!response.ok){
      if(response.status===401||response.status===403){
        token=null;const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
        clients.forEach(client=>client.postMessage({type:'austin-pro-access-changed'}));
      }
      return denied();
    }
    const mime=response.headers.get('X-App-Content-Type');
    if(mime!==assets.files[url.pathname].mime)return new Response('App version changed. Reload Austin.chat.',{status:503,headers:{'Cache-Control':'no-store'}});
    return new Response(response.body,{headers:{'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
  })());
});
