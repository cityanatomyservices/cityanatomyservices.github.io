/* Travel UI and navigation handoff; no chat dependencies. */
(() => {
  const R=window.PlanRouting,M=window.PlanModel,S=window.PlanStore,$=id=>document.getElementById(id);
  let timer,service='google',currentPlan,change,message;
  try {service=localStorage.getItem('austin:navigation-app')||'google';} catch(_){}
  if(!['google','apple','waze'].includes(service)) service='google';
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
  const time=value=>new Intl.DateTimeFormat('en-US',{timeZone:M.zone,hour:'numeric',minute:'2-digit'}).format(new Date(value));
  const errors={needs_entrance:'Choose a driving entrance closer to a public road using the stop’s map control.',outside_network:'This journey is outside the current Austin metro coverage.',missing_location:'A stop has no map location. Set its driving entrance on the map.',restricted_route:'A reliable route could not be confirmed with the road restrictions.',no_route:'No route could be confirmed between these arrival points.',busy:'Another route is being calculated. Try Plan route again.',rate_limited:'Please wait a few minutes before requesting more routes.',pending:'Calculating this journey…',unavailable:'Travel estimate unavailable. Try Plan route again.'};
  function init(callbacks) {
    ({change,message}=callbacks);
    $('navigation-app').value=service;
    $('navigation-app').onchange=()=>{service=$('navigation-app').value;try{localStorage.setItem('austin:navigation-app',service);}catch(_){};document.querySelectorAll('[data-navigate]').forEach(a=>{const item=S.plan.items.find(i=>i.id===a.dataset.navigate);if(item)a.href=R.navigation(item,service);});};
    $('plan-route').onclick=async()=>{
      const plan=S.plan;
      if(!R.options(plan).enabled) await change(p=>{p.routing={...R.options(p),enabled:true};});
      clearTimeout(timer);await R.calculate(S.plan,{force:true});window.PlanMap?.fit();
    };
    $('fit-travel').onclick=()=>change(plan=>{plan.items=M.fitTravel(plan,R).plan.items;},'Travel fitted into this stop order. Fixed events and locked arrivals were kept. Review the updated times.');
    for(const id of ['route-enabled','avoid-tolls','arrival-minutes']) $(id).onchange=()=>{
      if(!$(id).reportValidity()) return;
      change(plan=>{plan.routing={...R.options(plan),enabled:$('route-enabled').checked,avoidTolls:$('avoid-tolls').checked,arrivalMinutes:Number($('arrival-minutes').value)};});
    };
  }
  function update(plan,result) {
    currentPlan=plan;
    const options=R.options(plan),state=R.state,legs=result.scheduled.slice(1).map((item,i)=>R.leg(result.scheduled[i],item,plan));
    $('route-enabled').checked=options.enabled;$('avoid-tolls').checked=options.avoidTolls;
    if(document.activeElement!==$('arrival-minutes')) $('arrival-minutes').value=options.arrivalMinutes;
    $('plan-route').disabled=state.busy || result.scheduled.length<2;
    $('plan-route').textContent=state.busy?'Planning…':options.enabled?'Refresh route':'Plan route';
    const ready=legs.filter(l=>l.status==='ready');
    $('fit-travel').disabled=state.busy || !options.enabled || legs.length<1 || ready.length!==legs.length;
    $('route-status').textContent=state.busy ? `Calculating journeys · ${state.done} of ${state.total}` : (options.enabled && state.lastStatus) ||
      (options.enabled && legs.length ? `${ready.length} of ${legs.length} journeys estimated${ready.length ? ' · '+ready.reduce((n,l)=>n+l.driveMinutes,0)+' min driving' : ''}${ready.length<legs.length ? ' · check unavailable journeys below' : ''}` : 'Schedule at least two stops, then choose Plan route.');
    window.PlanMap?.routes(options.enabled ? legs.filter(l=>l.status==='ready'&&l.geometry) : []);
    clearTimeout(timer);
    if(options.enabled && result.scheduled.length>1) timer=setTimeout(()=>R.calculate(S.plan),200);
    else if(state.busy) R.cancel();
  }
  function journey(before,after,plan) {
    const leg=R.leg(before,after,plan),li=node('li',null,'travel-leg');
    li.setAttribute('aria-label',`Travel from ${before.source.title} to ${after.source.title}`);
    li.append(node('strong',`To ${after.source.title}`));
    if(leg.status==='ready') {
      const previousEnd=M.interval(before)[1],planned=Date.parse(after.schedule.start);
      const departure=Math.max(previousEnd,planned-leg.minutes*60000),arrival=departure+leg.minutes*60000;
      li.append(node('p',`${time(departure)}–${time(arrival)} · ${leg.driveMinutes} min driving`));
      const details=[leg.distanceMeters!=null ? `${(leg.distanceMeters/1609.344).toFixed(1)} mi` : '',leg.accessMinutes?`${leg.accessMinutes} min estimated road access`:'',`${leg.arrivalMinutes} min parking / extra`,leg.usesToll?'Includes tolls':''].filter(Boolean);
      li.append(node('p',details.join(' · '),'travel-detail'));
      if(leg.snapStartMeters>100 || leg.snapEndMeters>100) li.append(node('p','The road is some distance from a place marker. Check its driving entrance.','travel-detail'));
      if(arrival>planned) {li.classList.add('travel-conflict');li.append(node('p',`About ${Math.ceil((arrival-planned)/60000)} min late at the current times. Adjust a stop or try Fit travel times.`));}
    } else {
      li.classList.add('travel-unavailable');li.append(node('p',errors[leg.status]||'Travel estimate unavailable.'));
      li.append(node('p',`${leg.minutes} min manual allowance · journey time unconfirmed`,'travel-detail'));
    }
    return li;
  }
  function navigation(item) {
    const a=node('a','Navigate ↗','navigate-link');a.href=R.navigation(item,service);a.target='_blank';a.rel='noopener noreferrer';a.dataset.navigate=item.id;a.setAttribute('aria-label',`Navigate to ${item.source.title}`);return a;
  }
  function entrance(item) {
    const box=node('div',null,'entrance-controls'),button=node('button',item.schedule.routeCoordinates?'Change driving entrance on map':'Set driving entrance on map');button.type='button';
    button.onclick=()=>{
      const date=S.plan.date;
      window.PlanMap.pick(item,async point=>{
        if(S.plan.date!==date) return message('The day changed. Choose the entrance again on this day.');
        await change(plan=>{const stop=plan.items.find(i=>i.id===item.id);if(stop)stop.schedule.routeCoordinates=point;},'Driving entrance updated. Travel estimates will refresh.');
      });
      message('Click the driveway or parking entrance on the map. Press Escape to cancel.');
    };
    box.append(button);
    if(item.schedule.routeCoordinates) {const reset=node('button','Use original location');reset.type='button';reset.onclick=()=>change(plan=>{const stop=plan.items.find(i=>i.id===item.id);if(stop)delete stop.schedule.routeCoordinates;});box.append(reset);}
    return box;
  }
  window.PlanRoutePanel={init,update,journey,navigation,entrance};
})();
