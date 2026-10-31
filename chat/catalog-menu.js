/* Map menus share the site catalog, with no duplicate app or media lists. */
(() => {
  let home;
  async function read(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Catalog unavailable');
    return response.json();
  }
  function catalog() {
    if (!home) home = read('/home.json').catch(error => { home = null; throw error; });
    return home;
  }
  function add(list, title, href, external = false) {
    const item = document.createElement('li'), link = document.createElement(href ? 'a' : 'span');
    link.textContent = title;
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
  function menu(name, render, directory) {
    const id = name.toLowerCase(), button = document.getElementById('ctrl' + name);
    if (!button) return;
    const panel = document.createElement('section');
    panel.id = id + '-panel'; panel.className = 'catalog-panel'; panel.hidden = true;
    panel.setAttribute('aria-labelledby', id + '-heading');
    panel.innerHTML = `<div class="catalog-heading"><h2 id="${id}-heading">${name}</h2><button class="catalog-close" type="button" aria-label="Close ${name}">×</button></div>
      ${directory ? `<a href="${directory}" target="_top">All ${id} →</a>` : ''}<div class="catalog-groups"></div><p class="catalog-status" role="status"></p>`;
    document.querySelector('.page').append(panel);
    const groups = panel.querySelector('.catalog-groups'), status = panel.querySelector('.catalog-status');
    let loaded = false, loading = false;
    async function load() {
      if (loaded || loading) return;
      loading = true; status.textContent = `Loading ${id}…`;
      try {
        const fragment = document.createDocumentFragment();
        await render(await catalog(), fragment);
        groups.replaceChildren(fragment); loaded = true; status.textContent = '';
      } catch (_) {
        status.textContent = `Could not load ${id}. Close and reopen to retry.`;
      } finally { loading = false; }
    }
    function show(open, returnFocus = false) {
      if (open) {
        for (const other of ['AustinApps', 'AustinMedia', 'AustinDayPlan', 'AustinChatCard', 'AustinExplore']) {
          if (other !== 'Austin' + name) window[other]?.close?.();
        }
      }
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open)); button.classList.toggle('is-on', open);
      if (open) { panel.querySelector('.catalog-close').focus({ preventScroll: true }); load(); }
      else {
        panel.querySelectorAll('details').forEach(details => { details.open = false; });
        if (returnFocus || panel.contains(document.activeElement)) button.focus({ preventScroll: true });
      }
    }
    window['Austin' + name] = { close: () => show(false) };
    button.addEventListener('click', () => show(panel.hidden));
    panel.querySelector('.catalog-close').addEventListener('click', () => show(false, true));
    panel.addEventListener('keydown', event => { if (event.key === 'Escape') show(false, true); });
  }
  menu('Apps', async (data, holder) => {
    const reports = await read('/apps/reports/reports.json'), lists = new Map();
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
      add(listFor(app.category || 'Apps'), app.title, `/${kind}/${app.slug}/`);
    });
    reports.forEach(report => add(listFor(data.reportsCategory || 'Shopping Apps'), report.title, `/${data.reportsKind || 'maps'}/${report.id}/`));
  }, '/apps/');
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
