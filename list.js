// list.js — fills the index page of a folder (/apps/ or /maps/) with every
// framed page in it, each linking to its own address. The list's data-kind
// says which folder this is.
//
// Two sources, merged: the data files (home.json and apps/reports/reports.json,
// which carry the owner's titles and blurbs) and the folder itself as GitHub
// lists it (folder.js), so a folder dropped in by hand shows up too, titled
// from its name. Data entries come first in their own order, then the rest
// alphabetically.
(function () {
  const list = document.getElementById('page-list');
  if (!list) return;
  const kind = list.dataset.kind || 'apps';

  // Folders under /apps/ that are not framed pages: the reports' own code
  // and shared files. Add here if another such folder appears.
  const SKIP = { apps: ['reports', 'shared'], maps: [] };

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
    fetch('/apps/reports/reports.json').then((r) => (r.ok ? r.json() : [])).catch(() => []),
    window.siteFolder(kind).catch(() => [])
  ]).then(([data, reports, folder]) => {
    const seen = new Set();
    const chip = ((data && data.chips) || []).find((c) => c.label === 'Apps');
    ((chip && chip.cards) || [])
      .filter((a) => (a.kind || 'apps') === kind)
      .forEach((a) => { seen.add(a.slug); addRow(a.title, a.blurb, '/' + kind + '/' + a.slug + '/'); });
    if (((data && data.reportsKind) || 'maps') === kind) {
      (reports || []).forEach((r) => { seen.add(r.id); addRow(r.title, r.blurb, '/' + kind + '/' + r.id + '/'); });
    }
    folder
      .filter((f) => f.type === 'dir' && !seen.has(f.name) && !(SKIP[kind] || []).includes(f.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((f) => addRow(window.siteTitleFromName(f.name), '', '/' + kind + '/' + f.name + '/'));
  });
}());
