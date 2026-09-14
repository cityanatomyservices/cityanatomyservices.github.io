// topicmap/phone.js — the ?phone and ?width= switches, shared by every map page.
//
// ?phone in the address draws the page the way a phone does, whatever the
// window size: the page is zoomed so it lays out about 393 CSS px wide (a
// phone's width) and the map draws at matching pixel density, so a
// 1080x1920 recording looks exactly like the phone view (2026-09-14).
// ?width=1280 does the same with any layout width: a 1920x1080 recording
// with ?width=1280 lays the page out at 1280x720 and scales it by 1.5, so
// the type and the dots are readable in a 16:9 video (2026-09-14, for the
// desktop cut). Without either switch the page is drawn as it is.
// Viewport units ignore zoom, so the page gets its sized box by hand.
// Load it after the .page element exists. The zoom factor is left in
// window.PHONE_SCALE (1 when no switch is on) for the map's pixelRatio.
window.PHONE_SCALE = (function () {
  const query = new URLSearchParams(location.search);
  const width = query.has('phone') ? 393 : Number(query.get('width')) || 0;
  if (!width) return 1;
  const scale = window.innerWidth / width;
  document.documentElement.style.zoom = scale;
  const pageEl = document.querySelector('.page');
  pageEl.style.width = width + 'px';
  pageEl.style.height = Math.round(window.innerHeight / scale) + 'px';
  return scale;
})();
