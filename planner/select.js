/* Optional selection bridge. Applications publish a DOM target + source data;
   they never import planner storage or change chat rooms to save a selection. */
(() => {
  const store = window.PlanStore;
  const button=document.getElementById('ctrlDayPlan');
  const bar=document.createElement('section');bar.className='plan-bar';bar.id='day-plan-panel';bar.hidden=true;bar.setAttribute('aria-label','Day Plan');
  const header=document.createElement('div');header.className='plan-bar-heading';
  const heading=document.createElement('h2');heading.textContent='Day Plan';
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close Day Plan');header.append(heading,close);
  const label=document.createElement('label');label.textContent='Choose a day';
  const day=document.createElement('input');day.id='day-plan-date';day.type='date';day.min='2020-01-01';day.max='2099-12-31';day.setAttribute('aria-label','Choose a day to plan');label.append(day);
  const savedLabel=document.createElement('label');savedLabel.textContent='Planned days';
  const saved=document.createElement('select');saved.id='day-plan-saved';saved.setAttribute('aria-label','Open a planned day');savedLabel.append(saved);
  const open=document.createElement('a');open.className='plan-open';open.href='/myplanmap/';open.target='_top';
  const privacy=document.createElement('span');privacy.className='plan-selection-notice';privacy.textContent='Guest plan · refresh or close clears it';
  const notice=document.createElement('span');notice.className='plan-selection-notice';notice.setAttribute('role','status');
  bar.append(header,label,savedLabel,open,privacy,notice);document.querySelector('.page').append(bar);
  const inputs=new WeakMap();
  const dateLabel=date=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric'}).format(new Date(date+'T12:00:00-06:00'));
  function show(on,returnFocus=false) {
    if(on){window.AustinChatCard?.close();window.AustinExplore?.close?.();window.AustinApps?.close();window.AustinMedia?.close();}
    bar.hidden=!on;button.setAttribute('aria-expanded',String(on));button.classList.toggle('is-on',on);
    if(on)day.focus({preventScroll:true});else if(returnFocus||bar.contains(document.activeElement))button.focus({preventScroll:true});
  }
  window.AustinDayPlan={close:()=>show(false)};
  if(window.PlanPanel)open.addEventListener('click',event=>{
    event.preventDefault();show(false);window.PlanPanel.open();
    document.getElementById('plan-day').scrollIntoView({block:'nearest'});
    document.getElementById('plan-day').focus({preventScroll:true});
  });
  button.addEventListener('click',()=>show(bar.hidden));close.addEventListener('click',()=>show(false,true));
  bar.addEventListener('keydown',event=>{if(event.key==='Escape')show(false,true);});
  async function choose(date){try{await store.chooseDay(date);notice.textContent=`Planning ${dateLabel(date)}. Dated events keep their published day.`;}catch(e){notice.textContent=e.message;}}
  day.addEventListener('change',()=>{if(day.reportValidity()&&day.value)choose(day.value);});
  saved.addEventListener('change',()=>{if(saved.value)choose(saved.value);});
  function refresh() {
    day.value=store.plan.date;privacy.hidden=!store.temporary;
    open.textContent=`Open Day Planner · ${store.plan.items.length} ${store.plan.items.length===1?'stop':'stops'} →`;
    const days=store.days.filter(d=>d.count>0),blank=document.createElement('option');
    blank.value='';blank.textContent=days.length?'Choose a planned day':'No planned days yet';
    saved.replaceChildren(blank,...days.map(d=>{const option=document.createElement('option');option.value=d.date;option.textContent=`${dateLabel(d.date)} · ${d.count} ${d.count===1?'stop':'stops'}`;return option;}));
    saved.disabled=!days.length;saved.value=days.some(d=>d.date===store.plan.date)?store.plan.date:'';
    button.title=`Day Plan · ${store.plan.items.length} ${store.plan.items.length===1?'stop':'stops'} on ${dateLabel(store.plan.date)}`;
    document.querySelectorAll('.plan-select input').forEach(input=>{const source=inputs.get(input);if(source){input.checked=store.has(source);input.title=`Plan for ${dateLabel(window.PlanModel.targetDay(source,store.plan.date))}`;}});
  }
  window.addEventListener('austin:planner-target', event => {
    const { container, provider, data } = event.detail;
    const source = provider === 'place' ? window.PlanSources.place(data) : window.PlanSources.feature(data);
    const label = document.createElement('label'); label.className = 'plan-select';
    const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.planKey = source.key;
    inputs.set(input,source);
    input.checked = store.has(source); input.setAttribute('aria-label', `Add ${source.title} to Day Planner`);
    const text = document.createElement('span'); text.textContent = 'Day Planner';
    label.append(input, text); container.append(label);
    input.addEventListener('change', async () => {
      input.disabled = true;
      try { const selected=input.checked,date=await store.select(source,selected); label.title = ''; notice.textContent=`${selected?'Added to':'Removed from'} ${dateLabel(date)}’s plan.`; }
      catch (error) { label.title = error.message; alert(error.message); }
      finally { input.disabled = false; refresh(); }
    });
  });
  store.subscribe(refresh); refresh(); store.ready().then(refresh);
})();
