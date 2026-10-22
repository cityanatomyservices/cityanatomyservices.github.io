// list.js — fills the index page of a folder (/apps/ or /maps/) with every
// app or map of that kind, each linking to its framed page. The list's
// data-kind says which folder this is. Titles and blurbs are the owner's
// words from home.json and apps/reports/reports.json; nothing is written here.
(function () {
  const list = document.getElementById('page-list');
  if (!list) return;
  const kind = list.dataset.kind || 'apps';

  function addRow(title, blurb, href) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = href;
    link.textContent = title;
    li.appendChild(link);
    if (blurb) {
      const p = document.createElement('p');
      p.textContent = blurb;
      li.appendChild(p);
    }
    list.appendChild(li);
  }

  Promise.all([
    fetch('/home.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch('/apps/reports/reports.json').then((r) => (r.ok ? r.json() : [])).catch(() => [])
  ]).then(([data, reports]) => {
    const chip = ((data && data.chips) || []).find((c) => c.label === 'Apps');
    ((chip && chip.cards) || [])
      .filter((a) => (a.kind || 'apps') === kind)
      .forEach((a) => addRow(a.title, a.blurb, '/' + kind + '/' + a.slug + '/'));
    if (((data && data.reportsKind) || 'maps') === kind) {
      (reports || []).forEach((r) => addRow(r.title, r.blurb, '/' + kind + '/' + r.id + '/'));
    }
  });
}());
