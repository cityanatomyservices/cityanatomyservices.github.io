// social.js — builds destination URLs for a hotspot's coordinates + name
// and renders 3 branded buttons (Google Maps, Waze, Reddit) into a popup.
//
// Pure module. No DOM mutation, no globals other than window.PubchatSocial.
//
// Per-button behaviour:
//   - Google Maps: opens Google Maps centered on the hotspot's lat/lng.
//   - Waze:        opens Waze at the same lat/lng with navigation queued.
//   - Reddit:      searches Reddit for the venue's title (auto-appends
//                  "Austin" if not already in the name).

(function () {
  function decodeEntities(s) {
    return String(s || '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'");
  }

  function links(lat, lng, title) {
    if (lat == null || lng == null || !Number.isFinite(+lat) || !Number.isFinite(+lng)) return null;
    const cleanTitle = decodeEntities(title).replace(/·/g, ' ').replace(/\s+/g, ' ').trim();
    const searchTerm = /austin/i.test(cleanTitle) ? cleanTitle : (cleanTitle + ' Austin');
    return {
      gmaps:  'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng,
      waze:   'https://www.waze.com/ul?ll=' + lat + '%2C' + lng + '&navigate=yes',
      reddit: 'https://www.reddit.com/search/?q=' + encodeURIComponent(searchTerm),
    };
  }

  // Google Maps pin: red teardrop with a white center circle — the
  // universally-recognized Google Maps marker.
  const GMAPS_SVG = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2C7.6 2 4 5.6 4 10c0 5.5 8 12 8 12s8-6.5 8-12c0-4.4-3.6-8-8-8z" fill="#EA4335"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>';

  function buttonsHTML(lat, lng, title) {
    const u = links(lat, lng, title);
    if (!u) return '';
    return [
      '<div class="pc-popup-social">',
        `<a class="pc-popup-social-btn is-gmaps" href="${u.gmaps}" target="_blank" rel="noopener" aria-label="Open in Google Maps" title="Open in Google Maps">${GMAPS_SVG}</a>`,
        `<a class="pc-popup-social-btn is-waze" href="${u.waze}" target="_blank" rel="noopener" aria-label="Open in Waze" title="Open in Waze"><span class="pc-brand-waze">Waze</span></a>`,
        `<a class="pc-popup-social-btn is-reddit" href="${u.reddit}" target="_blank" rel="noopener" aria-label="Search on Reddit" title="Search on Reddit"><span class="pc-brand-reddit">reddit</span></a>`,
      '</div>',
    ].join('');
  }

  window.PubchatSocial = { links, buttonsHTML };
})();
