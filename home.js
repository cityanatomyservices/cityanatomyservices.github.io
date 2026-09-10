// home.js — the home page's chip row.
//
// Picking a chip shows that product's cards; picking a card loads its
// PREVIEW in the map window above. A card with an `app` also gets a small ↗
// that opens the full-screen web app in a new browser window — the apps are
// never used inside the front page (owner, 2026-09-10). Everything shown
// comes from home.json, so adding a product or a page is a data edit, not a
// code edit.
(function () {
  const frame = document.getElementById('storymap-frame');
  const chipRow = document.getElementById('category-nav');
  const cardRow = document.getElementById('report-cards');
  if (!frame || !chipRow || !cardRow) return;

  function show(src) {
    // Only touch the iframe when the page actually changes, so a re-click
    // does not restart the Moontower tour.
    if (frame.getAttribute('src') !== src) frame.setAttribute('src', src);
  }

  function renderCards(chip, { activateFirst }) {
    cardRow.innerHTML = '';
    (chip.cards || []).forEach((item, index) => {
      const isLink = !!item.link;
      const card = document.createElement(isLink ? 'a' : 'button');
      if (isLink) {
        card.href = item.link;
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

      if (!isLink) {
        card.addEventListener('click', () => {
          cardRow.querySelectorAll('.report-card').forEach(el => el.classList.remove('is-active'));
          card.classList.add('is-active');
          show(item.src);
        });
        // The first card of a chip is what the window shows for that chip.
        if (index === 0 && activateFirst) {
          card.classList.add('is-active');
          show(item.src);
        }
      }

      // The ↗ opens the real app, full screen, in its own window. It sits in
      // a wrapper beside the card because a link cannot live inside a button.
      if (item.app) {
        const wrap = document.createElement('div');
        wrap.className = 'report-card-wrap';
        const open = document.createElement('a');
        open.className = 'report-card-open';
        open.href = item.app;
        open.target = '_blank';
        open.rel = 'noopener noreferrer';
        open.textContent = '↗';
        open.setAttribute('aria-label', item.title || item.app);
        open.title = item.app;
        wrap.appendChild(card);
        wrap.appendChild(open);
        cardRow.appendChild(wrap);
      } else {
        cardRow.appendChild(card);
      }
    });
  }

  // A chip with `from` borrows its cards from the reports page's list
  // (apps/reports/reports.json) so the two stay identical. Each report card
  // previews its story map in the window; its ↗ opens the report's own
  // MapLibre map app (/apps/reports/<id>/) in a new window.
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
      // The page opens on the chip marked `open` (the News Feed map), else the first.
      const openIndex = Math.max(0, chips.findIndex(chip => chip.open));
      const buttons = [];
      chips.forEach((chip, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sm-nav-btn';
        btn.textContent = chip.label;
        const pick = () => {
          buttons.forEach(b => b.classList.toggle('is-active', b === btn));
          withCards(chip).then(c => renderCards(c, { activateFirst: true }));
          // A chip with its own src and no cards is a page in itself (News Feed).
          if (chip.src && !(chip.cards || []).length) show(chip.src);
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
