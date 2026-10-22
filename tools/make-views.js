// make-views.js — creates (or refreshes) the folder for every framed page.
//
//   node tools/make-views.js        (from the repo root)
//
// For each app in home.json (its `slug`) and each report in
// apps/reports/reports.json (its `id`) this writes /view/<name>/index.html as
// a copy of /view/template.html. Run it after adding an app or a report, or
// after editing the template, then commit the result. It never deletes:
// remove a folder by hand if an app goes away.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'view', 'template.html'), 'utf8');
const home = JSON.parse(fs.readFileSync(path.join(root, 'home.json'), 'utf8'));
const reports = JSON.parse(fs.readFileSync(path.join(root, 'apps', 'reports', 'reports.json'), 'utf8'));

const apps = (home.chips.find((c) => c.label === 'Apps') || { cards: [] }).cards;
const names = [
  ...apps.map((a) => a.slug).filter(Boolean),
  ...reports.map((r) => r.id)
];

for (const name of names) {
  const dir = path.join(root, 'view', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), template);
  console.log('view/' + name + '/');
}
console.log(names.length + ' framed pages');
