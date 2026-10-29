/* Optional selection bridge. Applications publish a DOM target + source data;
   they never import planner storage or change chat rooms to save a selection. */
(() => {
  const store = window.PlanStore;
  const bar = document.createElement('div'); bar.className = 'plan-bar';
  const label=document.createElement('label'); label.textContent='Plan day';
  const day=document.createElement('input'); day.type='date'; day.min='2020-01-01'; day.max='2099-12-31'; day.setAttribute('aria-label','Plan day for saved places'); label.append(day);
  const open=document.createElement('a'); open.className='plan-open'; open.href='/myplanmap/';open.target='_top';
  const notice=document.createElement('span'); notice.className='plan-selection-notice'; notice.setAttribute('role','status');
  bar.append(label,open,notice); document.querySelector('.page').append(bar);
  const inputs = new WeakMap();
  const dateLabel = date => new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric'}).format(new Date(date+'T12:00:00-06:00'));
  day.addEventListener('change',async()=>{ if (!day.reportValidity() || !day.value) return; try {await store.chooseDay(day.value);notice.textContent='Places save to this day. Dated events use their published day.';}catch(e){notice.textContent=e.message;} });
  function refresh() {
    day.value = store.plan.date;
    open.textContent = `My Plan Map · ${store.plan.items.length} →`;
    document.querySelectorAll('.plan-select input').forEach(input => { const source=inputs.get(input);if(source) {input.checked=store.has(source);input.title=`Plan for ${dateLabel(window.PlanModel.targetDay(source,store.plan.date))}`;} });
  }
  window.addEventListener('austin:planner-target', event => {
    const { container, provider, data } = event.detail;
    const source = provider === 'place' ? window.PlanSources.place(data) : window.PlanSources.feature(data);
    const label = document.createElement('label'); label.className = 'plan-select';
    const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.planKey = source.key;
    inputs.set(input,source);
    input.checked = store.has(source); input.setAttribute('aria-label', `Add ${source.title} to My Plan Map`);
    const text = document.createElement('span'); text.textContent = 'My plan';
    label.append(input, text); container.append(label);
    input.addEventListener('change', async () => {
      input.disabled = true;
      try { const selected=input.checked,date=await store.select(source,selected); label.title = ''; notice.textContent=`${selected?'Saved to':'Removed from'} ${dateLabel(date)}’s plan.`; }
      catch (error) { label.title = error.message; alert(error.message); }
      finally { input.disabled = false; refresh(); }
    });
  });
  store.subscribe(refresh); refresh(); store.ready().then(refresh);
})();
