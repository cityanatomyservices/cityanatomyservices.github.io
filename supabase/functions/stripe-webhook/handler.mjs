const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function handler(api) {
  return async req=>{
    if(req.method!=='POST')return json({error:'Method not allowed.'},405);
    if(!api.webhookReady())return json({error:'Webhook is not configured.'},503);
    let event;
    try {
      const body=await req.text();
      if(body.length>1048576)return json({error:'Request too large.'},413);
      event=await api.verify(body,req.headers.get('Stripe-Signature'));
    }catch{return json({error:'Invalid signature.'},400);}
    try{return json(await api.service.webhook(event));}
    // Non-2xx makes Stripe retry a failed or concurrent update. Never log payloads/secrets.
    catch{return json({error:'Please retry delivery.'},503);}
  };
}
