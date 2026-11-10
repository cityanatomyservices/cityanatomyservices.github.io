import {ORIGIN,problem} from '../_shared/billing.mjs';
import {validate,validId} from '../../../geofences/model.mjs';
const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
export function handler(api){return async req=>{
 if(req.headers.get('Origin')&&req.headers.get('Origin')!==ORIGIN)return json({error:'Origin not allowed.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return json({error:'Method not allowed.'},405);
 try{
  const raw=await req.text();if(raw.length>4096)throw problem(413,'Request too large.');let body;try{body=JSON.parse(raw);}catch{throw problem(400,'Invalid request.');}
  if(!body||Array.isArray(body)||!['list','save','geocode','checkout','status','portal'].includes(body.action))throw problem(400,'Invalid request.');
  const allowed={list:['action'],save:['action','id','fields'],geocode:['action','address'],checkout:['action','id'],status:['action','id'],portal:['action','id']}[body.action];
  if(Object.keys(body).some(k=>!allowed.includes(k)))throw problem(400,'Unexpected field.');
  const user=await api.user(req);
  if(body.action==='list')return json({spaces:await api.rpc('geofence_owner_list',{p_owner:user.id,p_mode:api.mode}),checkoutEnabled:api.enabled});
  if(body.action==='geocode'){
   if(typeof body.address!=='string'||body.address.trim().length<6||body.address.length>240)throw problem(422,'Enter a full U.S. street address.');
   await api.rpc('geofence_geocode_limit',{p_owner:user.id});
   const url=new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');url.search=new URLSearchParams({address:body.address.trim(),benchmark:'Public_AR_Current',format:'json'});
   const r=await api.fetcher(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Geocoder unavailable');const data=await r.json();
   return json({matches:(data.result?.addressMatches||[]).slice(0,5).map(m=>({label:m.matchedAddress,latitude:m.coordinates.y,longitude:m.coordinates.x})).filter(m=>Number.isFinite(m.latitude)&&Number.isFinite(m.longitude))});
  }
  if(!validId(body.id))throw problem(422,'Invalid geofence.');
  if(body.action==='save'){let fields;try{fields=validate(body.fields);}catch(e){throw problem(422,e.message);}return json(await api.rpc('geofence_save_draft',{p_owner:user.id,p_id:body.id,p_fields:fields}));}
  if(!api.service)throw problem(503,'Geofence payments are being set up. Your preview is available.');
  return json(await api.service[body.action==='portal'?'manage':body.action](user,body.id));
 }catch(e){return json({error:e.publicMessage||'Could not connect. Please try again.'},e.publicMessage?e.status:503);}
};}
