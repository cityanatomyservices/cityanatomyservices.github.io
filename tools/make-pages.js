// make-pages.js — creates (or refreshes) the folder for every framed page.
//
//   node tools/make-pages.js        (from the repo root)
//
// For each app in home.json this writes /<kind>/<slug>/index.html, and for
// each report in apps/reports/reports.json /maps/<id>/index.html, each a copy
// of tools/page-template.html. Run it after adding an app or a report, or
// after editing the template, then commit the result. It never deletes:
// remove a folder by hand if something goes away. A folder made by hand
// (say /maps/zoning/ holding zoning.pdf) needs no data entry: this script
// gives it an index.html, and that page shows the PDF it finds (view.js).
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(__dirname, 'page-template.html'), 'utf8');
const home = JSON.parse(fs.readFileSync(path.join(root, 'home.json'), 'utf8'));
const reports = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'reports', 'reports.json'), 'utf8'));

const apps = (home.chips.find((c) => c.label === 'Apps') || { cards: [] }).cards;
const pages = [
  ...apps.filter((a) => a.slug).map((a) => (a.kind || 'apps') + '/' + a.slug),
  ...reports.map((r) => (home.reportsKind || 'maps') + '/' + r.id)
];

// Folders the owner made by hand (say, one holding a PDF) get the same
// index.html if they have none yet. Folders of code are skipped.
const SKIP = { apps: ['reports', 'shared'], maps: [] };
for (const kind of ['apps', 'maps']) {
  const base = path.join(root, kind);
  if (!fs.existsSync(base)) continue;
  for (const name of fs.readdirSync(base)) {
    const dir = path.join(base, name);
    if (!fs.statSync(dir).isDirectory() || SKIP[kind].includes(name)) continue;
    if (!fs.existsSync(path.join(dir, 'index.html'))) pages.push(kind + '/' + name);
  }
}

for (const page of pages) {
  const dir = path.join(root, page);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), template);
  console.log(page + '/');
}
console.log(pages.length + ' framed pages');
