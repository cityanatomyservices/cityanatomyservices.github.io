// view.js — a framed page for one app or map. Every folder under /apps/ and
// /maps/ holds the same small index.html; this script reads the folder from
// the address (/maps/budget/ → kind "maps", name "budget"), finds that entry
// in home.json (`kind` + `slug`) or, under /maps/, in apps/reports/reports.json
// (its `id`), and loads it into the window. The header, menu and footer come
// from shell.js as everywhere.
//
// So a QR code or a shared link to https://austin.chat/maps/budget/ opens the
// Budget Map inside the site's frame. What loads can be a page or a PDF. A
// folder with no entry in the data files still works: the page shows the
// PDF or page found inside it, titled from the folder's name.
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
    if (app || report) {
      show(app ? app.title : report.title, app ? (app.app || app.src) : '/apps/reports/' + report.id + '/');
      return;
    }
    // No entry in the data files: look inside the folder (folder.js) and show
    // the PDF, or the page other than index.html, that the owner put there.
    window.siteFolder(kind + '/' + name)
      .then((items) => {
        const files = items.filter((i) => i.type === 'file' && i.name !== 'index.html');
        const pick = files.find((f) => /\.pdf$/i.test(f.name)) || files.find((f) => /\.html?$/i.test(f.name));
        if (pick) show(window.siteTitleFromName(name), '/' + kind + '/' + name + '/' + pick.name);
        else missing('Nothing to show in /' + kind + '/' + name + '/ yet.');
      })
      .catch(() => missing('Nothing called "' + name + '" under /' + kind + '/ — check the address.'));
  });

  function show(title, src) {
    document.title = title + ' · Austin.Chat';
    frame.title = title;
    const target=new URL(src,location.origin);
    for(const [key,value] of new URLSearchParams(location.search))if(key!=='v')target.searchParams.set(key,value);
    if(location.hash)target.hash=location.hash;
    frame.src = target.href;
  }

  function missing(text) {
    frame.replaceWith(Object.assign(document.createElement('p'), { className: 'view-missing', textContent: text }));
  }
}());
