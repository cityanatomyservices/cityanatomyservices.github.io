// view.js — a framed page for one app or map. Every folder under /apps/ and
// /maps/ holds the same small index.html; this script reads the folder from
// the address (/maps/budget/ → kind "maps", name "budget"), finds that entry
// in home.json (`kind` + `slug`) or, under /maps/, in apps/reports/reports.json
// (its `id`), and loads it into the window. The header, menu and footer come
// from shell.js as everywhere.
//
// So a QR code or a shared link to https://austin.chat/maps/budget/ opens the
// Budget Map inside the site's frame. What loads can be a page or a PDF.
(function () {
  const frame = document.getElementById('app-window');
  if (!frame) return;

  const parts = location.pathname.split('/').filter(Boolean);
  const kind = parts[0] || '';
  const name = parts[1] || '';

  Promise.all([
    fetch('/home.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch('/apps/reports/reports.json').then((r) => (r.ok ? r.json() : [])).catch(() => [])
  ]).then(([data, reports]) => {
    const chip = ((data && data.chips) || []).find((c) => c.label === 'Apps');
    const app = ((chip && chip.cards) || []).find((a) => a.slug === name && (a.kind || 'apps') === kind);
    const reportsKind = (data && data.reportsKind) || 'maps';
    const report = kind === reportsKind ? (reports || []).find((r) => r.id === name) : null;
    const title = app ? app.title : report ? report.title : '';
    const src = app ? (app.app || app.src) : report ? '/apps/reports/' + report.id + '/' : '';
    if (!src) {
      frame.replaceWith(Object.assign(document.createElement('p'), {
        className: 'view-missing',
        textContent: 'Nothing called "' + name + '" under /' + kind + '/ — check the address.'
      }));
      return;
    }
    document.title = title + ' · Austin.Chat';
    frame.title = title;
    frame.src = src;
  });
}());
