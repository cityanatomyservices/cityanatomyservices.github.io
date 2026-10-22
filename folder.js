// folder.js — what is in a folder of this site, asked of GitHub.
//
// GitHub Pages cannot list a folder, but the repo is public, so GitHub's API
// can say what a folder holds. That is how /apps/ and /maps/ list every
// folder that exists (list.js) and how a framed page with no entry in
// home.json finds the PDF or page inside its folder (view.js) — so the owner
// can drop a new folder in and it simply appears, nothing to run.
//
// Limit: GitHub allows about 60 of these calls an hour per visitor, which a
// normal visit never approaches. If a call fails, the callers fall back to
// home.json and reports.json.
window.siteFolder = function (folderPath) {
  const repo = 'cityanatomyservices/cityanatomyservices.github.io';
  const url = 'https://api.github.com/repos/' + repo + '/contents/' + folderPath;
  return fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error('GitHub API ' + r.status))))
    .then((items) => (Array.isArray(items) ? items : []))
    // Each item: { name, type: 'file' | 'dir' }.
    .then((items) => items.map((i) => ({ name: i.name, type: i.type })));
};

// "austin-golf-courses" → "Austin golf courses", for a folder with no title
// of its own in the data files.
window.siteTitleFromName = function (name) {
  const words = name.replace(/[-_]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
