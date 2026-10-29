/* Optional selection bridge. Applications publish a DOM target + source data;
   they never import planner storage or change chat rooms to save a selection. */
(() => {
  const store = window.PlanStore;
  const bar = document.createElement('a');
  bar.className = 'plan-open'; bar.href = '/myplanmap/'; bar.target = '_top';
  document.querySelector('.page').append(bar);
  function refresh() {
    bar.textContent = `My Plan Map · ${store.plan.items.length} →`;
    const keys = new Set(store.plan.items.map(i => i.source.key));
    document.querySelectorAll('.plan-select input').forEach(input => { input.checked = keys.has(input.dataset.planKey); });
  }
  window.addEventListener('austin:planner-target', event => {
    const { container, provider, data } = event.detail;
    const source = provider === 'place' ? window.PlanSources.place(data) : window.PlanSources.feature(data);
    const label = document.createElement('label'); label.className = 'plan-select';
    const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.planKey = source.key;
    input.checked = store.has(source); input.setAttribute('aria-label', `Add ${source.title} to My Plan Map`);
    const text = document.createElement('span'); text.textContent = 'My plan';
    label.append(input, text); container.append(label);
    input.addEventListener('change', async () => {
      input.disabled = true;
      try { await store.select(source, input.checked); label.title = ''; }
      catch (error) { label.title = error.message; alert(error.message); }
      finally { input.disabled = false; refresh(); }
    });
  });
  store.subscribe(refresh); refresh(); store.ready().then(refresh);
})();
