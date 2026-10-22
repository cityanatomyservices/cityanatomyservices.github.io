// home.js — the home page's hamburger menu and the demo reel in the window.
//
// THE MENU REPLACED THE CARD ROW (owner, 2026-10-22: "more screen real
// estate"). Every app and report that used to be a card is now a menu item,
// grouped under a category heading inside Apps.
// Picking one loads it in the map window and closes the menu; the small ↗
// beside it opens the same page in a new tab instead. The list of apps comes
// from home.json and the list of reports from apps/reports/reports.json, so
// adding one is still a data edit, not a code edit.
//
// THE REEL: until the visitor picks something, the window cycles through the
// apps marked `demo` in home.json, each holding for `demoMs` (default 60 s).
(function () {
  const frame = document.getElementById('app-window');
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('site-menu');
  const appsGroups = document.getElementById('menu-apps');
  if (!frame || !toggle || !menu || !appsGroups) return;

  const DEMO_MS = 60000;

  function show(src) {
    // Only touch the iframe when the page actually changes, so a repeat pick
    // does not reload what is already playing.
    if (src && frame.getAttribute('src') !== src) frame.setAttribute('src', src);
  }

  // ── open / close the menu ────────────────────────────────────────────────
  function setOpen(open) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  toggle.addEventListener('click', () => setOpen(menu.hidden));
  // A click anywhere outside the menu, or Escape, closes it.
  document.addEventListener('click', (e) => {
    if (menu.hidden) return;
    if (menu.contains(e.target) || toggle.contains(e.target)) return;
    setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) setOpen(false);
  });

  // ── the demo reel ────────────────────────────────────────────────────────
  let reelTimer = null;
  function stopReel() {
    if (reelTimer) { clearTimeout(reelTimer); reelTimer = null; }
  }
  function startReel(apps) {
    stopReel();
    const reel = apps.filter((a) => a.demo && a.src);
    if (reel.length < 2) return;          // nothing to cycle between
    let k = 0;
    const wait = () => reel[k].demoMs || DEMO_MS;
    const step = () => {
      k = (k + 1) % reel.length;
      show(reel[k].src);
      reelTimer = setTimeout(step, wait());
    };
    reelTimer = setTimeout(step, wait());
  }

  // ── menu items ───────────────────────────────────────────────────────────
  // One list row: the name loads the page in the window, the ↗ opens a tab.
  function addItem(list, title, href) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = href;
    link.textContent = title;
    link.addEventListener('click', (e) => {
      e.preventDefault();               // stay on the home page
      stopReel();                       // the visitor has chosen; the reel stops
      show(href);
      setOpen(false);
    });
    const pop = document.createElement('a');
    pop.className = 'menu-pop';
    pop.href = href;
    pop.target = '_blank';
    pop.rel = 'noopener noreferrer';
    pop.title = 'Open in a new tab';
    pop.setAttribute('aria-label', title + ' (new tab)');
    pop.textContent = '↗';
    li.appendChild(link);
    li.appendChild(pop);
    list.appendChild(li);
  }

  // One category under Apps: a heading that opens to its list of apps.
  function addGroup(name) {
    const group = document.createElement('details');
    group.className = 'menu-group';
    group.open = true;
    const heading = document.createElement('summary');
    heading.textContent = name;
    const list = document.createElement('ul');
    list.className = 'menu-links';
    group.appendChild(heading);
    group.appendChild(list);
    appsGroups.appendChild(group);
    return list;
  }

  // The Apps section shows CATEGORIES, never bare links (owner, 2026-10-22).
  // Apps come from home.json, each with a `category`; every report from
  // apps/reports/reports.json goes under `reportsCategory` (Shopping Apps).
  // Categories appear in the order home.json lists them.
  Promise.all([
    fetch('/home.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch('/apps/reports/reports.json').then((r) => (r.ok ? r.json() : [])).catch(() => [])
  ]).then(([data, reports]) => {
    if (!data) return;                  // no data: the window keeps index.html's src
    const chip = (data.chips || []).find((c) => c.label === 'Apps');
    const apps = (chip && chip.cards) || [];
    const lists = new Map();
    (data.categories || []).forEach((name) => lists.set(name, addGroup(name)));
    const listFor = (name) => lists.get(name) || addGroup(name);   // unknown category: still shown
    apps.forEach((a) => addItem(listFor(a.category || 'Apps'), a.title, a.app || a.src));
    (reports || []).forEach((item) =>
      addItem(listFor(data.reportsCategory || 'Shopping Apps'), item.title, '/apps/reports/' + item.id + '/'));
    startReel(apps);
  });
}());
