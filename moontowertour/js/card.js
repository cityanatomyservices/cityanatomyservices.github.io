// The tower card at the bottom of the map: the same card the app shows when
// a tower is tapped or its geofence fires. Plain DOM, no framework.
//
// Every word in it is either the owner's tower data (vendor/stops.js) or a
// label from copy.js.

import { COPY } from './copy.js';
import { esc } from '../../webtour/text.js';
import { isStanding, statusSummary } from './status.js';

// el: the #card element.
// handlers: { onClose(), onReadStory(tower), onLight(tower) }
export function createCard(el, handlers) {
  let current = null;

  function render(tower, { lit, striking }) {
    const p = tower.properties;
    el.innerHTML = `
      <div class="card-head">
        <div class="kicker">${esc(COPY.stopKicker(p.order, p.leg))}</div>
        <button class="close" type="button" aria-label="${esc(COPY.closeCard)}">✕</button>
      </div>
      <div class="card-body">
        <div class="name">${esc(p.tower_name)}</div>
        <div class="corner">${esc(p.corner)}</div>
        <div class="meta">${esc(COPY.erected(p.erected, statusSummary(p.status)))}</div>
        ${isStanding(p.status) ? '' : `<div class="honest">${esc(COPY.notStandingCard)}</div>`}
        <button class="read-story" type="button" aria-label="${esc(COPY.readStoryA11y(p.corner))}">${esc(COPY.readStory)}</button>
        ${lit
          ? `<div class="lit-tag">${esc(COPY.lit)}</div>`
          : striking
            ? `<div class="light striking">${esc(COPY.striking)}</div>`
            : `<button class="light" type="button">${esc(COPY.light)}</button>`}
      </div>
    `;
    el.querySelector('.close').addEventListener('click', handlers.onClose);
    el.querySelector('.read-story').addEventListener('click', () => handlers.onReadStory(tower));
    const light = el.querySelector('button.light');
    if (light) light.addEventListener('click', () => handlers.onLight(tower));
  }

  return {
    get stopId() { return current ? current.properties.id : null; },
    show(tower, state) {
      current = tower;
      render(tower, state);
      el.hidden = false;
    },
    hide() {
      current = null;
      el.hidden = true;
      el.innerHTML = '';
    },
  };
}
