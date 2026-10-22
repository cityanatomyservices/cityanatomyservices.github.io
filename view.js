// view.js — a framed page for one app. Every folder under /view/ holds the
// same small index.html; this script reads the folder's name from the
// address (/view/budget/ → "budget"), finds that app in home.json (its
// `slug`) or in apps/reports/reports.json (its `id`), and loads the app into
// the window. The header, menu and footer come from shell.js as everywhere.
//
// So a QR code or a shared link to https://austin.chat/view/budget/ opens
// the Budget Map inside the site's frame, and the address stays simple.
(function () {
  const frame = document.getElementById('app-window');
  if (!frame) return;

  const slug = location.pathname.split('/').filter(Boolean)[1] || '';

  Promise.all([
    fetch('/home.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch('/apps/reports/reports.json').then((r) => (r.ok ? r.json() : [])).catch(() => [])
  ]).then(([data, reports]) => {
    const chip = ((data && data.chips) || []).find((c) => c.label === 'Apps');
    const app = ((chip && chip.cards) || []).find((a) => a.slug === slug);
    const report = (reports || []).find((r) => r.id === slug);
    const title = app ? app.title : report ? report.title : '';
    const src = app ? (app.app || app.src) : report ? '/apps/reports/' + report.id + '/' : '';
    if (!src) {
      frame.replaceWith(Object.assign(document.createElement('p'), {
        className: 'view-missing',
        textContent: 'No app called "' + slug + '" — check the address.'
      }));
      return;
    }
    document.title = title + ' · Austin.Chat';
    frame.title = title;
    frame.src = src;
  });
}());
