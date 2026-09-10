// The stop card at the bottom of the map: the same card the app shows when
// a stop is tapped or its geofence fires. Plain DOM, no framework.
//
// Every word in it is either the owner's stop data (vendor/stops.js) or a
// label from copy.js. The page link goes to the stop's own page on
// austin1885.city, which the owner edits freely - those URLs never change.

import { COPY } from './copy.js';
import { esc, formatDate } from '../../webtour/text.js';
import { stopDisplayName } from './names.js';

// el: the #card element.
// handlers: { onClose(), onReadStory(stop), onImHere(stop) }
export function createCard(el, handlers) {
  let current = null; // the stop shown, or null

  function render(stop, { visited, checkingIn }) {
    const p = stop.properties;
    const pageLabel = p.page_url ? p.page_url.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
    el.innerHTML = `
      <div class="card-head">
        <div class="kicker">${esc(COPY.stopKicker(p.order, p.title))}</div>
        <button class="close" type="button" aria-label="${esc(COPY.closeCard)}">✕</button>
      </div>
      <div class="card-body">
        <div class="name">${esc(stopDisplayName(p, COPY.memorialName))}${p.date ? `<span class="date"> · ${esc(formatDate(p.date))}</span>` : ''}</div>
        <div class="address">${esc(p.modern_address)}</div>
        ${p.page_url ? `<a class="page-pill" href="${esc(p.page_url)}" target="_blank" rel="noopener"><span>⌂</span><span class="page-label">${esc(pageLabel)}</span><span>→</span></a>` : ''}
        <button class="read-story" type="button">${esc(COPY.readStory)}</button>
        ${visited
          ? `<div class="visited-tag">${esc(COPY.visited)}</div>`
          : `<button class="im-here" type="button" ${checkingIn ? 'disabled' : ''} aria-label="${esc(COPY.imHere)}" title="${esc(COPY.imHereHint)}">${esc(checkingIn ? COPY.checkingIn : COPY.imHere)}</button>`}
      </div>
    `;
    el.querySelector('.close').addEventListener('click', handlers.onClose);
    el.querySelector('.read-story').addEventListener('click', () => handlers.onReadStory(stop));
    const imHere = el.querySelector('.im-here');
    if (imHere) imHere.addEventListener('click', () => handlers.onImHere(stop));
  }

  return {
    get stopId() { return current ? current.properties.id : null; },
    // Show a stop (or re-draw the one already open with fresh state).
    show(stop, state) {
      current = stop;
      render(stop, state);
      el.hidden = false;
    },
    hide() {
      current = null;
      el.hidden = true;
      el.innerHTML = '';
    },
  };
}
