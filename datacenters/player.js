// A cumulative reveal. Add steps here as the recording sequence develops.
window.DC_PLAYER = {
  location(properties) {
    const city = String(properties.city || '').trim();
    const county = String(properties.county || '').trim();
    // Cedar Creek is unincorporated: tshaonline.org/handbook/entries/cedar-creek-tx-bastrop-county
    if (city && !/unincorporated|\bETJ\b|^unknown$|^n\/?a$/i.test(city)
      && !(city === 'Cedar Creek' && county === 'Bastrop')) return city;
    return county ? (/\bcounty\b/i.test(county) ? county : `${county} County`) : window.DC_COPY.player.unknownCity;
  },
  init(sites, onSelect = () => {}, onStep = () => {}) {
    const copy = window.DC_COPY;
    const words = copy.player;
    const statuses = Object.keys(window.DC_CONFIG.status);
    const steps = [
      { title: words.ready },
      ...statuses.map(status => ({ title: copy.status[status], status })),
      { title: words.city, overlay: 'city' },
      { title: words.overview },
      // context steps (2026-09-13): each switches layers on (show) or off (hide)
      // from that point in the sequence onward and shows its paragraph.
      { title: words.electric, show: ['transmission', 'plants', 'substations'], text: words.electricText },
      { title: words.water, show: ['aquifers', 'gcd', 'intakes', 'outfalls'], hide: ['transmission', 'plants', 'substations'], text: words.waterText },
      { title: words.corridor, camera: 'round-rock-taylor', hide: ['aquifers', 'gcd', 'intakes', 'outfalls'], text: words.corridorText },
      { title: words.done, done: true }
    ];
    const page = document.querySelector('.page');
    const panel = document.createElement('section');
    panel.className = 'player';
    panel.setAttribute('aria-label', words.timeline);
    const controls = document.createElement('div');
    controls.className = 'player-controls';
    const button = (text, action) => {
      const el = document.createElement('button');
      const symbols = { [words.back]: '\u23ee', [words.play]: '\u25b6', [words.pause]: '\u23f8', [words.next]: '\u23ed', [words.stop]: '\u23f9' };
      el.type = 'button'; el.textContent = symbols[text];
      el.title = text; el.setAttribute('aria-label', text);
      el.className = text === words.next || text === words.stop ? 'player-right' : 'player-left';
      el.addEventListener('click', action); controls.append(el); return el;
    };
    const card = document.createElement('aside');
    card.className = 'sequence-card'; card.hidden = true;
    const heading = document.createElement('h2');
    const body = document.createElement('div');
    body.className = 'sequence-body';
    card.append(heading, body);
    const ticks = document.createElement('div');
    ticks.className = 'player-ticks';
    const label = document.createElement('span');
    label.className = 'player-step'; label.setAttribute('aria-live', 'polite');
    let index = 0, active = false, playing = false, timer = null;
    let remaining = 3000, deadline = 0;
    let sortField = 'name', sortDirection = 1;
    function renderSites(status) {
      body.replaceChildren();
      const table = document.createElement('table');
      const head = document.createElement('thead');
      const headerRow = document.createElement('tr');
      for (const [field, text] of [['location', words.location], ['name', words.name]]) {
        const th = document.createElement('th'); th.scope = 'col';
        th.setAttribute('aria-sort', sortField === field ? (sortDirection === 1 ? 'ascending' : 'descending') : 'none');
        const sort = document.createElement('button'); sort.type = 'button';
        sort.textContent = text + (sortField === field ? (sortDirection === 1 ? ' \u2191' : ' \u2193') : '');
        sort.addEventListener('click', () => {
          pause();
          sortDirection = sortField === field ? -sortDirection : 1;
          sortField = field; renderSites(status);
        });
        th.append(sort); headerRow.append(th);
      }
      head.append(headerRow);
      const rows = document.createElement('tbody');
      const value = f => sortField === 'name' ? String(f.properties.name || '') : window.DC_PLAYER.location(f.properties);
      const matches = sites.features.filter(f => f.properties.status === status)
        .sort((a, b) => sortDirection * value(a).localeCompare(value(b), undefined, { numeric: true, sensitivity: 'base' }));
      matches.forEach(feature => {
        const row = document.createElement('tr'); row.tabIndex = 0;
        const name = document.createElement('td'); name.textContent = feature.properties.name || '';
        const location = document.createElement('td'); location.textContent = window.DC_PLAYER.location(feature.properties);
        row.title = words.zoomTo;
        const select = () => { pause(); onSelect(feature); };
        row.addEventListener('click', select);
        row.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
        });
        row.append(location, name); rows.append(row);
      });
      table.append(head, rows);
      if (matches.length) body.append(table); else body.textContent = words.empty;
    }
    const inputs = [...document.querySelectorAll('[data-status], [data-overlay]')];
    const setBox = (el, checked) => {
      if (el.checked !== checked) {
        el.checked = checked;
        el.dispatchEvent(new Event('change'));
      }
    };
    function pause() {
      if (playing) remaining = Math.max(0, deadline - performance.now());
      clearTimeout(timer); timer = null; playing = false; update();
    }
    function schedule() {
      clearTimeout(timer);
      playing = true; deadline = performance.now() + remaining;
      timer = setTimeout(() => go(index + 1, true), remaining);
      update();
    }
    function update() {
      play.disabled = playing;
      pauseButton.disabled = !playing;
      back.disabled = index === 0;
      next.disabled = index === steps.length - 1;
      finish.disabled = !active;
      label.textContent = `${index} / ${steps.length - 1} · ${steps[index].title}`;
      [...ticks.children].forEach((tick, i) => {
        tick.setAttribute('aria-current', i === index ? 'step' : 'false');
        tick.classList.toggle('is-past', i < index);
      });
    }
    function go(target, run = false) {
      clearTimeout(timer); timer = null; playing = false;
      index = Math.max(0, Math.min(target, steps.length - 1));
      remaining = 3000;
      active = !steps[index].done;
      const revealed = new Set(steps.slice(0, index + 1).map(s => s.status).filter(Boolean));
      const overlaysOn = new Set(['service']);      // Austin Energy is on from the start
      steps.slice(0, index + 1).forEach(s => {
        if (s.overlay) overlaysOn.add(s.overlay);
        (s.show || []).forEach(k => overlaysOn.add(k));
        (s.hide || []).forEach(k => overlaysOn.delete(k));
      });
      inputs.forEach(el => {
        const checked = el.dataset.status ? revealed.has(el.dataset.status) : overlaysOn.has(el.dataset.overlay);
        setBox(el, checked);
        el.disabled = active;
      });
      card.hidden = !active || !(steps[index].status || steps[index].overlay || steps[index].text);
      body.replaceChildren(); body.scrollTop = 0;
      const step = steps[index];
      heading.textContent = step.title;
      if (step.status) {
        renderSites(step.status);
      } else if (step.overlay) body.textContent = words.cityText;
      else if (step.text) {
        const paragraph = document.createElement('p');
        paragraph.textContent = step.text; body.append(paragraph);
      }
      onStep(step);
      update();
      if (run && active) schedule();
    }
    const back = button(words.back, () => go(index - 1));
    const play = button(words.play, () => {
      if (!active || index === 0) go(1, autoplay.checked);
      else if (autoplay.checked) schedule();
      else go(index + 1);
    });
    const pauseButton = button(words.pause, pause);
    const next = button(words.next, () => go(index + 1));
    const finish = button(words.stop, () => go(steps.length - 1));
    const autoLabel = document.createElement('label');
    const autoplay = document.createElement('input');
    autoplay.type = 'checkbox'; autoplay.checked = true;
    autoplay.addEventListener('change', () => { if (!autoplay.checked) pause(); });
    autoLabel.append(autoplay, document.createTextNode(words.autoplay)); controls.append(autoLabel);
    steps.forEach((step, i) => {
      const tick = document.createElement('button');
      tick.type = 'button'; tick.title = step.title;
      tick.setAttribute('aria-label', `${i}: ${step.title}`);
      tick.textContent = String(i);
      tick.addEventListener('click', () => go(i));
      ticks.append(tick);
    });
    panel.append(controls, ticks, label); page.append(card, panel);
    page.classList.add('has-player');
    // Keep the ordinary map intact until the viewer starts or seeks the sequence.
    update();
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  }
};
