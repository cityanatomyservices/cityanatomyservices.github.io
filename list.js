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

  function access(){
    if(kind!=='apps')return;
    const registered=window.AustinSession?.registered,member=window.AustinMembership?.state;
    for(const link of list.querySelectorAll('[data-app-href]')){
      const enabled=registered&&(link.dataset.requiredPlan!=='pro'||member?.plan==='pro'&&Date.parse(member.paidThrough)>Date.now());
      if(enabled){link.href=link.dataset.appHref;link.removeAttribute('tabindex');}else{link.removeAttribute('href');link.tabIndex=-1;}
      link.setAttribute('aria-disabled',String(!enabled));link.style.opacity=enabled?'':'0.5';
    }
  }
  function bind(){window.AustinMembership?.subscribe(access);window.AustinSession?.subscribe(()=>{access();if(window.AustinSession.registered)window.AustinMembership?.load().catch(access);});window.AustinMembership?.load().then(access).catch(access);}
  window.addEventListener('austin-membership-ready',bind);if(window.AustinMembership)bind();
  if(kind==='apps'){
    const note=document.createElement('p');note.innerHTML='Sign in to use Apps. Pro apps require Pro. <a href="/?account=membership">View membership</a>.';list.before(note);
  }
  function addRow(title, blurb, href, requiredPlan) {
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = href;
    link.textContent = title+(requiredPlan==='pro'?' — Pro App':'');
    if(kind==='apps'){link.dataset.appHref=href;link.dataset.requiredPlan=requiredPlan||'free';link.onclick=event=>{if(link.getAttribute('aria-disabled')==='true')event.preventDefault();};}
    li.appendChild(link);
    if (blurb) {
      const p = document.createElement('p');
      p.textContent = blurb;
      li.appendChild(p);
    }
    list.appendChild(li);
  }

  Promise.all([
    fetch('/home.json?v=20261108b').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch('/apps/reports/reports.json?v=20261104e').then((r) => (r.ok ? r.json() : [])).catch(() => []),
    window.siteFolder(kind).catch(() => [])
  ]).then(([data, reports, folder]) => {
    const seen = new Set();
    const chip = ((data && data.chips) || []).find((c) => c.label === 'Apps');
    ((chip && chip.cards) || [])
      .filter((a) => (a.kind || 'apps') === kind)
      .forEach((a) => { seen.add(a.slug); addRow(a.title, a.blurb, '/' + kind + '/' + a.slug + '/',a.requiredPlan); });
    if (((data && data.reportsKind) || 'maps') === kind) {
      (reports || []).forEach((r) => { seen.add(r.id); addRow(r.title, r.blurb, '/' + kind + '/' + r.id + '/',r.requiredPlan); });
    }
    folder
      .filter((f) => f.type === 'dir' && !seen.has(f.name) && !(SKIP[kind] || []).includes(f.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((f) => addRow(window.siteTitleFromName(f.name), '', '/' + kind + '/' + f.name + '/'));
    access();
  });
}());
