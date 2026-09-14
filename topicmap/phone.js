// topicmap/phone.js — the ?phone switch, shared by every map page.
//
// ?phone in the address draws the page the way a phone does, whatever the
// window size: the page is zoomed so it lays out about 393 CSS px wide (a
// phone's width) and the map draws at matching pixel density, so a
// 1080x1920 recording looks exactly like the phone view (2026-09-14).
// Viewport units ignore zoom, so the page gets its phone-sized box by hand.
// Load it after the .page element exists. The zoom factor is left in
// window.PHONE_SCALE (1 when the switch is off) for the map's pixelRatio.
window.PHONE_SCALE = (function () {
  if (!new URLSearchParams(location.search).has('phone')) return 1;
  const scale = window.innerWidth / 393;
  document.documentElement.style.zoom = scale;
  const pageEl = document.querySelector('.page');
  pageEl.style.width = '393px';
  pageEl.style.height = Math.round(window.innerHeight / scale) + 'px';
  return scale;
})();
