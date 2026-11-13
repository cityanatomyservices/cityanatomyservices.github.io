export const API_VERSION='2026-10-28.endive';
export const ORIGIN='https://austin.chat';
export const PRICES={test:'price_1UbJdbPylm4UechMkj6ty6Z3',live:'price_1UbJdfPylm4UechMB1GxVKGy'};
export const LEGACY_PRICES={test:'price_1UYCoYPylm4UechMfDQJur0b',live:'price_1UYCyLPylm4UechMwGuCKwdH'};
export const EVENTS=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed','customer.subscription.created','customer.subscription.updated',
  'customer.subscription.deleted','customer.subscription.paused','customer.subscription.resumed',
  'invoice.paid','invoice.payment_failed','invoice.marked_uncollectible','invoice.voided','customer.deleted']);
export const problem=(status,message)=>Object.assign(new Error(message),{status,publicMessage:message});
export const objectId=value=>typeof value==='string'?value:value?.id;
const includesPrice=(prices,id)=>(Array.isArray(prices)?prices:[prices]).includes(id);

export function membership(row,now=Date.now()) {
  return {plan:row?.status==='active'&&Date.parse(row.pro_until)>now?'pro':'free',
    paidThrough:row?.pro_until||null,cancelAtPeriodEnd:!!row?.cancel_at_period_end,hasBilling:!!row?.customer_id};
}

// An active subscription alone is insufficient (for example, an unpaid first invoice).
// Current Stripe state is fetched for every reconciliation; event snapshots never grant access.
export function entitlement(subscriptions,price,now=Date.now()) {
  const own=subscriptions.filter(s=>s.items?.data?.some(item=>includesPrice(price,objectId(item.price))));
  const paid=own.filter(s=>s.status==='active'&&!s.pause_collection&&s.latest_invoice?.status==='paid'&&
    s.items.data.some(i=>includesPrice(price,objectId(i.price))&&i.current_period_end*1000>now));
  paid.sort((a,b)=>periodEnd(b,price)-periodEnd(a,price));
  const subscription=paid[0]||own.find(s=>!['canceled','incomplete_expired'].includes(s.status))||own[0];
  return {subscription_id:subscription?.id||null,status:subscription?.status||'none',
    pro_until:paid[0]?new Date(periodEnd(paid[0],price)*1000).toISOString():null,
    cancel_at_period_end:!!subscription?.cancel_at_period_end};
}
function periodEnd(subscription,price) {
  return Math.max(...subscription.items.data.filter(i=>includesPrice(price,objectId(i.price))).map(i=>i.current_period_end||0));
}

export function service({stripe,db,mode,portal,checkoutEnabled=false,now=Date.now,uuid=()=>crypto.randomUUID()}) {
  if(!['test','live'].includes(mode))throw new Error('Billing mode is required');
  const price=PRICES[mode];
  let configuration;
  async function configured() {
    if(configuration)return configuration;
    const task=(async()=>{
      const actual=await stripe.prices.retrieve(price);
      if(!actual.active||actual.livemode!==(mode==='live')||actual.currency!=='usd'||actual.unit_amount!==500||
        actual.recurring?.interval!=='month'||actual.recurring?.interval_count!==1)throw new Error('Unexpected Pro price');
      if(!portal)throw problem(503,'Billing management is being set up.');
      const settings=await stripe.billingPortal.configurations.retrieve(portal);
      if(!settings.active||settings.livemode!==(mode==='live')||!settings.features?.subscription_cancel?.enabled||
        settings.features.subscription_cancel.mode!=='at_period_end')throw new Error('Unexpected billing portal');
    })();configuration=task;
    try{await task;}catch(error){if(configuration===task)configuration=null;throw error;}
  }
  async function locked(owner,fn) {
    let row=await db.claim(mode,owner);
    const lease=row.lease_id;
    const save=async fields=>{row=await db.save(mode,owner,lease,fields);return row;};
    try{return await fn(()=>row,save);}finally{await db.release(mode,owner,lease);}
  }
  async function subscriptions(customer) {
    const all=[];
    for await(const sub of stripe.subscriptions.list({customer,status:'all',limit:100,expand:['data.latest_invoice']}))all.push(sub);
    return all;
  }
  async function synchronize(row,save) {
    const subs=row.customer_id?await subscriptions(row.customer_id):[];
    await save(entitlement(subs,[price,LEGACY_PRICES[mode]],now()));return subs;
  }
  async function portalURL(customer) {
    if(!portal)throw problem(503,'Billing management is being set up.');
    const result=await stripe.billingPortal.sessions.create({customer,configuration:portal,return_url:ORIGIN+'/?billing=return'});
    return {url:result.url};
  }
  async function checkout(user) {
    if(mode==='live'&&(await db.testing()).proEnabled)return db.grantTesting(user.id);
    if(!checkoutEnabled)throw problem(503,'Pro membership is being set up.');
    if(mode==='live'&&await db.substack(user.id))throw problem(409,'Your paid Substack membership already includes Pro. Manage that subscription on Substack.');
    return locked(user.id,async(get,save)=>{
      await configured();
      if(!get().customer_id) {
        // Dedicated Austin.chat customer; never reuse a Substack customer by email.
        // Keep request parameters stable when recovering a failed database write.
        const customer=await stripe.customers.create({metadata:{site:'austin.chat',supabase_user_id:user.id}},
          {idempotencyKey:`austin-customer-${mode}-${user.id}`});
        await save({customer_id:customer.id});
      }
      const subs=await synchronize(get(),save);
      if(subs.some(s=>!['canceled','incomplete_expired'].includes(s.status)))return portalURL(get().customer_id);
      if(get().checkout_id) {
        const previous=await stripe.checkout.sessions.retrieve(get().checkout_id);
        if(previous.status==='open'&&previous.expires_at*1000>now())return {url:previous.url};
        // Completed asynchronous payments must settle before a second purchase.
        if(previous.status==='complete'&&!subs.length)throw problem(409,'Your payment is still processing. Please check back shortly.');
        await save({checkout_id:null,checkout_nonce:uuid()});
      }
      const row=get();
      const session=await stripe.checkout.sessions.create({mode:'subscription',customer:row.customer_id,
        client_reference_id:user.id,line_items:[{price,quantity:1}],
        metadata:{site:'austin.chat',supabase_user_id:user.id},
        subscription_data:{metadata:{site:'austin.chat',supabase_user_id:user.id}},
        integration_identifier:'austin_chat_pro_kqmwzrdp',
        success_url:ORIGIN+'/?billing=success',cancel_url:ORIGIN+'/?billing=cancel'},
        {idempotencyKey:`austin-checkout-${mode}-${row.checkout_nonce}`});
      await save({checkout_id:session.id});return {url:session.url};
    });
  }
  async function status(user) {
    if(mode==='live'&&(await db.testing()).proEnabled)return {...membership(await db.load(mode,user.id,null),now()),checkoutEnabled:true,freeTesting:true,mode};
    await configured();
    const row=await db.load(mode,user.id,null);
    if(!row?.customer_id)return {...membership(row,now()),checkoutEnabled,mode};
    return locked(user.id,async(get,save)=>{
      await synchronize(get(),save);
      return {...membership(get(),now()),checkoutEnabled,mode};
    });
  }
  async function manage(user) {
    const row=await db.load(mode,user.id,null);
    if(!row?.customer_id)throw problem(409,'There is no billing account to manage yet.');
    return portalURL(row.customer_id);
  }
  async function webhook(event) {
    if(event.livemode!==(mode==='live')||!EVENTS.has(event.type))return {received:true};
    const object=event.data.object;
    const customer=event.type==='customer.deleted'?object.id:objectId(object.customer);
    if(!customer)return {received:true};
    const row=await db.load(mode,null,customer);
    // Existing Substack events and other customers must not create site memberships.
    if(!row)return {received:true};
    await locked(row.owner_id,async(get,save)=>{
      if(event.type==='customer.deleted')await save({subscription_id:null,status:'deleted',pro_until:null,cancel_at_period_end:false});
      else await synchronize(get(),save);
    });
    return {received:true};
  }
  return {checkout,status,manage,webhook};
}
