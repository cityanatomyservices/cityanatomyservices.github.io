/* Map menus share the site catalog, with no duplicate app or media lists. */
(() => {
  let home;
  async function read(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Catalog unavailable');
    return response.json();
  }
  function catalog() {
    if (!home) home = read('/home.json?v=20261109f').catch(error => { home = null; throw error; });
    return home;
  }
  const registered=()=>window.AustinSession?.registered===true;
  const pro=()=>registered()&&window.AustinMembership?.state?.plan==='pro'&&Date.parse(window.AustinMembership.state.paidThrough)>Date.now();
  function access() {
    const button=document.getElementById('ctrlApps');
    if(button){button.disabled=!registered();button.title=registered()?'Pro Apps':'Sign in to use Pro Apps';}
    if(!registered())window.AustinApps?.close();
    document.querySelectorAll('[data-pro-app]').forEach(link=>{
      const enabled=pro();link.classList.toggle('catalog-locked',!enabled);link.setAttribute('aria-disabled',String(!enabled));
      if(enabled){link.href=link.dataset.proApp;link.removeAttribute('tabindex');}else{link.removeAttribute('href');link.tabIndex=-1;}
    });
    document.querySelectorAll('.catalog-membership').forEach(offer=>{offer.hidden=pro();});
  }
  function bindMembership(){window.AustinMembership?.subscribe(access);access();}
  window.addEventListener('austin-membership-ready',bindMembership);
  window.AustinSession?.subscribe(access);if(window.AustinMembership)bindMembership();
  window.AustinSession?.peek().then(access).catch(access);
  function add(list, title, href, external = false, requiredPlan) {
    const item = document.createElement('li'), link = document.createElement(href ? 'a' : 'span');
    link.textContent = title+(requiredPlan==='pro'?' — Pro App':'');
    if(requiredPlan==='pro'){
      link.dataset.proApp=href;link.addEventListener('click',event=>{if(!pro())event.preventDefault();});
    }
    if (href) {
      link.href = href; link.target = external ? '_blank' : '_top';
      if (external) link.rel = 'noopener';
    } else link.className = 'catalog-soon';
    item.append(link); list.append(item);
    if(href&&!external&&/^\/(apps|maps)\/[^/]+\/$/.test(href))window.AustinFavorites?.mount(item,{key:'app:'+href,title,kind:'app',url:href});
  }
  function group(holder, title) {
    const details = document.createElement('details'), summary = document.createElement('summary'), list = document.createElement('ul');
    summary.textContent = title; details.append(summary, list); holder.append(details);
    return list;
  }
  const membershipOffer = '<p class="catalog-membership">Pro apps require Pro. <a href="/?account=membership" target="_top">Membership — $8/month</a></p>';
  function loader(panel, render, id) {
    const groups = panel.querySelector('.catalog-groups'), status = panel.querySelector('.catalog-status');
    let loaded = false, loading = false;
    return async function load() {
      if (loaded || loading) return;
      loading = true; status.textContent = `Loading ${id}…`;
      try {
        const fragment = document.createDocumentFragment();
        await render(await catalog(), fragment);
        groups.replaceChildren(fragment); loaded = true; status.textContent = '';access();
      } catch (_) {
        status.textContent = `Could not load ${id}. Close and reopen to retry.`;
      } finally { loading = false; }
    };
  }
  function menu(name, render, directory) {
    const id = name.toLowerCase(), button = document.getElementById('ctrl' + name);
    if (!button) return;
    const panel = document.createElement('section');
    panel.id = id + '-panel'; panel.className = 'catalog-panel'; panel.hidden = true;
    panel.setAttribute('aria-labelledby', id + '-heading');
    panel.innerHTML = `<div class="catalog-heading"><h2 id="${id}-heading">${name}</h2><button class="catalog-close" type="button" aria-label="Close ${name}">×</button></div>
      ${directory ? `<a href="${directory}" target="_top">All ${id} →</a>` : ''}${name==='Apps'?membershipOffer:''}<div class="catalog-groups"></div><p class="catalog-status" role="status"></p>`;
    document.querySelector('.page').append(panel);
    const load = loader(panel, render, id);
    function show(open, returnFocus = false) {
      if(open&&name==='Apps'&&!registered())return;
      if (open) {
        for (const other of ['AustinApps', 'AustinMedia', 'AustinDayPlan', 'AustinChatCard', 'AustinExplore']) {
          if (other !== 'Austin' + name) window[other]?.close?.();
        }
      }
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open)); button.classList.toggle('is-on', open);
      if (open) { panel.querySelector('.catalog-close').focus({ preventScroll: true }); load();if(name==='Apps')window.AustinMembership?.load().then(access).catch(access); }
      else {
        panel.querySelectorAll('details').forEach(details => { details.open = false; });
        if (returnFocus || panel.contains(document.activeElement)) button.focus({ preventScroll: true });
      }
    }
    window['Austin' + name] = { close: () => show(false) };
    button.addEventListener('click', () => show(panel.hidden));
    panel.querySelector('.catalog-close').addEventListener('click', () => show(false, true));
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') show(false, true); });
    access();
  }
  async function renderApps(data, holder) {
    const reports = await read('/apps/reports/reports.json?v=20261104e'), lists = new Map();
    const listFor = name => {
      if (!lists.has(name)) lists.set(name, group(holder, name));
      return lists.get(name);
    };
    (data.categories || []).forEach(listFor);
    const cards = (data.chips || []).find(chip => chip.label === 'Apps')?.cards || [];
    cards.forEach(app => {
      const kind = app.kind || 'apps';
      // Uncategorised maps stay with the former Content links, now in Media.
      if (kind === 'maps' && !lists.has(app.category)) return;
      add(listFor(app.category || 'Apps'), app.title, `/${kind}/${app.slug}/`,false,app.requiredPlan);
    });
    reports.forEach(report => add(listFor(data.reportsCategory || 'Shopping Apps'), report.title, `/${data.reportsKind || 'maps'}/${report.id}/`,false,report.requiredPlan));
  }
  menu('Apps', renderApps, '/apps/');
  window.AustinProApps = { init() {
    window.AustinExplore.addSection({
      id: 'pro-apps', buttonId: 'ctrlProApps', title: 'Pro Tier Apps',
      icon: '<path d="M3 3h7v7H3Z M14 3h7v7h-7Z M3 14h7v7H3Z M14 14h7v7h-7Z"/>',
      mount(host) {
        host.classList.add('catalog-content');
        host.innerHTML = `<h3>Pro Tier Apps</h3><a href="/apps/" target="_top">All apps →</a>${membershipOffer}<div class="catalog-groups"></div><p class="catalog-status" role="status"></p>`;
        const load = loader(host, renderApps, 'apps');
        return { refresh() { load(); window.AustinMembership?.load().then(access).catch(access); } };
      }
    });
  } };
  menu('Media', (data, holder) => {
    const maps = group(holder, 'Maps'), appCategories = new Set(data.categories || []);
    add(maps, 'All maps', '/maps/');
    const cards = (data.chips || []).find(chip => chip.label === 'Apps')?.cards || [];
    cards.forEach(app => {
      const kind = app.kind || 'apps';
      if (kind === 'maps' && !appCategories.has(app.category)) add(maps, app.title, `/${kind}/${app.slug}/`);
      else appCategories.add(app.category || 'Apps');
    });
    const links = document.createElement('ul'); links.className = 'catalog-media-links';
    (data.content || []).forEach(item => add(links, item.title, item.url, true));
    holder.append(links);
  });
})();
