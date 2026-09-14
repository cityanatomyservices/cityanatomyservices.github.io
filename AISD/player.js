// player.js — the timeline along the bottom of the AISD map. A copy of the
// data centers page's player (2026-09-14) with this map's steps: reveal the
// campuses role by role, then five story cards. Same controls, same 5 s /
// 15 s pacing, same intro card, same ?play switch.
window.AISD_PLAYER = {
  // the first column of the site list: the kind of school
  location(properties) {
    const types = window.AISD_COPY.popup.types;
    return types[properties.school_type] || window.AISD_COPY.player.unknownType;
  },
  init(sites, onSelect = () => {}, onStep = () => {}) {
    const copy = window.AISD_COPY;
    const words = copy.player;
    // roles in legend order, only those that occur in the data
    const statuses = Object.keys(window.AISD_CONFIG.role).filter(r => sites.features.some(f => f.properties.role === r));
    // The sequence (owner 2026-09-14, "the formula"): reveal the campuses by
    // role over the city limits, then five story cards: why the plan (zones
    // on, Layers box flashes), where students go (links on), a zoom to South
    // Austin, what came off the list (zones and links off again), and what
    // happens to the buildings. show / hide name overlays (config.js keys);
    // cards: { legend, layers } opens or folds a card from that step on;
    // cardsAfter changes them again after a delay; focus names a config.js
    // focus key the map zooms to.
    // `only` names the roles shown from that step on (the story cards show
    // just the closing and receiving schools, owner 2026-09-14); `hold` is a
    // step length in ms when it should differ from the 5 s / 15 s default.
    const storyRoles = ['closing', 'closing_and_receiving', 'receiving'];
    const steps = [
      { title: words.ready },
      // the legend, open over the full map, for a beat before the reveals start
      // (3 s here; the recording starts about a second after load, so it
      // reads as 2 s on the video — owner 2026-09-14)
      { title: copy.legendTitle, only: statuses, show: ['city'], cards: { legend: true }, hold: 3000 },
      ...statuses.map((status, i) => ({ title: copy.role[status], status,
        ...(i === 0 ? { only: [status], cards: { legend: false } } : {}) })),
      { title: words.why, only: storyRoles, show: ['zones'], cards: { layers: true }, cardsAfter: { delay: 2000, cards: { layers: false } }, text: words.whyText },
      { title: words.where, show: ['links'], text: words.whereText },
      { title: words.south, focus: 'south', text: words.southText },
      // this card is about the grey dots, so they show here as well
      { title: words.removed, only: storyRoles.concat('removed_from_plan'), camera: 'overview', hide: ['zones', 'links'], text: words.removedText },
      { title: words.buildings, only: storyRoles, text: words.buildingsText },
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
    // the countdown ring to the right of the ticks: a circle whose stroke
    // drains over the 10 s of each step and freezes on pause
    const clock = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    clock.setAttribute('class', 'player-clock'); clock.setAttribute('viewBox', '0 0 24 24'); clock.setAttribute('aria-hidden', 'true');
    const ring = (cls) => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('cx', 12); c.setAttribute('cy', 12); c.setAttribute('r', 9); c.setAttribute('class', cls); clock.append(c); return c; };
    ring('player-clock-track');
    const hand = ring('player-clock-left');
    const RING = 2 * Math.PI * 9;
    hand.style.strokeDasharray = String(RING);
    const drawClock = (fraction) => { hand.style.strokeDashoffset = String(RING * (1 - Math.max(0, Math.min(1, fraction)))); };
    let clockFrame = null;
    const runClock = () => {
      if (!playing) return;
      drawClock((deadline - performance.now()) / stepLength);
      clockFrame = requestAnimationFrame(runClock);
    };
    const label = document.createElement('span');
    label.className = 'player-step'; label.setAttribute('aria-live', 'polite');
    let index = 0, active = false, playing = false, timer = null;
    // autoplay timing (owner 2026-09-14): 5 s per data center reveal, 15 s per text card
    const stepMs = (step) => step.hold || (step.text ? 15000 : 5000);   // hold overrides the default length
    let stepLength = 5000, remaining = 5000, deadline = 0, cardsTimer = null;
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
      const value = f => sortField === 'name' ? String(f.properties.name || '') : window.AISD_PLAYER.location(f.properties);
      const matches = sites.features.filter(f => f.properties.role === status)
        .sort((a, b) => sortDirection * value(a).localeCompare(value(b), undefined, { numeric: true, sensitivity: 'base' }));
      matches.forEach(feature => {
        const row = document.createElement('tr'); row.tabIndex = 0;
        const name = document.createElement('td'); name.textContent = feature.properties.name || '';
        const location = document.createElement('td'); location.textContent = window.AISD_PLAYER.location(feature.properties);
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
      clearTimeout(timer); timer = null; playing = false;
      cancelAnimationFrame(clockFrame); drawClock(remaining / stepLength);
      update();
    }
    function schedule() {
      clearTimeout(timer);
      playing = true; deadline = performance.now() + remaining;
      timer = setTimeout(() => go(index + 1, true), remaining);
      cancelAnimationFrame(clockFrame); runClock();
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
      stepLength = remaining = stepMs(steps[index]);
      cancelAnimationFrame(clockFrame); drawClock(steps[index].done ? 0 : 1);
      active = !steps[index].done;
      const revealed = new Set();                   // roles shown: reveals add one each, `only` resets the set
      steps.slice(0, index + 1).forEach(s => { if (s.only) { revealed.clear(); s.only.forEach(r => revealed.add(r)); } else if (s.status) revealed.add(s.status); });
      const overlaysOn = new Set();                 // every overlay off until a step shows it
      const cards = { legend: true, layers: false };    // as the map loads: data centers open, Layers folded
      steps.slice(0, index + 1).forEach((s, i) => {
        (s.show || []).forEach(k => overlaysOn.add(k));
        (s.hide || []).forEach(k => overlaysOn.delete(k));
        Object.assign(cards, s.cards || {});
        if (s.cardsAfter && i < index) Object.assign(cards, s.cardsAfter.cards);   // earlier steps' timed changes have happened
      });
      const applyCards = (c) => {
        if (!window.AISD_SET_CARD) return;
        window.AISD_SET_CARD('legendTitle', c.legend);
        window.AISD_SET_CARD('overlaysTitle', c.layers);
      };
      applyCards(cards);
      clearTimeout(cardsTimer);
      if (steps[index].cardsAfter) {
        cardsTimer = setTimeout(() => applyCards(Object.assign(cards, steps[index].cardsAfter.cards)), steps[index].cardsAfter.delay);
      }
      inputs.forEach(el => {
        const checked = el.dataset.status ? revealed.has(el.dataset.status) : overlaysOn.has(el.dataset.overlay);
        setBox(el, checked);
        el.disabled = active;
      });
      card.hidden = !active || !(steps[index].status || steps[index].text);
      card.classList.toggle('is-text', !steps[index].status && !!steps[index].text);   // text boxes sit centred; the site list stays right
      card.classList.toggle('is-list', !!steps[index].status);                          // site lists show 4 rows, then scroll
      intro.remove();                                                                   // any move on the timeline dismisses the intro
      body.replaceChildren(); body.scrollTop = 0;
      const step = steps[index];
      heading.textContent = step.title;
      if (step.status) {
        renderSites(step.status);
      } else if (step.text) {
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
      tick.setAttribute('aria-label', `${i}: ${step.title}`);   // plain tick marks, no numbers (owner 2026-09-13)
      tick.addEventListener('click', () => go(i));
      ticks.append(tick);
    });
    // the intro card over the map: Play starts the sequence, Navigate Map opens
    // both panels for free exploration; either dismisses the card
    const intro = document.createElement('section');
    intro.className = 'intro'; intro.setAttribute('aria-label', copy.intro.title);
    const introTitle = document.createElement('h2'); introTitle.textContent = copy.intro.title;
    const introText = document.createElement('p'); introText.textContent = copy.intro.text;
    const introPlay = document.createElement('button'); introPlay.type = 'button'; introPlay.className = 'intro-play'; introPlay.textContent = copy.intro.play;
    const introNav = document.createElement('button'); introNav.type = 'button'; introNav.className = 'intro-nav'; introNav.textContent = copy.intro.navigate;
    introPlay.addEventListener('click', () => { intro.remove(); go(1, autoplay.checked); });
    introNav.addEventListener('click', () => {      // keep the data centers card open, open Layers too
      intro.remove();
      if (window.AISD_SET_CARD) { window.AISD_SET_CARD('legendTitle', true); window.AISD_SET_CARD('overlaysTitle', true); }
    });
    intro.append(introTitle, introText, introPlay, introNav);
    panel.append(controls, ticks, clock, label); page.append(card, panel, intro);
    page.classList.add('has-player');
    // Keep the ordinary map intact until the viewer starts or seeks the sequence.
    update();
    // ?play in the address starts the sequence by itself a few seconds after
    // load, for screen recordings where nobody clicks (2026-09-14).
    if (new URLSearchParams(location.search).has('play')) {
      intro.remove();                                 // the intro is for visitors, not recordings (owner 2026-09-14)
      setTimeout(() => go(1, true), 500);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  }
};
