/* Shared selection checkboxes. The full editor belongs to the home map. */
(() => {
  const store=window.PlanStore,inputs=new WeakMap(),button=document.getElementById('ctrlDayPlan');
  const dateLabel=date=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric'}).format(new Date(date+'T12:00:00-06:00'));
  if(!window.PlanPanel)button?.addEventListener('click',()=>{
    const url=new URL('/?planner=1',location.origin);
    if(!window.AustinVisit?.navigate?.(url))window.top.location.href=url.href;
  });
  function refresh(){
    if(button)button.title=`Day Plan · ${store.plan.items.length} stops on ${dateLabel(store.plan.date)}`;
    document.querySelectorAll('.plan-select input').forEach(input=>{const source=inputs.get(input);if(source){input.checked=store.has(source);input.title=`Plan for ${dateLabel(window.PlanModel.targetDay(source,store.plan.date))}`;}});
  }
  function mount(container,source){
    const label=document.createElement('label');label.className='plan-select';
    const input=document.createElement('input');input.type='checkbox';input.dataset.planKey=source.key;inputs.set(input,source);
    input.checked=store.has(source);input.setAttribute('aria-label',`Add ${source.title} to Day Planner`);
    const text=document.createElement('span');text.textContent='Day Planner';label.append(input,text);container.append(label);
    input.addEventListener('change',async()=>{
      input.disabled=true;
      try{const selected=input.checked,date=await store.select(source,selected);label.title=`${selected?'Added to':'Removed from'} ${dateLabel(date)}’s plan.`;}
      catch(error){label.title=error.message;alert(error.message);}
      finally{input.disabled=false;refresh();}
    });
    return label;
  }
  window.PlanSelection={mount};
  window.addEventListener('austin:planner-target',event=>{
    const {container,provider,data}=event.detail;
    mount(container,provider==='place'?window.PlanSources.place(data):window.PlanSources.feature(data));
  });
  store.subscribe(refresh);refresh();store.ready().then(refresh);
})();
