/* Async transport/cache stays outside the pure schedule model. Road estimates
   are static; changing a time rechecks the schedule without inventing traffic. */
(function(root,factory) {
  const api=factory();
  if (typeof module==='object' && module.exports) module.exports=api;
  else {
    let owner;
    const provider=api.create({
      async session() {
        const session=await root.AustinSession.ready();
        if (owner!==session.user.id) { owner=session.user.id; provider.clear(); }
        return root.AustinSession.client();
      },
      async rpc(client,name,args,signal) {
        const {data,error}=await client.rpc(name,args).abortSignal(signal);
        if(error) throw error;
        return data;
      }
    });
    try { const subscription=root.AustinSession.client?.().auth.onAuthStateChange((_event,session)=>{
      if(owner && owner!==session?.user?.id) {owner=session?.user?.id;provider.cancel();provider.clear();}
    })?.data?.subscription;
    root.addEventListener('pagehide',()=>{subscription?.unsubscribe();provider.cancel();});
    } catch(_) { /* The itinerary remains usable without an auth connection. */ }
    root.PlanRouting=Object.assign(provider,{coordinates:api.coordinates,navigation:api.navigation,options:api.options});
  }
})(typeof globalThis==='object' ? globalThis : this,()=>{
  const coordinates=item=>item?.schedule?.routeCoordinates || item?.source?.coordinates;
  const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
  const options=plan=>({enabled:false,avoidTolls:false,arrivalMinutes:10,...plan.routing});
  function ordered(plan) { return plan.items.filter(i=>(!i.day || i.day===plan.date)&&i.schedule.start&&Number.isFinite(Date.parse(i.schedule.start))).sort((a,b)=>Date.parse(a.schedule.start)-Date.parse(b.schedule.start)); }
  function navigation(item,service='google') {
    const p=coordinates(item), dest=validPoint(p) ? `${p[1]},${p[0]}` : [item.source.title,item.source.address,'Austin TX'].filter(Boolean).join(', ');
    if(service==='apple') return `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}&dirflg=d`;
    if(service==='waze') return `https://www.waze.com/ul?${validPoint(p)?'ll':'q'}=${encodeURIComponent(dest)}&navigate=yes&utm_source=austin_chat`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving&dir_action=navigate`;
  }
  function create(transport) {
    const cache=new Map(), listeners=new Set();
    let version=null,revision=0,controller=null,busy=false,done=0,total=0,lastStatus='',metadata=null,requested='';
    const notify=()=>{ revision++; listeners.forEach(fn=>fn()); };
    const routeKey=(a,b,p)=>JSON.stringify([version,options(p).avoidTolls,coordinates(a),coordinates(b)]);
    const signature=plan=>JSON.stringify([plan.date,options(plan).enabled,options(plan).avoidTolls,ordered(plan).map(i=>[i.id,coordinates(i)])]);
    function leg(before,after,plan) {
      const fallback={status:'manual',minutes:after.schedule.bufferBefore??plan.bufferMinutes};
      if(!options(plan).enabled) return fallback;
      if(!validPoint(coordinates(before))||!validPoint(coordinates(after))) return {...fallback,status:'missing_location'};
      const saved=cache.get(routeKey(before,after,plan));
      if(!saved) return {...fallback,status:busy?'pending':'unavailable'};
      if(saved.status!=='ready') return {...fallback,...saved,minutes:fallback.minutes};
      const allowance=after.schedule.arrivalMinutes??options(plan).arrivalMinutes;
      return {...saved,arrivalMinutes:allowance,minutes:saved.driveMinutes+saved.accessMinutes+allowance};
    }
    async function calculate(plan,{force=false}={}) {
      const wanted=signature(plan);
      if(!force && requested===wanted) return;
      controller?.abort();
      const current=new AbortController(); controller=current;
      requested=wanted; busy=true;done=0;lastStatus='';
      const items=ordered(plan); total=Math.max(0,items.length-1);notify();
      try {
        const client=await transport.session();
        if(current.signal.aborted) return;
        controller=current;requested=wanted;busy=true;
        const status=await transport.rpc(client,'planner_routing_status',{},current.signal);
        if(current.signal.aborted) return;
        if(status?.status!=='ready') throw new Error('Routing is temporarily unavailable. Your itinerary is still open.');
        if(version!==status.networkVersion) {cache.clear();version=status.networkVersion;}
        metadata=status;
        for(let i=1;i<items.length;i++) {
          if(current.signal.aborted) return;
          const a=items[i-1],b=items[i],key=routeKey(a,b,plan);
          if(validPoint(coordinates(a))&&validPoint(coordinates(b))) {
            const existing=cache.get(key);
            if(force || existing?.status!=='ready') {
              let result;
              try {
                for(let attempt=0;attempt<3;attempt++) {
                  result=await transport.rpc(client,'planner_route_leg',{p_from:coordinates(a),p_to:coordinates(b),p_avoid_tolls:options(plan).avoidTolls},current.signal);
                  if(result?.status!=='busy'||current.signal.aborted) break;
                  if(attempt<2) await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));
                }
                if(result?.status==='ready' && (!Number.isFinite(result.driveMinutes)||result.driveMinutes<0||!Number.isFinite(result.accessMinutes)||result.accessMinutes<0||result.networkVersion!==version)) result={status:'unavailable'};
              } catch(error) { if(current.signal.aborted) return;result={status:'unavailable'}; }
              if(current.signal.aborted) return;
              cache.set(key,result || {status:'unavailable'});
              if(cache.size>400) cache.delete(cache.keys().next().value);
            }
          }
          done=i;notify();
        }
      } catch(error) { if(!current.signal.aborted) lastStatus=error.message || 'Routing is temporarily unavailable.'; }
      finally { if(controller===current) {busy=false;notify();} }
    }
    function clear() {cache.clear();version=null;requested='';metadata=null;lastStatus='';revision++;}
    function cancel() {controller?.abort();controller=null;requested='';busy=false;notify();}
    return {leg,calculate,clear,cancel,signature,ordered,
      get revision(){return revision;},
      get state(){return {busy,done,total,lastStatus,metadata};},
      subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
    };
  }
  return {create,coordinates,navigation,options,ordered};
});
