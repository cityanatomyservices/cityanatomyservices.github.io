/* Old bookmarks open the same main-map editor. Keep any other URL details. */
(() => {
  const url=new URL(location.href);url.pathname='/';url.searchParams.set('planner','1');
  try {if(window.parent!==window&&window.parent.AustinVisit?.navigate(url))return;} catch {}
  window.top.location.replace(url.pathname+url.search+url.hash);
})();
