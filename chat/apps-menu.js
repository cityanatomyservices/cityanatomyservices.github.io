/* The map's Apps panel reads the same catalog as /apps/ and /maps/. */
(() => {
  const button = document.getElementById('ctrlApps');
  const panel = document.createElement('section');
  panel.id = 'apps-panel'; panel.className = 'apps-panel'; panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'apps-heading');
  panel.innerHTML = `<div class="apps-heading"><h2 id="apps-heading">Apps</h2><button class="apps-close" type="button" aria-label="Close Apps">×</button></div>
    <a href="/apps/" target="_top">All apps →</a><div class="apps-groups"></div><p class="apps-status" role="status"></p>`;
  document.querySelector('.page').append(panel);
  const groups = panel.querySelector('.apps-groups'), status = panel.querySelector('.apps-status');
  let loaded = false, loading = false;

  function show(open, returnFocus = false) {
    if (open) {
      window.AustinDayPlan?.close(); window.AustinChatCard?.close(); window.AustinExplore?.close?.();
    }
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open)); button.classList.toggle('is-on', open);
    if (open) { panel.querySelector('.apps-close').focus({ preventScroll: true }); load(); }
    else {
      panel.querySelectorAll('details').forEach(group => { group.open = false; });
      if (returnFocus || panel.contains(document.activeElement)) button.focus({ preventScroll: true });
    }
  }
  window.AustinApps = { close: () => show(false) };
  button.addEventListener('click', () => show(panel.hidden));
  panel.querySelector('.apps-close').addEventListener('click', () => show(false, true));
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') show(false, true); });

  async function read(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Catalog unavailable');
    return response.json();
  }
  async function load() {
    if (loaded || loading) return;
    loading = true; status.textContent = 'Loading apps…';
    try {
      const [data, reports] = await Promise.all([read('/home.json'), read('/apps/reports/reports.json')]);
      const lists = new Map(), fragment = document.createDocumentFragment();
      function listFor(name) {
        if (!lists.has(name)) {
          const group = document.createElement('details'), summary = document.createElement('summary'), list = document.createElement('ul');
          summary.textContent = name; group.append(summary, list); fragment.append(group); lists.set(name, list);
        }
        return lists.get(name);
      }
      function add(list, title, href) {
        const item = document.createElement('li'), link = document.createElement('a');
        link.textContent = title; link.href = href; link.target = '_top'; item.append(link); list.append(item);
      }
      (data.categories || []).forEach(listFor);
      const cards = (data.chips || []).find(chip => chip.label === 'Apps')?.cards || [];
      cards.forEach(app => {
        const kind = app.kind || 'apps';
        // Uncategorised maps remain in Content → Maps, as in the site menu.
        if (kind === 'maps' && !lists.has(app.category)) return;
        add(listFor(app.category || 'Apps'), app.title, `/${kind}/${app.slug}/`);
      });
      reports.forEach(report => add(listFor(data.reportsCategory || 'Shopping Apps'), report.title, `/${data.reportsKind || 'maps'}/${report.id}/`));
      groups.replaceChildren(fragment); loaded = true; status.textContent = '';
    } catch (_) {
      status.textContent = 'Could not load the app categories. Use All apps, or close and reopen to retry.';
    } finally { loading = false; }
  }
})();
