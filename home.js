// home.js — the home page's chip row and card row.
//
// THE CARD ROW IS THE CONTROL FOR THE WINDOW (owner, 2026-09-10). Whichever
// card is snapped to the LEFT EDGE of the row is what plays in the window above
// it. Swipe the row (or two-finger scroll, or roll the wheel over it) and the
// window follows. Clicking a card still opens its real web app in a new browser
// window — a swipe is not a click, so the two never collide.
//
// A chip marked `cycle` advances the row on a timer so both demos get seen on
// their own; the moment a visitor moves the row themselves, that stops and the
// row is theirs. Everything shown comes from home.json, so adding a product is
// a data edit, not a code edit.
(function () {
  const frame = document.getElementById('app-window');
  const chipRow = document.getElementById('category-nav');
  const cardRow = document.getElementById('report-cards');
  const scroller = document.querySelector('.report-cards');   // the thing that scrolls
  if (!frame || !chipRow || !cardRow || !scroller) return;

  // How long a demo holds the window before the row advances by itself. A card
  // can override it with its own `demoMs` in home.json.
  const DEMO_MS = 60000;

  // The card data for the chip on screen, index-aligned with cardRow's children.
  let cards = [];

  function show(src) {
    // Only touch the iframe when the page actually changes, so scrolling past a
    // card and back does not restart the demo that is already running.
    if (src && frame.getAttribute('src') !== src) frame.setAttribute('src', src);
  }

  // ── which card is at the left edge ───────────────────────────────────────
  // Measured, not calculated: comparing each card's left edge against the
  // scroller's own left edge works whatever the padding, gap or card width is,
  // and keeps working when they change.
  function leftmostIndex() {
    const els = Array.from(cardRow.children);
    if (!els.length) return -1;
    const edge = scroller.getBoundingClientRect().left;
    let best = 0;
    let bestGap = Infinity;
    els.forEach((el, i) => {
      const gap = Math.abs(el.getBoundingClientRect().left - edge);
      if (gap < bestGap) { bestGap = gap; best = i; }
    });
    return best;
  }

  function syncWindowToRow() {
    const i = leftmostIndex();
    if (i < 0) return;
    Array.from(cardRow.children).forEach((el, n) => el.classList.toggle('is-active', n === i));
    if (cards[i]) show(cards[i].src);
  }

  function scrollToCard(i) {
    const el = cardRow.children[i];
    if (!el) return;
    const delta = el.getBoundingClientRect().left - scroller.getBoundingClientRect().left;
    scroller.scrollTo({ left: scroller.scrollLeft + delta, behavior: 'smooth' });
  }

  // Settle first, then act: a swipe fires dozens of scroll events, and swapping
  // the iframe on every one of them would reload the demo over and over.
  let settle = null;
  scroller.addEventListener('scroll', () => {
    clearTimeout(settle);
    settle = setTimeout(syncWindowToRow, 120);
  });

  // ── the demo reel ────────────────────────────────────────────────────────
  // It advances the ROW, not the window — so there is only ever one thing
  // deciding what plays, and the row never disagrees with the window.
  let reelTimer = null;
  function stopReel() {
    if (reelTimer) { clearTimeout(reelTimer); reelTimer = null; }
  }
  function startReel() {
    stopReel();
    const reel = cards.map((c, i) => ({ c, i })).filter(({ c }) => c.demo && c.src);
    if (reel.length < 2) return;          // nothing to cycle between
    let k = 0;
    const wait = () => reel[k].c.demoMs || DEMO_MS;
    const step = () => {
      k = (k + 1) % reel.length;
      scrollToCard(reel[k].i);
      reelTimer = setTimeout(step, wait());
    };
    reelTimer = setTimeout(step, wait());
  }

  // The moment the visitor moves the row themselves, the row is theirs.
  ['pointerdown', 'touchstart', 'keydown'].forEach((ev) =>
    scroller.addEventListener(ev, stopReel, { passive: true }));

  // The page never scrolls vertically, so a wheel over the row would otherwise
  // do nothing at all. Spend it sideways instead, so a plain mouse can move the
  // row the same way a finger can.
  scroller.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;   // already sideways
    stopReel();
    scroller.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });

  // ── rendering ────────────────────────────────────────────────────────────
  function renderCards(chip) {
    cards = chip.cards || [];
    cardRow.innerHTML = '';
    cards.forEach((item) => {
      // Where the card goes when clicked: its web app, else an explicit link.
      const href = item.app || item.link || '';
      const card = document.createElement(href ? 'a' : 'div');
      if (href) {
        card.href = href;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
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
      cardRow.appendChild(card);
    });
    scroller.scrollLeft = 0;      // a new chip always starts on its first card
    syncWindowToRow();
  }

  // A chip with `from` borrows its cards from the reports page's list
  // (apps/reports/reports.json) so the two stay identical. Each report card
  // plays its own map app in the window and opens the same app in a new window
  // when clicked (owner, 2026-09-10: the story maps are gone).
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
          src: '/apps/reports/' + item.id + '/',
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
      // The page opens on the chip marked `open` (Apps), else the first.
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
            if (chip.cycle) startReel();
            // A chip with its own src and no cards is a page in itself.
            else if (chip.src && !cards.length) show(chip.src);
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
