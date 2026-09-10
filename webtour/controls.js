// The small pieces of chrome around the map that every tour web app shares:
// the message banner, the credits drawer, the stop picker under the progress
// chip, and a tap-or-hold helper for pills. Each is a tiny factory over an
// element that already exists in the app's index.html.

import { esc } from './text.js';

// Dismissible message strip for permission and GPS failures.
export function createBanner(el) {
  const text = el.querySelector('.banner-text');
  el.querySelector('.banner-close').addEventListener('click', () => { el.hidden = true; });
  return {
    show(message) { text.textContent = message; el.hidden = false; },
    hide() { el.hidden = true; },
  };
}

// The credits panel that slides in from the right. Replaces MapLibre's own
// attribution popup; the legal requirement is met by crediting every data
// and software source here.
export function createDrawer(panel, backdrop, credits) {
  const list = panel.querySelector('.drawer-rows');
  list.innerHTML = credits.map((c) => `
    <a class="drawer-row" href="${esc(c.url)}" target="_blank" rel="noopener" aria-label="${esc(c.label + ', ' + c.detail + '. Opens in browser')}">
      <span class="drawer-label">${esc(c.label)}</span>
      <span class="drawer-detail">${esc(c.detail)}</span>
    </a>`).join('');
  const close = () => { panel.classList.remove('open'); backdrop.hidden = true; };
  panel.querySelector('.drawer-close').addEventListener('click', close);
  backdrop.addEventListener('click', close);
  return {
    open() { backdrop.hidden = false; panel.classList.add('open'); },
    close,
  };
}

// The stop list under the progress chip. The app supplies the rows as HTML
// (each row is a `.picker-row` element carrying `data-id`); tapping one
// calls onPick with that stop.
export function createPicker(el, stops, { rows, onPick }) {
  el.addEventListener('click', (e) => {
    const row = e.target.closest('.picker-row');
    if (!row) return;
    const stop = stops.find((s) => s.properties.id === row.dataset.id);
    if (stop) onPick(stop);
  });
  return {
    get open() { return !el.hidden; },
    show() { el.innerHTML = rows(); el.hidden = false; },
    hide() { el.hidden = true; },
  };
}

// Tap vs. hold on one element. A hold (600 ms) calls onHold and swallows the
// click that would otherwise follow when the finger lifts.
export function tapOrHold(el, { onTap, onHold }) {
  let timer = null;
  let held = false;
  const cancel = () => { if (timer) clearTimeout(timer); timer = null; };
  el.addEventListener('pointerdown', () => {
    held = false;
    cancel();
    timer = setTimeout(() => { held = true; onHold(); }, 600);
  });
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointerleave', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('click', () => { if (!held) onTap(); });
  // No context menu on a long press on phones.
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
