/* Membership display and hosted billing navigation; entitlement is server-owned. */
(() => {
  try {
    if(window.parent!==window&&window.parent.AustinSession===window.AustinSession&&window.parent.AustinMembership){
      window.AustinMembership=window.parent.AustinMembership;window.dispatchEvent?.(new Event('austin-membership-ready'));return;
    }
  }catch(_){}
  const S=window.AustinSession,listeners=new Set();
  const identity=()=>S?.registered?S.user.id:null;
  let owner=identity(),generation=0,pending=null,state=null;
  const emit=()=>listeners.forEach(fn=>fn(state));
  function reset(){owner=identity();generation++;pending=null;state=null;emit();}
  async function request(action,id,attempt=0) {
    const {data,error}=await S.client().functions.invoke('billing',{body:{action}});
    if(identity()!==id)throw new Error('Your account changed. Please try again.');
    if(error){
      if(action==='status'&&error.context?.status===409&&attempt<2){
        await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
        if(identity()!==id)throw new Error('Your account changed. Please try again.');
        return request(action,id,attempt+1);
      }
      let body;try{body=await error.context?.clone().json();}catch(_){}
      const failure=new Error(body?.error||'Billing could not connect. Please try again.');
      failure.status=error.context?.status;throw failure;
    }
    return data;
  }
  async function load() {
    await S?.peek();if(identity()!==owner)reset();
    if(!owner)return null;if(pending)return pending;
    const id=owner,run=generation;
    const task=(async()=>{
      let billing,unavailable=false;
      try{billing=await request('status',id);}catch(error){
        if(identity()!==id)throw error;
        if(error.status!==403&&error.status!==503)throw error;
        unavailable=true;
      }
      const result=await S.client().rpc('membership_read');
      if(result.error)throw new Error('Your membership could not load. Please try again.');
      if(identity()!==id||run!==generation)return null;
      state={...result.data,checkoutEnabled:billing?.checkoutEnabled===true,freeTesting:billing?.freeTesting===true||result.data.freeTesting===true,
        testMode:billing?.mode==='test',testPlan:billing?.mode==='test'?billing.plan:null,
        hasBilling:billing?.hasBilling===true||result.data.hasBilling===true,
        billingUnavailable:unavailable};
      emit();return state;
    })();pending=task;
    try{return await task;}finally{if(pending===task)pending=null;}
  }
  async function openBilling(action) {
    await S?.peek();const id=identity();if(!id)throw new Error('Sign in to manage your membership.');
    const value=await request(action,id);
    if(action==='checkout'&&value.activated===true){await load();return;}
    const url=new URL(value.url);
    const expected=action==='portal'?['https://billing.stripe.com']:['https://checkout.stripe.com','https://billing.stripe.com'];
    if(!expected.includes(url.origin))throw new Error('Billing returned an invalid link. Please try again.');
    if(identity()!==id)throw new Error('Your account changed. Please try again.');
    window.location.assign(url.href);
  }
  window.AustinMembership={load,checkout:()=>openBilling('checkout'),manage:()=>openBilling('portal'),
    get state(){return identity()===owner?state:null;},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
  S?.subscribe(()=>{if(identity()!==owner)reset();});
  window.dispatchEvent?.(new Event('austin-membership-ready'));
})();
