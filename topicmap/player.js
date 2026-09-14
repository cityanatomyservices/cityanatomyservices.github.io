// topicmap/player.js — the timeline along the bottom of every topic map page.
//
// Shared by /datacenters/ and /AISD/ since 2026-09-14 (it was a copy in each
// folder before). It draws the controls, the tick marks, the countdown ring
// and the card that shows a site list or a story paragraph, and it walks the
// steps the page's own map.js hands it. Nothing in here knows what the map is
// about: the words come from copy.js, the steps from map.js.
//
// A step is a plain object. The keys the player understands:
//   title       the tick's name and the card heading
//   category    reveal this category: tick its legend box, list its points in the card
//   only        the categories shown from this step on (resets the cumulative reveal)
//   text        a story paragraph; the card sits centred (or bottom, on phones)
//   show/hide   overlay keys (config.js) to switch on or off from this step on
//   cards       { legend, layers } opens (true) or folds (false) a card from this step on
//   cardsAfter  { delay, cards } changes them again that many ms into the step
//               (cards and cardsAfter act on the phone layout only: on a
//               desktop both cards stay open through the whole sequence,
//               there is room for them beside the map; owner 2026-09-14)
//   hold        the step's length in ms when it should differ from 5 s / 15 s
//   done        the closing step: everything unlocked, nothing shown
// Any other key (camera, focus ...) is the page's own; it is passed back to
// map.js through onStep so the map can move.
window.MAP_PLAYER = {
  // init(points, options)
  //   points     the GeoJSON of the map's dots (for the site lists)
  //   options.copy        the page's copy.js object (player words, category names, intro)
  //   options.steps       the step list from map.js
  //   options.field       the property that holds a point's category ('status', 'role')
  //   options.column      (properties) => text for the first column of the site list
  //   options.setCard     (id, open) => folds or opens the Layers / legend cards
  //   options.layout      () => { narrow } from app.js; cards fold only when narrow
  //   options.onSelect    (feature) => called when a site list row is clicked
  //   options.onStep      (step) => called on every step change, for camera moves
  //   options.playDelay   ms after load before ?play starts the sequence (default 3000)
  //   options.intro       false to skip the intro card (a page that swaps timelines)
  // Returns { destroy } so a page can take the timeline down and build another.
  init(points, options) {
    const copy = options.copy;
    const words = copy.player;
    const steps = options.steps;
    const field = options.field;
    const column = options.column || (() => '');
    const setCard = options.setCard || (() => {});
    const layout = options.layout || (() => ({ narrow: true }));
    const onSelect = options.onSelect || (() => {});
    const onStep = options.onStep || (() => {});
    const page = document.querySelector('.page');
    const panel = document.createElement('section');
    panel.className = 'player';
    panel.setAttribute('aria-label', words.timeline);
    const controls = document.createElement('div');
    controls.className = 'player-controls';
    const button = (text, action) => {
      const el = document.createElement('button');
      const symbols = { [words.back]: '⏮', [words.play]: '▶', [words.pause]: '⏸', [words.next]: '⏭', [words.stop]: '⏹' };
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
    // drains over the length of each step and freezes on pause
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
    // autoplay timing (owner 2026-09-14): 5 s per reveal, 15 s per text card, unless the step says `hold`
    const stepMs = (step) => step.hold || (step.text ? 15000 : 5000);
    let stepLength = 5000, remaining = 5000, deadline = 0, cardsTimer = null;
    let sortField = 'name', sortDirection = 1;
    function renderList(category) {
      body.replaceChildren();
      const table = document.createElement('table');
      const head = document.createElement('thead');
      const headerRow = document.createElement('tr');
      for (const [f, text] of [['location', words.location], ['name', words.name]]) {
        const th = document.createElement('th'); th.scope = 'col';
        th.setAttribute('aria-sort', sortField === f ? (sortDirection === 1 ? 'ascending' : 'descending') : 'none');
        const sort = document.createElement('button'); sort.type = 'button';
        sort.textContent = text + (sortField === f ? (sortDirection === 1 ? ' ↑' : ' ↓') : '');
        sort.addEventListener('click', () => {
          pause();
          sortDirection = sortField === f ? -sortDirection : 1;
          sortField = f; renderList(category);
        });
        th.append(sort); headerRow.append(th);
      }
      head.append(headerRow);
      const rows = document.createElement('tbody');
      const value = f => sortField === 'name' ? String(f.properties.name || '') : column(f.properties);
      const matches = points.features.filter(f => f.properties[field] === category)
        .sort((a, b) => sortDirection * value(a).localeCompare(value(b), undefined, { numeric: true, sensitivity: 'base' }));
      matches.forEach(feature => {
        const row = document.createElement('tr'); row.tabIndex = 0;
        const name = document.createElement('td'); name.textContent = feature.properties.name || '';
        const location = document.createElement('td'); location.textContent = column(feature.properties);
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
    const inputs = [...document.querySelectorAll('[data-category], [data-overlay]')];
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
      // walk the steps so far: reveals add a category, `only` resets the set,
      // show/hide switch overlays, cards open or fold
      const revealed = new Set();
      const overlaysOn = new Set();                     // every overlay off until a step shows it
      const cards = { legend: true, layers: false };    // as the map loads: legend open, Layers folded
      steps.slice(0, index + 1).forEach((s, i) => {
        if (s.only) { revealed.clear(); s.only.forEach(c => revealed.add(c)); } else if (s.category) revealed.add(s.category);
        (s.show || []).forEach(k => overlaysOn.add(k));
        (s.hide || []).forEach(k => overlaysOn.delete(k));
        Object.assign(cards, s.cards || {});
        if (s.cardsAfter && i < index) Object.assign(cards, s.cardsAfter.cards);   // earlier steps' timed changes have happened
      });
      const applyCards = (c) => { setCard('legendTitle', c.legend); setCard('overlaysTitle', c.layers); };
      // phones fold the cards to make room; a desktop keeps both open throughout
      const narrow = layout().narrow;
      applyCards(narrow ? cards : { legend: true, layers: true });
      clearTimeout(cardsTimer);
      if (narrow && steps[index].cardsAfter) {
        cardsTimer = setTimeout(() => applyCards(Object.assign(cards, steps[index].cardsAfter.cards)), steps[index].cardsAfter.delay);
      }
      inputs.forEach(el => {
        const checked = el.dataset.category ? revealed.has(el.dataset.category) : overlaysOn.has(el.dataset.overlay);
        setBox(el, checked);
        el.disabled = active;
      });
      const step = steps[index];
      card.hidden = !active || !(step.category || step.text);
      card.classList.toggle('is-text', !step.category && !!step.text);   // text boxes sit centred; the site list stays right
      card.classList.toggle('is-list', !!step.category);                 // site lists show 4 rows, then scroll
      intro.remove();                                                    // any move on the timeline dismisses the intro
      body.replaceChildren(); body.scrollTop = 0;
      heading.textContent = step.title;
      if (step.category) {
        renderList(step.category);
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
    introNav.addEventListener('click', () => {      // keep the legend open, open Layers too
      intro.remove();
      setCard('legendTitle', true); setCard('overlaysTitle', true);
    });
    intro.append(introTitle, introText, introPlay, introNav);
    panel.append(controls, ticks, clock, label); page.append(card, panel);
    if (options.intro !== false) page.append(intro);
    page.classList.add('has-player');
    // Keep the ordinary map intact until the viewer starts or seeks the sequence.
    update();
    // ?play in the address starts the sequence by itself a moment after load,
    // for screen recordings where nobody clicks (2026-09-14).
    if (new URLSearchParams(location.search).has('play')) {
      intro.remove();                                 // the intro is for visitors, not recordings (owner 2026-09-14)
      setTimeout(() => go(1, true), options.playDelay ?? 3000);
    }
    const onHide = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', onHide);
    return {
      // take the timeline down: stop the clocks, remove its elements, unlock the checkboxes
      destroy() {
        clearTimeout(timer); clearTimeout(cardsTimer); cancelAnimationFrame(clockFrame); playing = false;
        document.removeEventListener('visibilitychange', onHide);
        card.remove(); panel.remove(); intro.remove();
        page.classList.remove('has-player');
        inputs.forEach(el => { el.disabled = false; });
      }
    };
  }
};
