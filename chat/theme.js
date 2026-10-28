/* Match the surrounding site's saved appearance, including changes in another
   same-origin document. This does not access map state, identity or location. */
(() => {
  function sync() {
    let theme = 'light';
    try { if (localStorage.getItem('theme') === 'dark') theme = 'dark'; } catch (_) { /* light default */ }
    document.documentElement.dataset.theme = theme;
  }
  sync();
  window.addEventListener('storage', event => { if (event.key === 'theme' || event.key === null) sync(); });
  window.addEventListener('pageshow', sync);
})();
