// The full-story page for one stop: the app's stop screen, as an overlay
// over the map. The victim led with as a person (name, date), the page link,
// an optional advisory, the historian's story sections, clearly-labelled
// lore notes, the site today, survivors, then the footer (visited / I'm
// here, next stop, back to map).
//
// Content comes from vendor/stops-content.js (the historian's file). A stop
// with no entry yet still renders, with "Full story coming soon." where the
// sections would go. Lore is NEVER shown unlabelled: a lore-flagged section
// is drawn exactly like a lore note.

import { COPY } from './copy.js';
import { esc, formatDate } from '../../webtour/text.js';

// el: the #story element.
// handlers: { onBack(), onBackToMap(), onNext(stop), onImHere(stop) }
export function createStory(el, handlers) {
  let current = null;

  function loreBlock(title, text) {
    return `
      <div class="lore">
        <div class="lore-head"><span class="lore-chip">${esc(COPY.lore)}</span><span class="lore-title">${esc(title)}</span></div>
        <p class="lore-body">${esc(text)}</p>
      </div>`;
  }

  function render(stop, { content, nextStop, visited }) {
    const p = stop.properties;
    const sections = (content && content.sections) || [];
    const loreNotes = (content && content.loreNotes) || [];
    // The historian's content owns survivors and the site today once it
    // exists; until then the same fields on the stop itself are used.
    const survivors = content ? (content.survivors || []) : (p.survivors || []);
    const siteToday = (content ? content.siteToday : p.site_today) || '';
    const pageLabel = p.page_url ? p.page_url.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';

    el.innerHTML = `
      <div class="story-head">
        <button class="back" type="button" aria-label="${esc(COPY.goBack)}">‹</button>
        <div class="story-kicker">${esc(COPY.stopKicker(p.order, p.title))}</div>
      </div>
      <div class="story-content">
        <div>
          <h1 class="story-name">${esc(p.victim || p.title)}</h1>
          ${p.date ? `<div class="story-date">${esc(formatDate(p.date))}</div>` : ''}
          ${p.page_url ? `<a class="page-pill" href="${esc(p.page_url)}" target="_blank" rel="noopener"><span>⌂</span><span class="page-label">${esc(pageLabel)}</span><span>→</span></a>` : ''}
        </div>
        ${content && content.advisory ? `<div class="advisory">${esc(content.advisory)}</div>` : ''}
        ${sections.length === 0
          ? `<p class="coming-soon">${esc(COPY.comingSoon)}</p>`
          : sections.map((s) => s.lore
              ? loreBlock(s.heading || COPY.lore, s.text)
              : `<div>${s.heading ? `<h2 class="section-heading">${esc(s.heading)}</h2>` : ''}<p class="section-body">${esc(s.text)}</p></div>`
            ).join('')}
        ${loreNotes.map((n) => loreBlock(n.title, n.text)).join('')}
        ${siteToday ? `<div><h2 class="section-heading">${esc(COPY.siteToday)}</h2><p class="site-today">${esc(siteToday)}</p></div>` : ''}
        ${survivors.length ? `<p class="survivors">${esc(COPY.survived)}${esc(survivors.join(', '))}</p>` : ''}
        <div class="story-footer">
          ${visited
            ? `<div class="visited-tag centered">${esc(COPY.visited)}</div>`
            : `<button class="im-here" type="button">${esc(COPY.imHere)}</button>`}
          ${nextStop ? `<button class="next-stop" type="button">${esc(COPY.nextStop(nextStop.properties.victim || nextStop.properties.title))}</button>` : ''}
          <button class="back-to-map" type="button">${esc(COPY.backToMap)}</button>
        </div>
      </div>
    `;
    el.querySelector('.back').addEventListener('click', handlers.onBack);
    el.querySelector('.back-to-map').addEventListener('click', handlers.onBackToMap);
    const next = el.querySelector('.next-stop');
    if (next) next.addEventListener('click', () => handlers.onNext(nextStop));
    const imHere = el.querySelector('.im-here');
    if (imHere) imHere.addEventListener('click', () => handlers.onImHere(stop));
  }

  function renderNotFound() {
    el.innerHTML = `
      <div class="story-head"><button class="back" type="button" aria-label="${esc(COPY.goBack)}">‹</button></div>
      <div class="story-content not-found">
        <p class="coming-soon">${esc(COPY.notFound)}</p>
        <button class="back-to-map" type="button">${esc(COPY.backToMap)}</button>
      </div>`;
    el.querySelector('.back').addEventListener('click', handlers.onBack);
    el.querySelector('.back-to-map').addEventListener('click', handlers.onBackToMap);
  }

  return {
    get open() { return !el.hidden; },
    get stopId() { return current ? current.properties.id : null; },
    show(stop, state) {
      current = stop || null;
      if (stop) render(stop, state);
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
