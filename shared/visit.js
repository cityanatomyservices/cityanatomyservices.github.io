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
  // Keep the outer page alive when switching maps, so a guest plan can move
  // between them without writing it to storage, a URL, or browser history.
  const routes={
    '/': {src:'/chat/?v=20261030c',title:'Austin.Chat',frameTitle:'Chat map'},
    '/myplanmap/': {src:'/planner/app.html?v=20261030c',title:'My Plan Map · Austin.Chat',frameTitle:'My Plan Map itinerary'}
  };
  if(window===window.top && routes[location.pathname]) {
    let transition=0;
    visit.navigate=(url,push=true)=>{
      const route=routes[url.pathname],frame=document.getElementById('app-window');
      if(url.origin!==location.origin || !route || !frame || url.hash)return false;
      if(push && location.pathname===url.pathname)return true;
      const request=++transition;
      visit.settled().then(()=>{
        if(visit.closed||request!==transition)return;
        if(push)history.pushState(null,'',url.pathname+url.search);
        document.title=route.title;
        document.querySelector('link[rel=canonical]')?.setAttribute('href',url.href);
        frame.title=route.frameTitle;
        // replace avoids adding a second, iframe-only history entry.
        frame.contentWindow.location.replace(route.src);
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
