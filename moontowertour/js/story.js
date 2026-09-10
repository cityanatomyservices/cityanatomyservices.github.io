// The biography page for one tower: the app's stop screen, as an overlay
// over the map. Led by its corner name (how Austinites know towers), then
// the tower's name, erected date and the historian's full status text
// verbatim (it carries its own caveats), the story hook, a narration
// placeholder, what the tower lit in 1895 and what stands in its light now,
// the source line, and the footer (lit / striking / light, back to map).

import { COPY } from './copy.js';
import { esc } from '../../webtour/text.js';
import { isStanding } from './status.js';

// el: the #story element.
// handlers: { onBack(), onBackToMap(), onLight(tower) }
export function createStory(el, handlers) {
  let current = null;

  function render(tower, { lit, striking }) {
    const p = tower.properties;
    el.innerHTML = `
      <div class="story-head">
        <button class="back" type="button" aria-label="${esc(COPY.goBack)}">‹</button>
        <div class="story-kicker">${esc(COPY.stopKicker(p.order, p.leg))}</div>
      </div>
      <div class="story-content">
        <div>
          <h1 class="story-name">${esc(p.corner)}</h1>
          <div class="story-sub">${esc(p.tower_name)}</div>
          <div class="story-meta">${esc(COPY.erectedLine(p.erected))}</div>
          <div class="story-status">${esc(p.status)}</div>
        </div>
        ${isStanding(p.status) ? '' : `<div class="honest-box">${esc(COPY.notStandingStory)}</div>`}
        <p class="hook">${esc(p.title)}</p>
        <div class="audio"><span class="audio-glyph">▶</span><span class="placeholder">${esc(COPY.listen)}</span></div>
        <div><h2 class="section-heading">${esc(COPY.in1895)}</h2><p class="section-body">${esc(p.site_1895)}</p></div>
        <div><h2 class="section-heading">${esc(COPY.today)}</h2><p class="section-body">${esc(p.site_today)}</p></div>
        <p class="source-line">${esc(COPY.sourceLine(p))}</p>
        <div class="story-footer">
          ${lit
            ? `<div class="lit-tag centered">${esc(COPY.lit)}</div>`
            : striking
              ? `<div class="light striking">${esc(COPY.striking)}</div>`
              : `<button class="light" type="button">${esc(COPY.light)}</button>`}
          <button class="back-to-map" type="button">${esc(COPY.backToMap)}</button>
        </div>
      </div>
    `;
    el.querySelector('.back').addEventListener('click', handlers.onBack);
    el.querySelector('.back-to-map').addEventListener('click', handlers.onBackToMap);
    const light = el.querySelector('button.light');
    if (light) light.addEventListener('click', () => handlers.onLight(tower));
  }

  function renderNotFound() {
    el.innerHTML = `
      <div class="story-head"><button class="back" type="button" aria-label="${esc(COPY.goBack)}">‹</button></div>
      <div class="story-content not-found">
        <p class="placeholder">${esc(COPY.notFound)}</p>
        <button class="back-to-map" type="button">${esc(COPY.backToMap)}</button>
      </div>`;
    el.querySelector('.back').addEventListener('click', handlers.onBack);
    el.querySelector('.back-to-map').addEventListener('click', handlers.onBackToMap);
  }

  return {
    get open() { return !el.hidden; },
    get stopId() { return current ? current.properties.id : null; },
    show(tower, state) {
      current = tower || null;
      if (tower) render(tower, state);
      else renderNotFound();
      el.hidden = false;
      el.scrollTop = 0;
    },
    hide() {
      current = null;
      el.hidden = true;
      el.innerHTML = '';
    },
  };
}
