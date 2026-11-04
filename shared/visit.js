/* One page visit, shared with same-origin map frames. No browser storage. */
(() => {
  let host;
  try { if (window.parent !== window && window.parent.location.origin === location.origin) host = window.parent.AustinVisit; } catch (_) {}
  if (host) window.AustinVisit = host;
  else {
    const values = new Map(), listeners = new Set(), pending = new Set();
    let ended = false;
    window.AustinVisit = {
      id: crypto.randomUUID(),
      get closed(){return ended;},
      get: key => values.get(key) ?? null,
      set(key,value) { if(ended)return; values.set(key,value); listeners.forEach(fn=>fn(key)); },
      remove(key) { values.delete(key); listeners.forEach(fn=>fn(key)); },
      subscribe(fn) { listeners.add(fn); return ()=>listeners.delete(fn); },
      track(task) { pending.add(task);task.then(()=>pending.delete(task),()=>pending.delete(task));return task; },
      async settled() { while(pending.size)await Promise.allSettled([...pending]); }
    };
    window.addEventListener('pagehide',()=>{ended=true;values.clear();listeners.clear();pending.clear();});
    window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
  }
  const visit=window.AustinVisit;
  // The main map owns both discovery and the full planner. In-site aliases
  // change its panel without replacing the iframe or ending a guest visit.
  const aliases=['/myplanmap','/myplanmap/','/myplanmap/index.html','/dayplan','/dayplan/','/dayplan/index.html','/planner/app.html'];
  if(window===window.top) {
    let transition=0;
    const plannerURL=on=>{const url=new URL(location.href);if(on)url.searchParams.set('planner','1');else url.searchParams.delete('planner');return url;};
    const remember=on=>{
      visit.set('main:planner',String(on));
      document.title=on?'Austin day Planner · Austin.Chat':'Austin.Chat';
    };
    visit.plannerView=on=>{
      if(location.pathname!=='/')return;
      const url=plannerURL(on);if(url.href!==location.href)history.pushState(null,'',url.pathname+url.search+url.hash);
      remember(on);
    };
    if(location.pathname==='/')remember(new URLSearchParams(location.search).get('planner')==='1');
    visit.navigate=(input,push=true)=>{
      const url=new URL(input.href),frame=document.getElementById('app-window');
      if(url.origin!==location.origin||!frame)return false;
      if(aliases.includes(url.pathname)){url.pathname='/';url.searchParams.set('planner','1');}
      if(url.pathname!=='/')return false;
      const request=++transition;
      visit.settled().then(()=>{
        if(visit.closed||request!==transition)return;
        if(push&&url.href!==location.href)history.pushState(null,'',url.pathname+url.search+url.hash);
        else if(!push&&url.href!==location.href)history.replaceState(null,'',url.pathname+url.search+url.hash);
        const on=url.searchParams.get('planner')==='1';remember(on);
        document.querySelector('link[rel=canonical]')?.setAttribute('href',url.origin+'/');
        frame.title='Explore and plan Austin';
        try {
          if(['/chat/','/chat/index.html'].includes(frame.contentWindow.location.pathname)){
            frame.contentWindow.PlanPanel?.setView(on);return;
          }
        }catch(_){}
        frame.contentWindow.location.replace('/chat/?v=20261104b');
      });
      return true;
    };
    window.addEventListener('popstate',()=>visit.navigate(new URL(location.href),false));
  }
  document.addEventListener('click',event=>{
    if(event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)return;
    const link=event.target.closest?.('a[href]');
    if(!link || link.hasAttribute('download') || (link.target && !['_self','_top'].includes(link.target)))return;
    if(visit.navigate?.(new URL(link.href,location.href)))event.preventDefault();
  });
})();
