import {entitlement,EVENTS,ORIGIN,problem,objectId} from './billing.mjs';
export function service({stripe,db,mode,price,portal,enabled=false,now=Date.now,uuid=()=>crypto.randomUUID()}){
 let config;
 async function configured(){
  if(!config)config=(async()=>{
   if(!price||!portal)throw problem(503,'Geofence payments are being set up. Your preview is available.');
   const p=await stripe.prices.retrieve(price),settings=await stripe.billingPortal.configurations.retrieve(portal);
   if(!p.active||p.livemode!==(mode==='live')||p.currency!=='usd'||p.unit_amount!==1000||p.recurring?.interval!=='month'||p.recurring?.interval_count!==1)throw Error('Unexpected geofence price');
   if(!settings.active||settings.livemode!==(mode==='live')||!settings.features?.subscription_cancel?.enabled||settings.features.subscription_cancel.mode!=='at_period_end'||settings.features.subscription_update?.enabled)throw Error('Unexpected geofence portal');
  })().catch(e=>{config=null;throw e;});
  await config;
 }
 async function lock(user,id,fn){let row=await db.claim(mode,id,user.id);const lease=row.lease_id;const save=async fields=>(row=await db.save(mode,id,lease,fields));try{return await fn(()=>row,save);}finally{await db.release(mode,id,lease);}}
 async function owned(user,id){const row=await db.load(mode,id,null);if(!row||row.owner_id!==user.id)throw problem(404,'Geofence not found.');return row;}
 async function sync(row,save){
  const subs=[];
  if(row.customer_id)for await(const s of stripe.subscriptions.list({customer:row.customer_id,status:'all',limit:100,expand:['data.latest_invoice']})){
   // Each circle has its own Stripe customer. Metadata additionally fences association.
   if(s.metadata?.geofence_id===row.space_id&&s.metadata?.supabase_user_id===row.owner_id)subs.push(s);
  }
  await save(entitlement(subs,price,now()));return subs;
 }
 async function manage(user,id){await configured();const row=await owned(user,id);if(!row.customer_id)throw problem(409,'No subscription to manage yet.');const s=await stripe.billingPortal.sessions.create({customer:row.customer_id,configuration:portal,return_url:ORIGIN+'/geofences/manage/?billing=return&id='+id});return {url:s.url};}
 async function checkout(user,id){
  if(!enabled)throw problem(503,'Geofence payments are being set up. Your preview is available.');
  await configured();return lock(user,id,async(get,save)=>{
   if(!get().customer_id){const c=await stripe.customers.create({metadata:{site:'austin.chat',product:'custom_geofence',geofence_id:id,supabase_user_id:user.id}},{idempotencyKey:`geofence-customer-${mode}-${id}`});await save({customer_id:c.id});}
   const subs=await sync(get(),save);
   if(subs.some(s=>!['canceled','incomplete_expired'].includes(s.status)))return manage(user,id);
   if(get().checkout_id){const old=await stripe.checkout.sessions.retrieve(get().checkout_id);
    if(old.status==='open'&&old.expires_at*1000>now())return {url:old.url};
    if(old.status==='complete'&&!subs.length)throw problem(409,'Your payment is still processing. Please check again shortly.');
    await save({checkout_id:null,checkout_nonce:uuid()});
   }
   const metadata={site:'austin.chat',product:'custom_geofence',geofence_id:id,supabase_user_id:user.id};
   const session=await stripe.checkout.sessions.create({mode:'subscription',customer:get().customer_id,client_reference_id:id,line_items:[{price,quantity:1}],metadata,subscription_data:{metadata},
    success_url:ORIGIN+'/geofences/manage/?billing=success&id='+id,cancel_url:ORIGIN+'/geofences/manage/?billing=cancel&id='+id},{idempotencyKey:`geofence-checkout-${mode}-${get().checkout_nonce}`});
   await save({checkout_id:session.id});return {url:session.url};
  });
 }
 async function status(user,id){await configured();await owned(user,id);return lock(user,id,async(get,save)=>{await sync(get(),save);return {status:get().status,paidUntil:get().pro_until,cancelAtPeriodEnd:get().cancel_at_period_end};});}
 async function webhook(event){
  if(event.livemode!==(mode==='live')||!EVENTS.has(event.type))return {received:true};
  const object=event.data.object,customer=event.type==='customer.deleted'?object.id:objectId(object.customer);if(!customer)return {received:true};
  const row=await db.load(mode,null,customer);if(!row)return {received:true};
  await lock({id:row.owner_id},row.space_id,async(get,save)=>{
   if(event.type==='customer.deleted')await save({status:'deleted',pro_until:null,subscription_id:null,cancel_at_period_end:false});
   else await sync(get(),save);
  });return {received:true};
 }
 return {checkout,status,manage,webhook,configured};
}
