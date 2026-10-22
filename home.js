// home.js — the home page's map window and its demo reel. The header, menu
// and footer come from shell.js, shared by every page.
//
// THE REEL: the window cycles through the apps marked `demo` in home.json,
// each holding for `demoMs` (default 60 s). The demos are animations only;
// to use an app, a visitor picks it from the menu, which goes to that app's
// own framed page at /view/<slug>/ (view.js).
(function () {
  const frame = document.getElementById('app-window');
  if (!frame) return;

  const DEMO_MS = 60000;

  // What the window is showing now. Tracked here because the window is moved
  // with location.replace (below), which leaves the src attribute untouched.
  let current = frame.getAttribute('src');

  function show(src) {
    if (!src || src === current) return;
    current = src;
    // location.replace, not a new src: setting src adds a browser history
    // entry for the window, so the back button would step through every reel
    // change instead of leaving the page. replace adds none.
    try { frame.contentWindow.location.replace(src); }
    catch (err) { frame.setAttribute('src', src); }
  }

  fetch('/home.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const chip = ((data && data.chips) || []).find((c) => c.label === 'Apps');
      const reel = ((chip && chip.cards) || []).filter((a) => a.demo && a.src);
      if (reel.length < 2) return;        // nothing to cycle between
      let k = 0;
      const wait = () => reel[k].demoMs || DEMO_MS;
      const step = () => {
        k = (k + 1) % reel.length;
        show(reel[k].src);
        setTimeout(step, wait());
      };
      setTimeout(step, wait());
    })
    .catch(() => {
      // No data: the window still shows whatever src index.html set.
    });
}());
