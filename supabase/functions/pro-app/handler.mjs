const ORIGIN='https://austin.chat';
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Expose-Headers':'X-App-Content-Type',
  'Cache-Control':'private, no-store','Vary':'Origin, Authorization'};
const json=(value,status)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json'}});
export function handler(api){
  return async req=>{
    if(req.headers.get('Origin')&&req.headers.get('Origin')!==ORIGIN)return json({error:'Origin not allowed.'},403);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(req.method!=='POST')return json({error:'Method not allowed.'},405);
    try{
      const raw=await req.text();if(raw.length>1024)return json({error:'Request too large.'},413);
      let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
      if(!body||Array.isArray(body)||Object.keys(body).some(k=>k!=='path')||typeof body.path!=='string'||!/^\/[A-Za-z0-9_./-]+$/.test(body.path)||body.path.includes('..'))return json({error:'Invalid app path.'},400);
      await api.authorize(req);
      const asset=await api.asset(body.path);
      if(!asset)return json({error:'App file not found.'},404);
      // Octet-stream avoids the gateway's HTML rewrite. The same-origin worker
      // restores the trusted manifest MIME type after the authenticated fetch.
      return new Response(asset.body,{headers:{...cors,'Content-Type':'application/octet-stream',
        'X-App-Content-Type':asset.mime,'X-Content-Type-Options':'nosniff'}});
    }catch(error){return json({error:error.publicMessage||'This Pro app could not load. Please try again.'},error.publicMessage?error.status:503);}
  };
}
