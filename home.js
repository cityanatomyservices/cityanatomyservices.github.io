// home.js — the home page's map window: what plays in it, and the demo reel.
// The header, menu and footer come from shell.js, shared by every page.
//
// THE WINDOW FOLLOWS THE ADDRESS. "https://austin.chat/#/budget/" opens the
// Budget Map in the window; the part after "#" is the path to load. Menu
// items are links of exactly that shape (shell.js), so picking one just
// changes the hash, and the browser's back button steps back through picks.
// Anyone can copy the address bar to share what they are looking at.
//
// THE REEL: with no hash, the window cycles through the apps marked `demo`
// in home.json, each holding for `demoMs` (default 60 s), until a pick.
(function () {
  const frame = document.getElementById('app-window');
  if (!frame) return;

  const DEMO_MS = 60000;

  // What the window is showing now. Tracked here because the window is moved
  // with location.replace (below), which leaves the src attribute untouched.
  let current = frame.getAttribute('src');

  function show(src) {
    // Only touch the iframe when the page actually changes, so a repeat pick
    // does not reload what is already playing.
    if (!src || src === current) return;
    current = src;
    // location.replace, not a new src: setting src adds a browser history
    // entry for the window, so the back button would step through every reel
    // change and pick instead of leaving the page. replace adds none.
    try { frame.contentWindow.location.replace(src); }
    catch (err) { frame.setAttribute('src', src); }
  }

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

  // ── the address decides what plays ───────────────────────────────────────
  // Only a path that starts with "/" is accepted, so the hash can never point
  // the window at another site.
  function pathFromHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    return h.startsWith('/') ? h : '';
  }
  function followHash() {
    const path = pathFromHash();
    if (!path) return false;
    stopReel();                           // the visitor has chosen; the reel stops
    show(path);
    return true;
  }
  window.addEventListener('hashchange', () => {
    followHash();
    if (window.siteShell) window.siteShell.closeMenu();
  });

  // A menu pick on THIS page is just a hash change: no navigation, no reload.
  // (On every other page the same link is a normal link to the home page.)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('#site-menu .menu-links a');
    if (!link || link.classList.contains('menu-pop')) return;
    const hash = link.getAttribute('href').replace(/^\//, '');   // "#/budget/"
    if (!hash.startsWith('#')) return;
    e.preventDefault();
    if (location.hash === hash) {         // same pick again: nothing to change
      if (window.siteShell) window.siteShell.closeMenu();
      return;
    }
    location.hash = hash;
  });

  // Opening with a hash shows that app at once; otherwise the reel runs.
  if (!followHash()) {
    fetch('/home.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const chip = ((data && data.chips) || []).find((c) => c.label === 'Apps');
        if (!pathFromHash()) startReel((chip && chip.cards) || []);
      })
      .catch(() => {
        // No data: the window still shows whatever src index.html set.
      });
  }
}());
