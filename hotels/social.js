// social.js — builds external social-platform URLs for a hotspot's gid
// and renders 3 icon buttons (Instagram, X, Reddit) into a popup.
//
// Pure module. No DOM mutation, no globals other than window.PubchatSocial.
//
// Convention:
//   - Each hotspot has a permanent `gid` (10-char alphanumeric).
//   - "Tag" for cross-platform discovery = "austinchat" + gid
//     (e.g. austinchatbsc3ftghkw). No hyphens or punctuation, so it works
//     as a single hashtag on every platform.
//
// Per-platform behaviour:
//   - Instagram & X: open the platform's hashtag feed for #austinchat<gid>.
//                    Users browse posts; if logged in they can post anything
//                    with that hashtag and it appears for everyone.
//   - Reddit:        URL searches for "<venue name> Austin" OR #austinchat<gid>.
//                    Catches organic Reddit threads about the place AND any
//                    post that opts into the tag convention. From the search
//                    page users can also click "Submit a new post."

(function () {
  const TAG_PREFIX = 'austinchat';

  function decodeEntities(s) {
    return String(s || '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'");
  }

  function links(gid, title) {
    if (!gid) return null;
    const tag = TAG_PREFIX + gid;
    const cleanTitle = decodeEntities(title).replace(/·/g, ' ').replace(/\s+/g, ' ').trim();
    const searchTerm = /austin/i.test(cleanTitle) ? cleanTitle : (cleanTitle + ' Austin');
    return {
      instagram: 'https://www.instagram.com/explore/tags/' + tag + '/',
      x:         'https://x.com/hashtag/' + tag,
      reddit:    'https://www.reddit.com/search/?q=' + encodeURIComponent('"' + searchTerm + '" OR #' + tag),
    };
  }

  // Inline SVG paths, sourced from the social footer in each chat-app page.
  const ICONS = {
    instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1.1.4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1.1.4-2.2.4-1.3.1-1.6.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4a3.9 3.9 0 0 1-1.4-.9c-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1.1-.4-2.2-.1-1.3-.1-1.6-.1-4.9s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1.1-.4 2.2-.4 1.3-.1 1.6-.1 4.9-.1zM12 0C8.7 0 8.3 0 7.1.1 5.8.1 4.9.3 4.1.6c-.8.3-1.5.7-2.2 1.4A6 6 0 0 0 .6 4.1C.3 4.9.1 5.8.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.1 1.3.2 2.2.6 2.9.3.8.7 1.5 1.4 2.2.7.7 1.3 1.1 2.2 1.4.8.3 1.6.5 2.9.6 1.2.1 1.6.1 4.8.1s3.7 0 4.9-.1c1.3-.1 2.2-.2 2.9-.6.8-.3 1.5-.7 2.2-1.4.7-.7 1.1-1.3 1.4-2.2.3-.8.5-1.6.6-2.9.1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.1-1.3-.2-2.2-.6-2.9-.3-.8-.7-1.5-1.4-2.2A6 6 0 0 0 19.9.6C19.1.3 18.2.1 16.9.1 15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 12 5.8zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-10.9a1.4 1.4 0 1 0 0 2.9 1.4 1.4 0 0 0 0-2.9z"/></svg>',
    x:         '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2.25h3.5l-7.7 8.8L23 21.75h-7.1l-5.5-7.2-6.3 7.2H.6l8.2-9.4L.4 2.25H7.7l5 6.6 5.5-6.6zm-1.2 17.5h2L7.1 4.3H5L17 19.75z"/></svg>',
    reddit:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.1 13.8c0 .2.1.3.1.5 0 2.6-3 4.7-6.7 4.7-3.7 0-6.7-2.1-6.7-4.7 0-.2 0-.3.1-.5a1.6 1.6 0 0 1-.6-1.3 1.6 1.6 0 0 1 2.7-1.2 8.2 8.2 0 0 1 4.3-1.4l.8-3.8a.3.3 0 0 1 .4-.3l2.7.6a1.1 1.1 0 1 1-.1.6l-2.5-.5-.7 3.4a8.1 8.1 0 0 1 4.2 1.4 1.6 1.6 0 0 1 2.7 1.2c0 .5-.2 1-.7 1.3zM9.3 13a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm5.4 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm-5.1 4.5c-.1-.1 0-.3.1-.3a6.4 6.4 0 0 0 4.6 0c.2-.1.3 0 .3.2s-.1.2-.2.3a6.7 6.7 0 0 1-4.6 0c-.1 0-.2-.1-.2-.2z"/></svg>',
  };

  // Returns an HTML string: a flex row of 3 icon-only anchor buttons.
  // Empty string if the hotspot has no gid (defensive — every hotspot
  // should have one but new entries might be created without one).
  function buttonsHTML(gid, title) {
    const u = links(gid, title);
    if (!u) return '';
    const a = (cls, href, label, svg) =>
      `<a class="pc-popup-social-btn ${cls}" href="${href}" target="_blank" rel="noopener" aria-label="${label}" title="${label}">${svg}</a>`;
    return [
      '<div class="pc-popup-social">',
        a('is-instagram', u.instagram, 'Instagram',   ICONS.instagram),
        a('is-x',         u.x,         'X (Twitter)', ICONS.x),
        a('is-reddit',    u.reddit,    'Reddit',      ICONS.reddit),
      '</div>',
    ].join('');
  }

  window.PubchatSocial = { links, buttonsHTML };
})();
