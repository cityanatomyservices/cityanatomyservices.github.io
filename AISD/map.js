// map.js — what is particular to the AISD school changes map. The engine is
// ../topicmap/app.js and ../topicmap/player.js (shared with every topic map
// since 2026-09-14); this file gives it the popup, the timeline steps and
// the per-step camera framing.
window.MAP_PAGE = {
  // the first column of the timeline's site list: the kind of school
  column(properties) {
    const types = window.MAP_COPY.popup.types;
    return types[properties.school_type] || window.MAP_COPY.player.unknownType;
  },

  // the popup for a campus: the facts and the source links from the research
  popupHtml(p, { CFG, COPY, esc, num, rowsHtml }) {
    const P = COPY.popup;
    let html = `<h3>${esc(p.name)}</h3>`;
    html += rowsHtml([
      [P.type, esc(P.types[p.school_type] || p.school_type)],
      [P.role, `<span class="swatch" style="display:inline-block;vertical-align:-2px;background:${CFG.categories[p.role] || CFG.categoryFallback}"></span> ${esc(COPY.category[p.role] || p.role)}`],
      [P.address, esc(p.address)],
      [P.year, esc(p.effective_school_year)],
      [P.enrollment, Number(p.enrollment_current) > 0 ? num(p.enrollment_current) : ''],
      [P.prior, esc(p.enrollment_prior)],
      [P.capacity, Number(p.capacity) > 0 ? num(p.capacity) : ''],
      [P.utilization, Number(p.percent_utilization) > 0 ? num(p.percent_utilization) + '%' : ''],
      [P.linked, esc(p.linked_campuses)],
      [P.future, esc(p.future_use)]
    ]);
    if (p.reason) html += `<p class="notes"><strong>${esc(P.reason)}.</strong> ${esc(p.reason)}</p>`;
    if (p.plan_history) html += `<p class="notes"><strong>${esc(P.history)}.</strong> ${esc(p.plan_history)}</p>`;
    if (p.community_response) html += `<p class="notes"><strong>${esc(P.community)}.</strong> ${esc(p.community_response)}</p>`;
    if (p.demographics_note) html += `<p class="notes"><strong>${esc(P.demographics)}.</strong> ${esc(p.demographics_note)}</p>`;
    if (p.sources) {
      const links = String(p.sources).split(' | ').filter(Boolean).map((u) => {
        let host = u; try { host = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { /* keep the raw text */ }
        return `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(host)}</a>`;
      });
      html += `<div class="sources"><strong>${esc(P.sources)}</strong>${links.join('')}</div>`;
    }
    return html;
  },

  // The sequence (owner 2026-09-14, "the formula"): the legend open over the
  // full map for a beat, then the campuses revealed role by role, then five
  // story cards: why the plan (zones on, Layers box flashes), where students
  // go (links on), a zoom to South Austin, what came off the list (zones and
  // links off again), and what happens to the buildings. The story cards
  // show only the closing and receiving schools (`only`); the "Taken off the
  // list" card adds the grey dots it talks about. The `cards` keys fold and
  // open the panels on a phone only; the desktop cut keeps both panels open
  // for the whole video (owner 2026-09-14). (step keys are explained at the
  // top of ../topicmap/player.js; `focus` and `camera` are this map's own
  // keys, read by frame() below)
  steps({ categories, COPY }) {
    const words = COPY.player;
    const storyRoles = ['closing', 'closing_and_receiving', 'receiving'];
    return [
      { title: words.ready },
      // the legend beat: 3 s here; the recording starts about a second after
      // load, so it reads as 2 s on the video (owner 2026-09-14)
      { title: COPY.legendTitle, only: categories, show: ['city'], cards: { legend: true }, hold: 3000 },
      ...categories.map((category, i) => ({ title: COPY.category[category], category,
        ...(i === 0 ? { only: [category], cards: { legend: false } } : {}) })),
      { title: words.why, only: storyRoles, show: ['zones'], cards: { layers: true }, cardsAfter: { delay: 2000, cards: { layers: false } }, text: words.whyText },
      { title: words.where, show: ['links'], text: words.whereText },
      { title: words.south, focus: 'south', text: words.southText },
      { title: words.removed, only: storyRoles.concat('removed_from_plan'), camera: 'overview', hide: ['zones', 'links'], text: words.removedText },
      { title: words.buildings, only: storyRoles, text: words.buildingsText },
      { title: words.done, done: true }
    ];
  },

  // ?play starts the sequence right after load: the legend step is the beat
  playDelay: 500,

  // The camera: re-frame the map at every step so the campuses stay clear of
  // whichever card is up. On phones the site list sits at the top during the
  // reveals and the text card at the bottom during the story, so the framing
  // swaps between the lower and the upper band of the screen; on a desktop
  // the list is top-right and the text card top-centre. A `focus` step fits
  // the campuses named in config.js instead of all of them.
  frame(step, map, { CFG, boundsOf, box, points, layout }) {
    const padding = (phase) => {                // phase: 'reveal' | 'text' | 'plain'
      const { narrow, wide, portrait } = layout();
      if (narrow) {
        if (phase === 'reveal') return { left: 20, right: 20, top: 400, bottom: 70 };
        if (phase === 'text') return { left: 20, right: 20, top: 175, bottom: 300 };
        return { left: 20, right: 20, top: 175, bottom: 80 };
      }
      if (portrait) return phase === 'text' ? { left: 40, right: 40, top: 420, bottom: 120 } : { left: 40, right: 40, top: 200, bottom: 100 };
      if (wide) {
        if (phase === 'reveal') return { left: 310, right: 380, top: 70, bottom: 70 };
        if (phase === 'text') return { left: 310, right: 40, top: 250, bottom: 70 };
        return { left: 310, right: 40, top: 70, bottom: 70 };
      }
      return { left: 20, right: 20, top: 220, bottom: 60 };
    };
    const names = step.focus && CFG.focus[step.focus];
    const picked = names ? { features: points.features.filter(f => names.includes(f.properties.name_short)) } : null;
    const phase = step.category ? 'reveal' : step.text ? 'text' : 'plain';
    map.fitBounds(picked && picked.features.length ? boundsOf(picked) : box,
      { padding: padding(phase), bearing: 0, pitch: 0, duration: 900 });
  }
};
