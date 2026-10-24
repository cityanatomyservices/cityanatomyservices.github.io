// shopmap/play.js — the story mode of a shopping app, for the videos
// (owner 2026-10-24: a one-minute informational video per app — how many
// places, the types, the ones people talk about — made the same way for
// every app and automated).
//
// Two address switches, both only for recording; a visitor never sees them:
//   ?phone   lays the page out 393 CSS px wide, whatever the window, so a
//            1080x1920 OBS browser source records the phone view (the same
//            trick as topicmap/phone.js).
//   ?play    walks through the beats in the app's story.js (written by
//            tools/make-story.py from the data, never by hand) with a card
//            at the bottom of the map: the count, a breakdown with bars,
//            the most-talked-about places, an end card. The side panel and
//            the buttons are hidden while it plays. A white curtain covers
//            the page until the first beat so the recording has a clean,
//            findable start (tools/story-composite.sh trims to it).
// Load this BEFORE app.js (the zoom must be set before the map measures its
// box); app.js announces itself with the `shopmap:ready` event.
window.PHONE_SCALE = (function () {
  const query = new URLSearchParams(location.search);
  const width = query.has('phone') ? 393 : Number(query.get('width')) || 0;
  if (!width) return 1;
  const scale = window.innerWidth / width;
  document.documentElement.style.zoom = scale;
  // vh and % heights ignore zoom: give the root its box by hand
  document.documentElement.style.width = width + 'px';
  document.documentElement.style.height = Math.round(window.innerHeight / scale) + 'px';
  return scale;
})();

(function () {
  if (!new URLSearchParams(location.search).has('play')) return;
  const story = window.SHOP_STORY;
  if (!story || !story.beats || !story.beats.length) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GREY = '#b8c0c8';          // pins outside the beat's breakdown

  const curtain = document.createElement('div');
  curtain.className = 'story-curtain';
  document.body.appendChild(curtain);

  document.addEventListener('shopmap:ready', (e) => start(e.detail), { once: true });

  function start(app) {
    const { map, features, name, box, colorOf, categoryField, setPanel } = app;
    const page = document.querySelector('.shopmap');
    page.classList.add('playing');
    setPanel(false);
    const card = document.createElement('section');
    card.className = 'story-card';
    page.appendChild(card);

    const boundsOf = (list) => {
      const b = [[Infinity, Infinity], [-Infinity, -Infinity]];
      list.forEach((f) => {
        const [x, y] = f.geometry.coordinates;
        b[0][0] = Math.min(b[0][0], x); b[0][1] = Math.min(b[0][1], y);
        b[1][0] = Math.max(b[1][0], x); b[1][1] = Math.max(b[1][1], y);
      });
      return b;
    };
    // fit the pins into the map above the card, flat
    const fit = (bounds) => {
      const pad = { top: 24, right: 24, left: 24, bottom: card.offsetHeight + 24 };
      map.fitBounds(bounds, { padding: pad, pitch: 0, bearing: 0, duration: 1200, maxZoom: 15 });
    };
    const showAll = () => { map.setFilter('places', null); map.setFilter('place-labels', null); };
    const colorDefault = () => map.setPaintProperty('places', 'circle-color', ['get', '_color']);
    const colorBy = (property, rows) => {
      const pairs = [];
      rows.forEach((r) => pairs.push(r.value, r.color));
      map.setPaintProperty('places', 'circle-color', ['match', ['get', property], ...pairs, GREY]);
    };

    // the card for each kind of beat
    const bar = (n, max) => `<i class="story-bar" style="width:${Math.round(100 * n / max)}%"></i>`;
    const html = {
      all: (b) => `<div class="story-big">${esc(b.count)}</div><div class="story-label">${esc(b.label)}</div>`,
      breakdown: (b) => {
        const max = Math.max(...b.rows.map((r) => r.count));
        return `<h3>${esc(b.title)}</h3>` + b.rows.map((r) =>
          `<div class="story-row"><span class="swatch" style="background:${r.color}"></span><span class="story-name">${esc(r.value)}</span><span class="story-n">${r.count}</span>${bar(r.count, max)}</div>`).join('') +
          (b.note ? `<div class="story-note">${esc(b.note)}</div>` : '');
      },
      top: (b) => `<h3>${esc(b.title)}</h3>` + b.rows.map((r) =>
        `<div class="story-row"><span class="story-name">${esc(r.name)}</span><span class="story-detail">${esc(r.detail)}</span></div>`).join('') +
        (b.note ? `<div class="story-note">${esc(b.note)}</div>` : ''),
      end: (b) => b.lines.map((l, i) => `<div class="story-end-line${i === b.lines.length - 1 ? ' is-accent' : ''}">${esc(l)}</div>`).join('')
    };

    function show(b) {
      card.className = 'story-card story-' + b.type;
      card.innerHTML = html[b.type](b);
      map.setLayerZoomRange('place-labels', b.type === 'top' ? 0 : 12, 24);
      if (b.type === 'all') { showAll(); colorDefault(); fit(box); }
      if (b.type === 'breakdown') {
        // the app's own colours when the beat is on the property that colours the pins
        if (b.property === categoryField) b.rows.forEach((r) => { if (colorOf[r.value]) r.color = colorOf[r.value]; });
        card.innerHTML = html.breakdown(b);
        showAll(); colorBy(b.property, b.rows); fit(box);
      }
      if (b.type === 'top') {
        const chosen = features.filter((f) => b.names.includes(name(f)));
        const ids = chosen.map((f) => f.id);
        map.setFilter('places', ['in', ['id'], ['literal', ids]]);
        map.setFilter('place-labels', ['in', ['id'], ['literal', ids]]);
        colorDefault();
        fit(chosen.length ? boundsOf(chosen) : box);
      }
      if (b.type === 'end') { showAll(); colorDefault(); }
    }

    // the sequence: one beat after another, each held its `hold` seconds;
    // the last one stays up so the recording can run long and be trimmed
    let i = 0;
    const next = () => {
      const b = story.beats[i];
      if (!b) return;
      show(b);
      console.log('story beat', i + 1, b.type, 'hold', b.hold);
      i += 1;
      if (story.beats[i]) setTimeout(next, b.hold * 1000);
    };
    // wait for the tiles, then a moment, then drop the curtain on beat one
    map.once('idle', () => setTimeout(() => { curtain.remove(); next(); }, story.playDelay || 1500));
  }
}());
