/**
 * The story card. Plain DOM, no framework.
 *
 * EVERY WORD SHOWN HERE COMES FROM THE STOP DATA, which is the owner's writing
 * (data/locations.js, generated from the tower dossier). This file adds no
 * sentences of its own — only the small field labels marked below, which the
 * owner can change in one place.
 *
 * The .media slot is intentionally left empty: there is no per-tower imagery
 * yet. When images or clips exist, fill that slot and nothing else changes.
 */
export function createCard(el) {
  let currentId = null;

  return {
    show(feature) {
      const p = feature.properties;
      if (p.id === currentId) return;
      currentId = p.id;

      // Media slot — empty until per-tower imagery exists. Wired now so adding
      // it later is a one-line change, not a rebuild.
      const media = p.images && p.images.length
        ? `<img class="media" src="${p.images[0]}" alt="">`
        : '';

      el.innerHTML = `
        ${media}
        <div class="eyebrow">${esc(p.leg)} &middot; ${esc(p.tower_name)}</div>
        <h2>${esc(p.title)}</h2>
        <div class="corner">${esc(p.corner)}</div>
        <div class="body">
          ${p.erected ? `<p class="dim"><span class="label">Erected</span> ${esc(p.erected)}</p>` : ''}
          ${p.site_1895 ? `<p><span class="label">1895</span> ${esc(p.site_1895)}</p>` : ''}
          ${p.site_today ? `<p><span class="label">Today</span> ${esc(p.site_today)}</p>` : ''}
        </div>
      `;
      // DEMO PAGE (owner, 2026-09-10): nothing here is clickable, so there is
      // no "read more" fold to unfold — the card simply opens fully and shows
      // everything the tower has. The fold still lives in the web app at
      // /moontowertour/, which is the interactive one.
      el.classList.add('open');
      el.classList.add('visible');
    },
    hide() {
      currentId = null;
      el.classList.remove('visible');
    },
  };
}

// The stop text is prose, not markup — escape it so an ampersand or angle
// bracket in the owner's writing can never break the page.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}
