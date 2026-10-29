/* Presentation only: the drawer never reads or writes itinerary data. */
(() => {
  const layout=document.querySelector('.planner-layout');
  const panel=document.getElementById('plan-panel');
  const toggle=document.getElementById('plan-panel-toggle');
  const mobile=matchMedia('(max-width: 680px)');
  function setOpen(open) {
    if(!open && panel.contains(document.activeElement)) toggle.focus({preventScroll:true});
    panel.inert=!open;
    panel.setAttribute('aria-hidden',String(!open));
    layout.classList.toggle('panel-closed',!open);
    toggle.setAttribute('aria-expanded',String(open));
    toggle.title=open?'Hide itinerary':'Show itinerary';
    toggle.setAttribute('aria-label',toggle.title);
  }
  toggle.addEventListener('click',()=>setOpen(panel.inert));
  window.PlanPanel={
    open:()=>setOpen(true),
    showMap:()=>{if(mobile.matches)setOpen(false);},
    get isOpen(){return !panel.inert;}
  };
})();
