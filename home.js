// home.js — the home page's chip row.
//
// Picking a chip shows that product's cards. A card OPENS ITS WEB APP in a new
// browser window (owner, 2026-09-10) — it no longer swaps the preview in the
// map window. The window instead plays a demo reel: a chip marked `cycle` runs
// through its `demo` cards on a timer, so both animations get seen without
// anyone clicking. Everything shown comes from home.json, so adding a product
// or a page is a data edit, not a code edit.
(function () {
  const frame = document.getElementById('storymap-frame');
  const chipRow = document.getElementById('category-nav');
  const cardRow = document.getElementById('report-cards');
  if (!frame || !chipRow || !cardRow) return;

  // How long each demo holds the window before the reel moves on. A card can
  // override it with its own `demoMs` in home.json.
  const DEMO_MS = 60000;

  function show(src) {
    // Only touch the iframe when the page actually changes, so a re-pick does
    // not restart the demo that is already running.
    if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
  }

  // The demo reel. One timer, always cleared before a new one starts, so a
  // visitor hopping between chips can never leave two reels running.
  let reelTimer = null;
  function stopReel() {
    if (reelTimer) { clearTimeout(reelTimer); reelTimer = null; }
  }
  function startReel(cards) {
    stopReel();
    const reel = (cards || []).filter(c => c.demo && c.src);
    if (!reel.length) return;
    let i = 0;
    const step = () => {
      const card = reel[i];
      show(card.src);
      i = (i + 1) % reel.length;
      reelTimer = setTimeout(step, card.demoMs || DEMO_MS);
    };
    step();
  }

  function renderCards(chip) {
    cardRow.innerHTML = '';
    (chip.cards || []).forEach((item) => {
      // Where the card goes: its web app, else an explicit external link. A
      // card with neither is the old kind and still previews in the window.
      const href = item.app || item.link || '';
      const card = document.createElement(href ? 'a' : 'button');
      if (href) {
        card.href = href;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
      } else {
        card.type = 'button';
      }
      card.className = 'report-card';
      if (item.accent) card.style.setProperty('--card-accent', item.accent);

      if (item.eyebrow) {
        const eyebrow = document.createElement('span');
        eyebrow.className = 'report-card-eyebrow';
        eyebrow.textContent = item.eyebrow;
        card.appendChild(eyebrow);
      }
      const title = document.createElement('h3');
      title.className = 'report-card-title';
      title.textContent = item.title || '';
      card.appendChild(title);
      if (item.blurb) {
        const blurb = document.createElement('p');
        blurb.className = 'report-card-blurb';
        blurb.textContent = item.blurb;
        card.appendChild(blurb);
      }

      if (!href) {
        card.addEventListener('click', () => {
          cardRow.querySelectorAll('.report-card').forEach(el => el.classList.remove('is-active'));
          card.classList.add('is-active');
          stopReel();          // a hand-picked preview outranks the reel
          show(item.src);
        });
      }

      cardRow.appendChild(card);
    });
  }

  // A chip with `from` borrows its cards from the reports page's list
  // (apps/reports/reports.json) so the two stay identical. Each report card
  // opens that report's own MapLibre map app at /apps/reports/<id>/.
  const loaded = new Map();
  function withCards(chip) {
    if (!chip.from) return Promise.resolve(chip);
    if (loaded.has(chip.from)) return loaded.get(chip.from);
    const p = fetch(chip.from)
      .then(r => (r.ok ? r.json() : []))
      .then(items => ({
        ...chip,
        cards: (items || []).map(item => ({
          eyebrow: item.eyebrow || item.category || '',
          title: item.title || '',
          blurb: item.blurb || '',
          accent: item.accent,
          src: '/apps/reports/' + item.id + '/storymap/',
          app: '/apps/reports/' + item.id + '/'
        }))
      }))
      .catch(() => ({ ...chip, cards: [] }));
    loaded.set(chip.from, p);
    return p;
  }

  fetch('/home.json')
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      const chips = (data && data.chips) || [];
      if (!chips.length) return;
      // The page opens on the chip marked `open` (Apps, so the demo reel starts), else the first.
      const openIndex = Math.max(0, chips.findIndex(chip => chip.open));
      const buttons = [];
      chips.forEach((chip, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sm-nav-btn';
        btn.textContent = chip.label;
        const pick = () => {
          buttons.forEach(b => b.classList.toggle('is-active', b === btn));
          stopReel();
          withCards(chip).then(c => {
            renderCards(c);
            // `cycle` chips play their demos in turn; a chip with its own src
            // and no cards is a page in itself loaded into the window.
            if (chip.cycle) startReel(c.cards);
            else if (chip.src && !(c.cards || []).length) show(chip.src);
          });
        };
        btn.addEventListener('click', pick);
        chipRow.appendChild(btn);
        buttons.push(btn);
        if (index === openIndex) pick();
      });
    })
    .catch(() => {
      // No data: the window still shows whatever src index.html set.
    });
}());
