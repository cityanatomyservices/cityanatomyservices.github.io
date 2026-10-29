(() => {
  const S = window.PlanStore, M = window.PlanModel, routing = window.PlanRouting;
  const $ = id => document.getElementById(id), form = $('plan-settings');
  let undo, signature = '', mapSignature = '', view = 'timeline';
  const fmt = value => value ? new Intl.DateTimeFormat('en-US',{ timeZone:M.zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit' }).format(new Date(value)) : '';
  const node = (tag,text,cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
  function message(text) { $('plan-message').textContent = text; }
  function link(text,url) {
    try { const u = new URL(url); if (!['https:','http:'].includes(u.protocol)) return node('span',text); }
    catch (_) { return node('span',text); }
    const a = node('a',text); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
  }
  async function change(fn, text = '') {
    const before = S.plan;
    try { await S.edit(fn); undo = before; $('undo').disabled = false; message(text); }
    catch (error) { message(error.message); signature = ''; render(); }
  }
  function field(item, title, name, type, value, extra = {}) {
    const label = node('label',title), input = document.createElement('input');
    input.type = type; input.value = value ?? ''; input.dataset.field = name; input.dataset.item = item.id;
    input.setAttribute('aria-label', `${title} for ${item.source.title}`); Object.assign(input, extra); label.append(input);
    return label;
  }
  function card(item,index,issues) {
    const s = item.source, u = item.schedule;
    const li = node('li',null,'plan-item' + (issues.some(x => x.severity === 'error') ? ' has-conflict' : '')); li.dataset.itemId = item.id;
    const title = node('div',null,'stop-title'), number = node('button',String(index + 1),'stop-number');
    number.type = 'button'; number.setAttribute('aria-label',`Show ${s.title} on map`); number.onclick = () => window.PlanMap.focus(item.id);
    title.append(number,node('h2',s.title)); li.append(title,node('p',[s.venue,s.address].filter(Boolean).join(' · '),'stop-venue'));
    const published = s.kind === 'movie' ? 'Choose one of the published showtimes below.' : s.timing === 'fixed'
      ? `Published: ${fmt(s.start)}${s.endKnown ? ' – ' + fmt(s.end) : ' · finish not supplied'}`
      : s.timing === 'window' ? `Visit window: ${fmt(s.start)} – ${fmt(s.end)}` : 'Flexible visit · verify opening hours';
    li.append(node('p',published,'source-timing'));
    const grid = node('div',null,'schedule-grid');
    if (s.kind === 'movie') {
      const label = node('label','Movie showtime','full'), select = node('select');
      select.dataset.field = 'showtime'; select.dataset.item = item.id; select.setAttribute('aria-label', `Movie showtime for ${s.title}`);
      const blank = node('option','Choose a showtime'); blank.value = ''; select.append(blank);
      for (const show of s.showtimes || []) { const option = node('option',`${fmt(show.start)}${show.format ? ' · '+show.format : ''}`); option.value = show.start; select.append(option); }
      select.value = u.showtime || ''; label.append(select); grid.append(label);
    }
    grid.append(field(item,'Arrival (Austin time)','start','datetime-local',u.start ? M.local(u.start) : ''),field(item,'Visit length (min)','duration','number',u.duration,{min:1,max:1440,step:1}));
    const lock = node('label',null,'lock-label'), check = node('input'); check.type = 'checkbox'; check.checked = u.locked; check.dataset.field = 'locked'; check.dataset.item = item.id;
    lock.append(check,document.createTextNode('Lock this arrival time')); li.append(grid,lock);
    if (u.start) li.append(node('p',`Your visit: ${fmt(u.start)} – ${fmt(Date.parse(u.start) + u.duration * 60000)}`,'source-timing'));
    if (issues.length) { const list = node('ul',null,'stop-issues'); for (const issue of issues) list.append(node('li',issue.text,issue.severity)); li.append(list); }
    const details = node('details',null,'stop-details'); details.dataset.details = item.id;
    details.append(node('summary','Hours, buffer, notes & source'));
    if (s.description) details.append(node('p',s.description));
    if (s.conditions) details.append(node('p',s.conditions));
    if (s.hoursText) details.append(node('p','Published hours: '+s.hoursText));
    details.append(node('p','Optional availability for this visit. Enter both dates/times after checking the venue. Overnight hours use the next date for closing.'));
    details.append(field(item,'Available from','windowStart','datetime-local',u.windowStart ? M.local(u.windowStart) : ''),field(item,'Available until','windowEnd','datetime-local',u.windowEnd ? M.local(u.windowEnd) : ''));
    details.append(field(item,'Travel buffer before this stop (min)','bufferBefore','number',u.bufferBefore ?? '',{min:0,max:240,placeholder:'Use day default'}));
    const noteLabel = node('label','My notes'), notes = node('textarea'); notes.value = u.note || ''; notes.maxLength = 2000; notes.dataset.field = 'note'; notes.dataset.item = item.id; noteLabel.append(notes); details.append(noteLabel);
    if (s.provider || s.checked) details.append(node('p',[s.provider,s.checked ? 'Source checked '+fmt(s.checked) : ''].filter(Boolean).join(' · ')));
    details.append(node('p','Saved details are a snapshot. Check the source for cancellations and changed hours.'));
    li.append(details);
    const actions = node('div',null,'stop-actions'), order = node('span',null,'order');
    order.hidden = view !== 'order';
    const orderIndex = S.plan.items.findIndex(i => i.id === item.id);
    for (const [text,delta] of [['↑',-1],['↓',1]]) {
      const button = node('button',text); button.type = 'button'; button.disabled = delta < 0 ? orderIndex === 0 : orderIndex === S.plan.items.length - 1;
      button.setAttribute('aria-label',`Move ${s.title} ${delta < 0 ? 'earlier' : 'later'} in preferred order`);
      button.onclick = () => change(plan => { const at = plan.items.findIndex(i => i.id === item.id), to = at + delta; if (at >= 0 && to >= 0 && to < plan.items.length) [plan.items[at],plan.items[to]] = [plan.items[to],plan.items[at]]; },'Order changed. Build my day to arrange flexible stops in this order.');
      order.append(button);
    }
    const remove = node('button','Remove'); remove.type = 'button'; remove.setAttribute('aria-label',`Remove ${s.title}`);
    remove.onclick = () => change(plan => { plan.items = plan.items.filter(i => i.id !== item.id); },`${s.title} removed. You can undo or add it again from the main map.`);
    const selectedShow = s.showtimes?.find(show => show.start === u.showtime);
    actions.append(order,link('Source ↗',selectedShow?.url || s.url),remove); li.append(actions);
    return li;
  }
  function render() {
    $('save-status').textContent = S.status;
    $('save-conflict').hidden = !S.conflict;
    $('retry-save').hidden = !/unavailable/.test(S.status);
    const plan = S.plan, next = view + JSON.stringify(plan);
    if (next === signature) return;
    signature = next;
    const active = document.activeElement;
    const focus = active?.dataset.field ? [active.dataset.item,active.dataset.field] : null;
    const open = new Set([...document.querySelectorAll('.stop-details[open]')].map(e => e.dataset.details));
    for (const name of ['name','date','dayStart','dayEnd','bufferMinutes']) if (form.elements[name] !== active) form.elements[name].value = plan[name];
    $('day-settings-label').textContent = `Day settings · ${plan.date} · ${plan.dayStart}–${plan.dayEnd}`;
    const result = M.check(plan,routing);
    const uncertain = plan.items.filter(i => result.issues.get(i.id).some(x => x.severity === 'warning')).length;
    $('plan-summary').textContent = plan.items.length ? `${plan.items.length} stops · ${result.scheduled.length} scheduled · ${result.conflicts ? result.conflicts+' need attention' : 'no time conflicts'}${uncertain ? ' · '+uncertain+' to confirm' : ''}` : 'Your personal itinerary';
    $('view-timeline').setAttribute('aria-pressed',String(view === 'timeline')); $('view-order').setAttribute('aria-pressed',String(view === 'order'));
    $('plan-empty').hidden = !!plan.items.length; $('build-day').disabled = !plan.items.length;
    const displayed = view === 'timeline' ? [...plan.items].sort((a,b) => (Date.parse(a.schedule.start) || Infinity) - (Date.parse(b.schedule.start) || Infinity)) : plan.items;
    $('plan-items').replaceChildren(...displayed.map((item,index) => card(item,index,result.issues.get(item.id))));
    for (const el of document.querySelectorAll('.stop-details')) el.open = open.has(el.dataset.details);
    if (focus) document.querySelector(`[data-item="${CSS.escape(focus[0])}"][data-field="${CSS.escape(focus[1])}"]`)?.focus({preventScroll:true});
    const pins = JSON.stringify(displayed.map(i => [i.id,i.source.coordinates,i.schedule.start,i.schedule.duration]));
    if (pins !== mapSignature) { window.PlanMap.update(displayed); mapSignature = pins; }
  }
  form.addEventListener('submit', e => e.preventDefault());
  $('view-timeline').onclick = () => { view = 'timeline'; render(); };
  $('view-order').onclick = () => { view = 'order'; render(); message('Use the arrows to set your preference, then Build my day. Locked arrivals and fixed starts stay put.'); };
  form.addEventListener('change', event => {
    if (!event.target.name || !event.target.reportValidity()) return;
    const name = event.target.name, value = event.target.value;
    change(plan => { plan[name] = name === 'bufferMinutes' ? Number(value) : value; }, name === 'date' ? 'Day changed. Saved items and locked arrivals are kept; check their dates and build again.' : '');
  });
  $('plan-items').addEventListener('change', event => {
    const el = event.target, name = el.dataset.field, id = el.dataset.item;
    if (!name || !el.reportValidity()) return;
    let value = el.type === 'checkbox' ? el.checked : el.value, notice = '';
    if (['start','windowStart','windowEnd'].includes(name)) {
      const candidates = value ? M.localCandidates(value) : [];
      if (value && !candidates.length) { message('That Austin time does not exist during the daylight-saving change. Choose another time.'); return; }
      value = candidates[0] || null;
      if (candidates.length > 1) notice = 'This time occurs twice when clocks change. The earlier occurrence is selected.';
    }
    if (['duration','bufferBefore'].includes(name)) value = value === '' && name === 'bufferBefore' ? null : Number(value);
    change(plan => {
      const item = plan.items.find(i => i.id === id); if (!item) return;
      item.schedule[name] = value;
      if (name === 'start') item.schedule.locked = !!value;
      if (name === 'duration') item.schedule.durationConfirmed = true;
      if (name === 'showtime') { item.schedule.showtime = value || null; item.schedule.start = value || null; }
      if (name === 'locked' && value && !item.schedule.start) throw new Error('Set an arrival time before locking this stop.');
      if (item.schedule.windowStart && item.schedule.windowEnd && Date.parse(item.schedule.windowEnd) <= Date.parse(item.schedule.windowStart)) throw new Error('Available until must be later than Available from.');
    },notice);
  });
  $('build-day').onclick = () => change(plan => {
    const built = M.build(plan,routing); plan.items = built.items;
  },'Day arranged. Review the visit lengths, opening hours and travel buffers before going. Locked stops were kept.');
  $('undo').onclick = async () => {
    if (!undo) return; const previous = undo;
    try { await S.edit(plan => Object.assign(plan,previous)); undo = null; $('undo').disabled = true; message('Last change undone.'); }
    catch (e) { message(e.message); }
  };
  $('retry-save').onclick = () => S.retry().catch(e => message(e.message));
  $('keep-local').onclick = () => S.resolve(true).catch(e => message(e.message));
  $('use-remote').onclick = () => S.resolve(false).catch(e => message(e.message));
  $('download-plan').onclick = () => {
    const blob = new Blob([JSON.stringify({ format:'austin-chat-plan-v1',exported:new Date().toISOString(),plan:S.plan },null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob), a = node('a'); a.href = url; a.download = `austin-plan-${S.plan.date}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  $('import-plan').onclick = () => $('import-file').click();
  $('import-file').onchange = async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 2000000) throw new Error('That file is too large. Choose an Austin plan download under 2 MB.');
      const data = JSON.parse(await file.text());
      if (data.format !== 'austin-chat-plan-v1' || !M.valid(data.plan)) throw new Error('This file is not a supported Austin plan.');
      await change(plan => {
        const id = plan.id;
        Object.assign(plan,data.plan,{id});
        plan.items.forEach(i => { i.id = crypto.randomUUID(); });
      },'Downloaded plan restored. Undo returns to your previous plan.');
    } catch (error) { message(error.message); }
    event.target.value = '';
  };
  S.subscribe(render); render();
  const mobile = matchMedia('(max-width: 680px)');
  const foldSettings = () => { $('day-settings').open = !mobile.matches; };
  foldSettings(); mobile.addEventListener('change', foldSettings);
  const controls = [...document.querySelectorAll('#plan-settings input,#plan-settings button,#build-day')];
  controls.forEach(e => { e.disabled = true; });
  S.ready().then(() => { controls.forEach(e => { e.disabled = false; }); signature = ''; render(); });
})();
