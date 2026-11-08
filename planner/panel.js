/* One main map; collapsing the editor keeps its selected-day map visible. */
(() => {
  const panel=document.getElementById('plan-panel'),button=document.getElementById('ctrlDayPlan');
  const toolbar=document.getElementById('planner-map-toolbar'),visit=window.AustinVisit;
  let active=false;
  function drawer(open,focus=false){
    if(!open&&panel.contains(document.activeElement))button.focus({preventScroll:true});
    panel.hidden=!open;panel.inert=!open;panel.setAttribute('aria-hidden',String(!open));
    button.setAttribute('aria-expanded',String(open));
    document.getElementById('planner-map-edit').hidden=open;
    if(open&&focus)document.getElementById('plan-day').focus({preventScroll:true});
  }
  function mode(on,history=true){
    active=on;toolbar.hidden=!on;button.classList.toggle('is-on',on);
    document.documentElement.classList.toggle('planning-day',on);
    window.PlanMap.setActive(on);
    window.dispatchEvent(new CustomEvent('austin:planner-view',{detail:{active:on}}));
    if(history)visit?.plannerView?.(on);
  }
  function open({history=true,focus=true}={}){
    for(const name of ['AustinEvent','AustinClassifieds','AustinExplore','AustinCityHall','AustinChatCard','AustinApps','AustinMedia','AustinMapLayers'])window[name]?.close?.();
    mode(true,history);drawer(true,focus);
  }
  function leave({history=true}={}){document.querySelectorAll('#day-dialog[open],#export-dialog[open]').forEach(dialog=>dialog.close());drawer(false);mode(false,history);}
  function explore(){leave();if(window.AustinEvent)window.AustinEvent.open();else window.AustinExplore.open?.();}
  button.addEventListener('click',()=>{if(panel.hidden)open();else drawer(false);});
  document.getElementById('plan-panel-close').onclick=()=>drawer(false);
  document.getElementById('planner-map-edit').onclick=()=>open();
  document.querySelectorAll('[data-plan-explore]').forEach(el=>el.onclick=explore);
  document.querySelectorAll('[data-plan-map]').forEach(el=>el.onclick=()=>drawer(false));
  document.getElementById('fit-plan').onclick=()=>window.PlanMap.fit();
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]')){event.stopPropagation();drawer(false);}});
  function status(){
    const plan=window.PlanStore.plan;
    document.getElementById('planner-map-day').textContent=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric'}).format(new Date(plan.date+'T12:00:00-06:00'))+` · ${plan.items.length} planned stops`;
    document.getElementById('fit-plan').disabled=!plan.items.some(item=>window.PlanRouting.coordinates(item));
  }
  window.PlanPanel={open,close:()=>drawer(false),leave,showMap:()=>{if(matchMedia('(max-width:680px)').matches)drawer(false);},
    setView:on=>on?open({history:false,focus:false}):leave({history:false}),get isOpen(){return !panel.hidden;},get active(){return active;}};
  window.AustinDayPlan={open,close:leave};
  window.PlanStore.subscribe(status);status();
  const requested=visit?.get('main:planner')==='true'||new URLSearchParams(window.parent.location.search).get('planner')==='1';
  if(requested)open({history:false,focus:false});
})();
