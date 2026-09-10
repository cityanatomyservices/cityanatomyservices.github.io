// home.js — the home page's chip row.
//
// Picking a chip shows that product's cards; picking a card loads its page in
// the map window above. Everything shown comes from home.json, so adding a
// product or a page is a data edit, not a code edit.
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

  function renderCards(chip) {
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
        if (index === 0) {
          card.classList.add('is-active');
          show(item.src);
        }
      }
      cardRow.appendChild(card);
    });
  }

  fetch('/home.json')
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      const chips = (data && data.chips) || [];
      if (!chips.length) return;
      const buttons = [];
      chips.forEach((chip, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sm-nav-btn';
        btn.textContent = chip.label;
        btn.addEventListener('click', () => {
          buttons.forEach(b => b.classList.toggle('is-active', b === btn));
          renderCards(chip);
          // A chip with its own src and no cards is a page in itself (News Feed).
          if (chip.src && !(chip.cards || []).length) show(chip.src);
        });
        chipRow.appendChild(btn);
        buttons.push(btn);
        if (index === 0) {
          btn.classList.add('is-active');
          renderCards(chip);
        }
      });
    })
    .catch(() => {
      // No data: the window still shows whatever src index.html set.
    });
}());
