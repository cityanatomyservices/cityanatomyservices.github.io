// A cumulative reveal. Add steps here as the recording sequence develops.
window.DC_PLAYER = {
  init(sites) {
    const copy = window.DC_COPY;
    const words = copy.player;
    const statuses = Object.keys(window.DC_CONFIG.status);
    const steps = [
      { title: words.ready },
      ...statuses.map(status => ({ title: copy.status[status], status })),
      { title: words.city, overlay: 'city' },
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
      inputs.forEach(el => {
        const checked = el.dataset.status ? revealed.has(el.dataset.status)
          : el.dataset.overlay === 'service' || steps.slice(0, index + 1).some(s => s.overlay === el.dataset.overlay);
        setBox(el, checked);
        el.disabled = active;
      });
      card.hidden = !active || index === 0;
      body.replaceChildren(); body.scrollTop = 0;
      const step = steps[index];
      heading.textContent = step.title;
      if (step.status) {
        const list = document.createElement('ul');
        const matches = sites.features.filter(f => f.properties.status === step.status)
          .sort((a, b) => Number(a.properties.id) - Number(b.properties.id));
        matches.forEach(({ properties: p }) => {
          const li = document.createElement('li');
          li.textContent = `${p.name || ''} \u2014 ${p.city || words.unknownCity}`;
          list.append(li);
        });
        if (matches.length) body.append(list); else body.textContent = words.empty;
      } else if (step.overlay) body.textContent = words.cityText;
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
