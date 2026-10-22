// make-pages.js — creates (or refreshes) the folder for every framed page.
//
//   node tools/make-pages.js        (from the repo root)
//
// For each app in home.json this writes /<kind>/<slug>/index.html, and for
// each report in apps/reports/reports.json /maps/<id>/index.html, each a copy
// of tools/page-template.html. Run it after adding an app or a report, or
// after editing the template, then commit the result. It never deletes:
// remove a folder by hand if something goes away. A map folder may instead
// hold a PDF by hand; then point that entry's `app` at the PDF and the framed
// page shows it in the window.
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

for (const page of pages) {
  const dir = path.join(root, page);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), template);
  console.log(page + '/');
}
console.log(pages.length + ' framed pages');
