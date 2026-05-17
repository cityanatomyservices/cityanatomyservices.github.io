// social.js — builds destination URLs for a hotspot's coordinates + name
// and renders 3 icon buttons (Google Maps, Waze, Reddit) into a popup.
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

  const ICONS = {
    gmaps:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>',
    waze:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 12.5l19-8.5-8.5 19-2.2-8.3z"/></svg>',
    reddit: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.1 13.8c0 .2.1.3.1.5 0 2.6-3 4.7-6.7 4.7-3.7 0-6.7-2.1-6.7-4.7 0-.2 0-.3.1-.5a1.6 1.6 0 0 1-.6-1.3 1.6 1.6 0 0 1 2.7-1.2 8.2 8.2 0 0 1 4.3-1.4l.8-3.8a.3.3 0 0 1 .4-.3l2.7.6a1.1 1.1 0 1 1-.1.6l-2.5-.5-.7 3.4a8.1 8.1 0 0 1 4.2 1.4 1.6 1.6 0 0 1 2.7 1.2c0 .5-.2 1-.7 1.3zM9.3 13a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm5.4 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm-5.1 4.5c-.1-.1 0-.3.1-.3a6.4 6.4 0 0 0 4.6 0c.2-.1.3 0 .3.2s-.1.2-.2.3a6.7 6.7 0 0 1-4.6 0c-.1 0-.2-.1-.2-.2z"/></svg>',
  };

  function buttonsHTML(lat, lng, title) {
    const u = links(lat, lng, title);
    if (!u) return '';
    const a = (cls, href, label, svg) =>
      `<a class="pc-popup-social-btn ${cls}" href="${href}" target="_blank" rel="noopener" aria-label="${label}" title="${label}">${svg}</a>`;
    return [
      '<div class="pc-popup-social">',
        a('is-gmaps',  u.gmaps,  'Google Maps', ICONS.gmaps),
        a('is-waze',   u.waze,   'Waze',        ICONS.waze),
        a('is-reddit', u.reddit, 'Reddit',      ICONS.reddit),
      '</div>',
    ].join('');
  }

  window.PubchatSocial = { links, buttonsHTML };
})();
