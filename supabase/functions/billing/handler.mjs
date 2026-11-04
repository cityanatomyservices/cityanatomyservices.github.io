import {ORIGIN} from '../_shared/billing.mjs';
const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
export function handler(api) {
  return async req=>{
    if(req.headers.get('Origin')&&req.headers.get('Origin')!==ORIGIN)return json({error:'Origin not allowed.'},403);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return json({error:'Method not allowed.'},405);
    try {
      const raw=await req.text();if(raw.length>1024)return json({error:'Request too large.'},413);
      let body;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
      // Browser input selects only an action. Account, price and redirect URLs are server-owned.
      if(!body||Array.isArray(body)||Object.keys(body).some(k=>k!=='action')||!['status','checkout','portal'].includes(body.action))return json({error:'Invalid request.'},400);
      const user=await api.user(req);
      if(!api.ready())return json({error:'Pro membership is being set up.'},503);
      if(!api.allowed(user))return json({error:'Pro membership is being tested.'},403);
      return json(await api.service[body.action==='portal'?'manage':body.action](user));
    }catch(error){return json({error:error.publicMessage||'Billing is temporarily unavailable. Please try again.'},error.publicMessage?error.status:503);}
  };
}
