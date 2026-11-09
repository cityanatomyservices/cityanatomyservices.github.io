/* Planner ownership is fixed by the page, never by a saved collection or date. */
(() => {
  const eventPage=location.pathname==='/special-events/map.html';
  const id=eventPage?new URLSearchParams(location.search).get('event')||'invalid-event':'main';
  const listeners=new Set();let event=null,events=null,error='',expired=false,timer;
  const sourceScope=source=>source?.key?.startsWith('special-event:')?source.key.split(':')[1]:source?.eventId||'main';
  function expire(){
    if(expired)return;expired=true;clearTimeout(timer);
    try{for(const key of Object.keys(localStorage))if(key.startsWith('austin:planner:v2:')&&key.endsWith(':'+id))localStorage.removeItem(key);}catch(_){}
    listeners.forEach(fn=>fn());window.dispatchEvent(new CustomEvent('austin:event-expired'));
  }
  function check(){if(event&&Date.now()>=Date.parse(event.expiresAt))expire();}
  function assert(){check();if(error)throw Error(error);if(expired)throw Error('This Special Event has ended and its plans have expired.');if(eventPage&&!event)throw Error('Opening this Special Event…');}
  const ready=(async()=>{
    try{
      if(eventPage&&(!/^[a-z0-9-]+$/.test(id)||id==='main'))throw Error('Choose a Special Event from Explore.');
      const response=await fetch('/special-events/registry.json?v=20261109d',{cache:'no-store',signal:AbortSignal.timeout(9000)});
      if(!response.ok)throw Error('Could not open this event. Reload to retry.');
      events=await response.json();if(!Array.isArray(events)){events=null;throw Error('Event list is unavailable.');}window.AustinVisit?.set('special-events:pages',events);
      if(!eventPage)return null;
      event=events.find(e=>e.id===id);
      if(!event){expire();throw Error('This Special Event is no longer available.');}
      if(!Number.isFinite(Date.parse(event.expiresAt))||!event.dates?.length)throw Error('Event dates are unavailable.');
      check();if(!expired){const poll=()=>{check();if(!expired)timer=setTimeout(poll,Math.min(60000,Math.max(1,Date.parse(event.expiresAt)-Date.now())));};poll();}
    }catch(e){if(eventPage)error=e.message;}
    return event;
  })();
  document.addEventListener('visibilitychange',check);
  window.addEventListener('pagehide',()=>clearTimeout(timer));
  window.PlanContext={id,ready,sourceScope,assert,check,retire:expire,get events(){return events;},get event(){return event;},get expired(){check();return expired;},
    accepts:source=>sourceScope(source)===id&&(!source.eventId||source.eventId===id),
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
})();
