const headers={'Access-Control-Allow-Origin':'https://austin.chat','Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
export function handler(api){return async req=>{
 if(req.headers.get('Origin')&&req.headers.get('Origin')!=='https://austin.chat')return json({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json({error:'Open the email link and confirm your choice.'},405);
 try{
  const text=await req.text();if(text.length>512)return json({error:'Invalid request'},400);
  let body;try{body=JSON.parse(text);}catch{return json({error:'Invalid request'},400);}
  if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['action','token'].includes(k))||!['verify','stop'].includes(body.action)||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.token))return json({error:'Invalid email link'},400);
  return json(await api.rpc('geofence_email_token',{p_token:body.token,p_action:body.action}));
 }catch(error){return json({error:error.status?error.message:'Email settings could not connect. Please try again.'},error.status||503);}
};}
