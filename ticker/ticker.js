/* Austin.chat's shared ticker. No API keys, proxies, or publisher HTML in the DOM. */
(async () => {
  'use strict';
  const root = document.getElementById('austin-ticker');
  if (!root) return;
  await Promise.all([
    import('/ticker/model.js?v=20261028f'),
    import('/chat/explore/config.js?v=20261028e'),
    import('/chat/explore/model.js?v=20261028e'),
  ]);
  const M = window.TickerModel, layers = window.EXPLORE_LAYERS;
  const categories = { ...M.topics, ...Object.fromEntries(layers.map(layer => [layer.id, layer.title])) };
  const storageKey = 'austin-ticker-preferences-v1';
  function readPreferences() {
    try { return M.preferences(JSON.parse(localStorage.getItem(storageKey)), categories); }
    catch (_) { return M.preferences(null, categories); }
  }
  let prefs = readPreferences();
  const exploreFeeds = new Map(), exploreBusy = new Set(), exploreErrors = new Set();
  let stripOffset = 0;
  const links = [
    { category: 'sports', title: 'Austin FC schedule & results', source: 'Austin FC', url: 'https://www.austinfc.com/schedule/' },
    { category: 'property', title: 'Browse Austin homes for sale', source: 'Realtor.com · listing search', url: 'https://www.realtor.com/realestateandhomes-search/Austin_TX' },
    { category: 'property', title: 'Austin homes, condos & open houses', source: 'Realty Austin · listing search', url: 'https://www.realtyaustin.com/listings/city/tx/austin' },
    { category: 'transport', title: 'Check Austin traffic & road closures', source: 'TxDOT · DriveTexas', url: 'https://drivetexas.org/' },
    { category: 'transport', title: 'Check bus & rail service alerts', source: 'CapMetro', url: 'https://www.capmetro.org/service-alerts' },
    { category: 'weather', title: 'Austin forecast & weather alerts', source: 'National Weather Service', url: 'https://forecast.weather.gov/MapClick.php?lat=30.2672&lon=-97.7431' },
  ];
  const stocks = [
    { proName: 'NASDAQ:TSLA', title: 'Tesla · Austin' },
    { proName: 'NYSE:DELL', title: 'Dell · Round Rock' },
    { proName: 'NASDAQ:SLAB', title: 'Silicon Labs · Austin' },
  ];
  const stockLinks = stocks.map(stock => ({ category: 'stocks', title: `${stock.title} · open stock quote`, source: 'TradingView · quote link', url: `https://www.tradingview.com/symbols/${stock.proName.replace(':', '-')}/` }));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  let resumeAfterLink = false;
  let news = [], weather = [], sports = [], sources = [], generated = null, pending = false;
  let hovering = false, focusing = false, dragging = false, frameTime = 0, scrollRemainder = 0;
  let widgetTheme = null;
  root.innerHTML = `
    <div class="ticker-bar">
      <button type="button" class="ticker-brand" aria-expanded="false" aria-controls="ticker-panel">Austin now</button>
      <div class="ticker-viewport" aria-label="Austin updates; links open in a new tab"><div class="ticker-track"></div></div>
      <button type="button" class="ticker-button ticker-pause" aria-label="Pause ticker"></button>
      <button type="button" class="ticker-button ticker-customize" aria-expanded="false" aria-controls="ticker-panel" title="Choose what scrolls" aria-label="Customize ticker">⚙<span> Customize</span></button>
      <button type="button" class="ticker-button ticker-expand" aria-expanded="false" aria-controls="ticker-panel" aria-label="Browse Austin updates">⌃</button>
    </div>
    <section class="ticker-panel" id="ticker-panel" aria-label="Austin updates" hidden>
      <div class="ticker-panel-header"><h2>Austin now</h2>
        <button type="button" class="ticker-button ticker-close" aria-label="Close Austin updates">✕</button>
      </div>
      <div class="ticker-tabs" role="group" aria-label="Austin now views"><button type="button" data-view="browse" aria-pressed="true">Browse updates</button><button type="button" data-view="customize" aria-pressed="false">Customize</button></div>
      <div class="ticker-preferences" hidden>
        <p class="ticker-note">Choose what scrolls. Choices are saved on this browser; your map settings stay separate.</p>
        <fieldset><legend>News & essentials</legend><div class="ticker-choices ticker-topic-choices"></div></fieldset>
        <fieldset><legend>Explore Austin</legend><div class="ticker-choices ticker-explore-choices"></div>
          <label class="ticker-when-label">When <select class="ticker-when" aria-label="When to show Explore listings"><option value="now">Now / next 2 hours</option><option value="tonight">Tonight</option><option value="weekend">This weekend</option><option value="week">Next 7 days</option></select></label>
          <p class="ticker-note">The same listings as Explore on the main map, with times in Austin time. Check the organizer for tickets and availability.</p>
        </fieldset>
        <fieldset><legend>News sources</legend><p class="ticker-note">Choose publishers for your selected news topics.</p><div class="ticker-choices ticker-publisher-choices"></div></fieldset>
        <div class="ticker-preference-actions"><button type="button" data-action="all">Select all topics</button><button type="button" data-action="none">Clear topics</button><button type="button" data-action="reset">Restore defaults</button></div>
        <p class="ticker-note ticker-saved" role="status"></p>
        <button type="button" class="ticker-done">Done</button>
      </div>
      <div class="ticker-reader">
      <label class="ticker-filter">Show <select aria-label="Filter Austin updates"><option value="all">My selected topics</option>${Object.entries(categories).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select></label>
      <p class="ticker-note ticker-updated"></p>
      <p class="ticker-note ticker-explore-updated"></p>
      <details class="ticker-markets"><summary>Austin-area stocks · TSLA / DELL / SLAB</summary>
        <p class="ticker-note">Quotes by TradingView; prices may be delayed. Open a company for its quote timestamp and market status.</p>
        <div class="ticker-stock-links"></div><div class="ticker-market-widget"></div>
      </details>
      <ul class="ticker-list"></ul>
      <details class="ticker-sources"><summary>Sources & updates</summary>
        <p class="ticker-note">Headlines link to the original reporting. News checks hourly. Explore listings use the map’s feeds, refreshed every 3 hours; this page checks them every 5 minutes. Scheduled runs may be delayed and expired items disappear. Weather checks every 15 minutes. Sports check every minute while this tab is visible; ESPN snapshots refresh on a 15-minute schedule when direct access is unavailable. Coverage includes Texas pro teams, Austin FC and Division I college football, basketball and baseball. Property and stock quote links open their sources; they are not live prices in the strip. National stories must mention the Austin area and a federal topic.</p>
        <ul class="ticker-source-list"></ul>
      </details>
      </div>
    </section>`;
  const $ = selector => root.querySelector(selector);
  const viewport = $('.ticker-viewport'), track = $('.ticker-track'), panel = $('.ticker-panel');
  const pauseButton = $('.ticker-pause'), select = $('.ticker-filter select');
  const dateText = (value, time = false) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', month: 'short', day: 'numeric', ...(time ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value));
  const valid = item => M.valid(item, categories);
  function currentItems() {
    const explore = M.exploreItems(exploreFeeds, layers, prefs, window.ExploreModel);
    return M.mix([...weather, ...sports, ...news, ...explore, ...links, ...stockLinks], prefs, categories);
  }
  function anchor(item, compact = false) {
    const a = document.createElement('a');
    a.href = item.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.dataset.item = item.occurrence || item.gameId || item.url;
    if (item.expires) a.dataset.expires = item.expires;
    if (compact) a.className = 'ticker-item';
    const tag = document.createElement('span'); tag.className = 'ticker-tag'; tag.textContent = categories[item.category];
    const title = document.createElement('span');
    title.textContent = (item.starts ? `${dateText(item.starts, !item.allDay)} · ` : '') + item.title;
    const meta = document.createElement('small');
    meta.textContent = [item.source, item.location, item.detail, item.published ? dateText(item.published) : null].filter(Boolean).join(' · ');
    a.append(tag, title, meta);
    return a;
  }
  function renderList() {
    const list = $('.ticker-list'); list.replaceChildren();
    const items = currentItems().filter(item => select.value === 'all' || item.category === select.value);
    for (const item of items) { const li = document.createElement('li'); li.append(anchor(item)); list.append(li); }
    if (!items.length) { const li = document.createElement('li'); li.textContent = prefs.enabled.length ? 'No current updates match your choices. Try another time or topic in Customize.' : 'No topics selected. Use Customize to choose what scrolls.'; list.append(li); }
    $('.ticker-updated').textContent = generated
      ? `News checked ${dateText(generated, true)} CT${Date.now() - Date.parse(generated) > 3 * 3600e3 ? ' · Updates are delayed' : ''}. Links open in a new tab.`
      : 'Live headlines are temporarily unavailable. Browse the local sources below. Links open in a new tab.';
    const selected = layers.filter(layer => prefs.enabled.includes(layer.id));
    const dates = selected.map(layer => Date.parse(exploreFeeds.get(layer.id)?.generated)).filter(Number.isFinite);
    $('.ticker-explore-updated').textContent = !selected.length ? '' : dates.length
      ? `Explore: ${$('.ticker-when').selectedOptions[0].textContent} · Oldest selected feed checked ${dateText(Math.min(...dates), true)} CT${Date.now() - Math.min(...dates) > 6 * 3600e3 ? ' · Updates are delayed' : ''}${selected.some(layer => exploreErrors.has(layer.id)) ? ' · Some updates unavailable' : ''}.`
      : selected.some(layer => exploreBusy.has(layer.id)) ? 'Loading Explore listings…' : 'Explore listings are temporarily unavailable.';
    $('.ticker-markets').hidden = !prefs.enabled.includes('stocks');
  }
  function render(force = false) {
    // Do not replace a focused link or move the reader's position while browsing.
    if (!force && (focusing || hovering || dragging || !panel.hidden)) { pending = true; return; }
    pending = false;
    const oldGroup = track.firstElementChild;
    const oldLeft = viewport.scrollLeft % (oldGroup?.offsetWidth || 1);
    const oldLink = oldGroup && [...oldGroup.children].reverse().find(a => a.offsetLeft - oldGroup.offsetLeft <= oldLeft);
    const offset = oldLink ? oldLeft - (oldLink.offsetLeft - oldGroup.offsetLeft) : 0;
    const group = document.createElement('div'); group.className = 'ticker-group';
    const items = currentItems();
    stripOffset %= Math.max(1, items.length);
    [...items.slice(stripOffset), ...items.slice(0, stripOffset)].slice(0, 48).forEach(item => group.append(anchor(item, true)));
    if (!items.length) {
      const message = document.createElement('span'); message.className = 'ticker-empty';
      message.textContent = prefs.enabled.length ? 'No current updates match your choices · Customize your ticker' : 'Choose your ticker topics with Customize';
      group.append(message);
    }
    const clone = group.cloneNode(true); clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a').forEach(a => { a.tabIndex = -1; });
    track.replaceChildren(group, clone);
    const matching = oldLink?.dataset.item && [...group.children].find(a => a.dataset.item === oldLink.dataset.item);
    viewport.scrollLeft = matching ? matching.offsetLeft - group.offsetLeft + offset : oldLeft;
    renderList();
    const list = $('.ticker-source-list'); list.replaceChildren();
    for (const source of sources) {
      const li = document.createElement('li');
      const a = document.createElement('a'); a.textContent = source.name;
      if (/^https?:\/\//.test(source.url)) { a.href = source.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      li.append(a, document.createTextNode(source.ok ? ` · ${source.count} recent items` : ' · last check failed; unexpired cached items only'));
      list.append(li);
    }
    for (const layer of layers.filter(layer => prefs.enabled.includes(layer.id))) {
      const feed = exploreFeeds.get(layer.id), li = document.createElement('li');
      li.textContent = `${layer.title}: ${feed ? `checked ${dateText(feed.generated, true)} CT` : 'waiting for listings'}${exploreErrors.has(layer.id) ? ' · refresh unavailable' : ''}`;
      if (feed?.sources?.some(source => !source.ok || source.failures)) li.append(document.createTextNode(' · Some organizer updates unavailable'));
      list.append(li);
    }
    for (const name of ['National Weather Service', 'ESPN public scoreboards / Austin FC', 'TradingView', 'Realtor.com / Realty Austin', 'DriveTexas / CapMetro']) {
      const li = document.createElement('li'); li.textContent = name; list.append(li);
    }
  }
  function showPaused() {
    pauseButton.textContent = paused ? '▶' : 'Ⅱ';
    pauseButton.setAttribute('aria-label', paused ? 'Resume ticker' : 'Pause ticker');
    pauseButton.setAttribute('aria-pressed', String(paused));
  }
  pauseButton.addEventListener('click', () => {
    resumeAfterLink = false;
    paused = !paused; showPaused();
  });
  reduced.addEventListener('change', event => { if (event.matches) { paused = true; showPaused(); } });
  function showView(view) {
    const customizing = view === 'customize';
    $('.ticker-preferences').hidden = !customizing;
    $('.ticker-reader').hidden = customizing;
    for (const button of root.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
    $('.ticker-customize').setAttribute('aria-expanded', String(!panel.hidden && customizing));
  }
  function openPanel(open, view = 'browse') {
    panel.hidden = !open;
    for (const button of [$('.ticker-brand'), $('.ticker-expand')]) button.setAttribute('aria-expanded', String(open));
    $('.ticker-expand').textContent = open ? '⌄' : '⌃';
    if (open) {
      showView(view); render(true); panel.scrollTop = 0;
      if (view === 'browse') { select.focus({ preventScroll: true }); loadMarkets(); }
      else $('.ticker-preferences input').focus({ preventScroll: true });
    } else {
      $('.ticker-customize').setAttribute('aria-expanded', 'false');
      $('.ticker-expand').focus(); render(true);
    }
  }
  for (const button of [$('.ticker-brand'), $('.ticker-expand')]) button.addEventListener('click', () => openPanel(panel.hidden));
  $('.ticker-customize').addEventListener('click', () => openPanel(panel.hidden || $('.ticker-preferences').hidden, 'customize'));
  for (const button of root.querySelectorAll('[data-view]')) button.addEventListener('click', () => { showView(button.dataset.view); renderList(); loadMarkets(); });
  $('.ticker-close').addEventListener('click', () => openPanel(false));
  $('.ticker-done').addEventListener('click', () => openPanel(false));
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) openPanel(false); });
  select.addEventListener('change', renderList);
  function syncChoices() {
    for (const input of root.querySelectorAll('[data-topic]')) input.checked = prefs.enabled.includes(input.dataset.topic);
    for (const input of root.querySelectorAll('[data-publisher]')) input.checked = !prefs.excludedPublishers.includes(input.dataset.publisher);
    for (const option of select.options) option.disabled = option.value !== 'all' && !prefs.enabled.includes(option.value);
    if (select.selectedOptions[0]?.disabled) select.value = 'all';
    $('.ticker-when').value = prefs.when;
    $('.ticker-saved').textContent = `${prefs.enabled.length} topics selected. Changes apply immediately.`;
  }
  function applyChoices(save = true) {
    prefs = M.preferences(prefs, categories); stripOffset = 0;
    syncChoices();
    if (save) {
      try { localStorage.setItem(storageKey, JSON.stringify(prefs)); }
      catch (_) { $('.ticker-saved').textContent += ' Storage is unavailable; choices apply for this visit.'; }
    }
    render(true);
    refreshExplore();
    if (prefs.enabled.includes('weather') && !weather.some(valid)) refreshWeather();
    if (prefs.enabled.includes('sports') && !sports.some(valid)) refreshSports();
    if (!prefs.enabled.includes('stocks')) { $('.ticker-markets').open = false; $('.ticker-market-widget').replaceChildren(); widgetTheme = null; }
  }
  function choice(host, key, label, type) {
    const row = document.createElement('label'), input = document.createElement('input'), text = document.createElement('span');
    row.className = 'ticker-choice'; input.type = 'checkbox'; input.dataset[type] = key; text.textContent = label;
    row.append(input, text); host.append(row);
    input.addEventListener('change', () => {
      const field = type === 'topic' ? 'enabled' : 'excludedPublishers';
      const include = type === 'topic' ? input.checked : !input.checked;
      prefs[field] = include ? [...new Set([...prefs[field], key])] : prefs[field].filter(value => value !== key);
      applyChoices();
    });
  }
  for (const [key, title] of Object.entries(M.topics)) choice($('.ticker-topic-choices'), key, title, 'topic');
  for (const layer of layers) choice($('.ticker-explore-choices'), layer.id, layer.title, 'topic');
  for (const [key, name] of Object.entries(M.publishers)) choice($('.ticker-publisher-choices'), key, name, 'publisher');
  $('.ticker-when').addEventListener('change', () => { prefs.when = $('.ticker-when').value; applyChoices(); });
  for (const button of root.querySelectorAll('[data-action]')) button.addEventListener('click', () => {
    if (button.dataset.action === 'reset') prefs = M.preferences(null, categories);
    else prefs.enabled = button.dataset.action === 'all' ? Object.keys(categories) : [];
    applyChoices();
  });
  window.addEventListener('storage', event => { if (event.key === storageKey || event.key === null) { prefs = readPreferences(); applyChoices(false); } });
  syncChoices();
  root.addEventListener('mouseenter', () => { hovering = true; });
  root.addEventListener('mouseleave', () => { hovering = false; });
  root.addEventListener('focusin', () => { focusing = true; });
  root.addEventListener('focusout', () => { focusing = false; });
  viewport.addEventListener('pointerdown', () => { dragging = true; });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointercancel', () => { dragging = false; });
  function rememberLink(event) {
    if (event.target.closest('a[target="_blank"]')) resumeAfterLink = true;
  }
  root.addEventListener('click', rememberLink);
  root.addEventListener('auxclick', rememberLink);
  function resumeFromLink() {
    if (document.hidden || !resumeAfterLink) return;
    resumeAfterLink = false;
    dragging = false;
    hovering = false;
    paused = reduced.matches;
    if (!panel.hidden) openPanel(false);
    showPaused();
  }
  window.addEventListener('focus', resumeFromLink);
  window.addEventListener('pageshow', resumeFromLink);
  document.addEventListener('visibilitychange', resumeFromLink);
  function animate(timestamp) {
    const elapsed = Math.min(timestamp - frameTime, 60); frameTime = timestamp;
    if (pending && !focusing && !hovering && !dragging && panel.hidden) render();
    // Only explicit pause, active dragging, or the expanded reader stops motion.
    // A clicked link can retain focus/hover after returning from its new tab.
    if (!paused && !dragging && panel.hidden && !document.hidden) {
      scrollRemainder += elapsed * .035;
      const pixels = Math.floor(scrollRemainder);
      scrollRemainder -= pixels;
      viewport.scrollLeft += pixels;
      const width = track.firstElementChild?.getBoundingClientRect().width || 0;
      if (width && viewport.scrollLeft >= width) {
        viewport.scrollLeft -= width;
        const count = currentItems().length;
        if (count > 48) { stripOffset = (stripOffset + 48) % count; pending = true; }
      }
    }
    requestAnimationFrame(animate);
  }
  async function getJSON(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000), cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  async function refreshFeed() {
    // GITHUB_TOKEN commits don't trigger Pages builds: read raw main for hourly data.
    // The deployed copy remains a fallback if GitHub's raw host is unavailable.
    const results = await Promise.allSettled([
      getJSON('/ticker/feed.json'),
      getJSON('https://raw.githubusercontent.com/cityanatomyservices/cityanatomyservices.github.io/main/ticker/feed.json'),
    ]);
    const feeds = results.filter(result => result.status === 'fulfilled').map(result => result.value)
      .filter(feed => Array.isArray(feed.items) && Number.isFinite(Date.parse(feed.generated)))
      .sort((a, b) => Date.parse(b.generated) - Date.parse(a.generated));
    if (feeds.length) {
      news = feeds[0].items.filter(valid); generated = feeds[0].generated; sources = feeds[0].sources || [];
    }
    render();
  }
  async function refreshExplore(force = false) {
    await Promise.all(layers.filter(layer => prefs.enabled.includes(layer.id)).map(async layer => {
      const feed = exploreFeeds.get(layer.id);
      if (exploreBusy.has(layer.id) || !force && feed) return;
      exploreBusy.add(layer.id);
      const results = await Promise.allSettled([
        getJSON(layer.url),
        getJSON(`https://raw.githubusercontent.com/cityanatomyservices/cityanatomyservices.github.io/main${layer.url}`),
      ]);
      const feeds = results.filter(r => r.status === 'fulfilled').map(r => r.value)
        .filter(value => value?.type === 'FeatureCollection' && Array.isArray(value.features) && Number.isFinite(Date.parse(value.generated)))
        .sort((a, b) => Date.parse(b.generated) - Date.parse(a.generated));
      if (feeds.length) { exploreFeeds.set(layer.id, feeds[0]); exploreErrors.delete(layer.id); }
      else exploreErrors.add(layer.id);
      exploreBusy.delete(layer.id);
    }));
    if (!panel.hidden && !$('.ticker-list').contains(document.activeElement)) renderList();
    render();
  }
  let weatherLoading = false;
  async function refreshWeather() {
    if (weatherLoading || !prefs.enabled.includes('weather')) return;
    weatherLoading = true;
    const forecastURL = links.find(item => item.category === 'weather').url;
    const results = await Promise.allSettled([
      getJSON('https://api.weather.gov/gridpoints/EWX/156,91/forecast'),
      getJSON('https://api.weather.gov/alerts/active?point=30.2672,-97.7431'),
    ]);
    const fresh = [];
    if (results[0].status === 'fulfilled') {
      const p = results[0].value.properties;
      if (Date.now() - Date.parse(p?.updateTime) < 24 * 3600e3) {
        for (const period of (p.periods || []).filter(p => Date.parse(p.endTime) > Date.now()).slice(0, 2)) {
          fresh.push({ category: 'weather', title: `${period.name}: ${period.temperature}°${period.temperatureUnit} · ${period.shortForecast}`, source: 'NWS forecast', url: forecastURL, expires: period.endTime });
        }
      }
    } else fresh.push(...weather.filter(item => item.source === 'NWS forecast' && valid(item)));
    if (results[1].status === 'fulfilled') {
      for (const feature of (results[1].value.features || []).slice(0, 3)) {
        const p = feature.properties;
        const expires = p.ends || p.expires;
        if (expires) fresh.unshift({ category: 'weather', title: p.headline || p.event, source: 'NWS alert', url: 'https://www.weather.gov/ewx/', expires });
      }
    } else fresh.push(...weather.filter(item => item.source === 'NWS alert' && valid(item)));
    weather = fresh.filter(valid); weatherLoading = false; render();
  }
  let sportsLoading = false;
  async function refreshSports() {
    if (sportsLoading || !prefs.enabled.includes('sports')) return;
    sportsLoading = true;
    try {
      const { loadSports } = await import('/ticker/sports.js?v=20261027a');
      const results = await Promise.allSettled([
        loadSports(getJSON, sports),
        getJSON('/ticker/scores.json'),
        getJSON('https://raw.githubusercontent.com/cityanatomyservices/cityanatomyservices.github.io/main/ticker/scores.json'),
      ]);
      const snapshots = results.slice(1).filter(r => r.status === 'fulfilled' && Array.isArray(r.value.items))
        .map(r => r.value).sort((a, b) => Date.parse(a.generated) - Date.parse(b.generated));
      const games = new Map();
      for (const snapshot of snapshots) for (const item of snapshot.items.filter(valid)) games.set(item.gameId, item);
      if (results[0].status === 'fulfilled') for (const item of results[0].value.filter(valid)) {
        const snapshot = games.get(item.gameId);
        if (!snapshot || Date.parse(item.checkedAt) > Date.parse(snapshot.checkedAt)) games.set(item.gameId, item);
      }
      sports = [...games.values()].sort((a, b) => a.priority - b.priority || (a.priority === 1 ? b.gameTime - a.gameTime : a.gameTime - b.gameTime));
      // An open sports list needs fresh scores too. Preserve its scroll position.
      if (!panel.hidden && !$('.ticker-list').contains(document.activeElement)) renderList();
      render();
    } catch (_) { sports = sports.filter(valid); }
    finally { sportsLoading = false; }
  }
  for (const stock of stocks) {
    const a = document.createElement('a'); a.textContent = stock.title;
    a.href = `https://www.tradingview.com/symbols/${stock.proName.replace(':', '-')}/`;
    a.target = '_blank'; a.rel = 'noopener noreferrer'; $('.ticker-stock-links').append(a);
  }
  function loadMarkets() {
    if (!prefs.enabled.includes('stocks') || !$('.ticker-markets').open || panel.hidden || $('.ticker-reader').hidden) return;
    const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    if (widgetTheme === theme) return;
    widgetTheme = theme;
    const host = $('.ticker-market-widget');
    host.innerHTML = '<div class="tradingview-widget-container"><div class="tradingview-widget-container__widget"></div><div class="tradingview-widget-copyright"><a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a></div></div>';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js'; script.async = true;
    script.textContent = JSON.stringify({ symbols: stocks, showSymbolLogo: true, isTransparent: true, displayMode: 'compact', colorTheme: theme, locale: 'en', largeChartUrl: '', showChart: false });
    script.onerror = () => { host.textContent = 'Quotes are unavailable here. Use the company links above.'; widgetTheme = null; };
    host.firstElementChild.append(script);
  }
  $('.ticker-markets').addEventListener('toggle', loadMarkets);
  new MutationObserver(loadMarkets).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  showPaused(); render(); requestAnimationFrame(animate);
  refreshFeed(); refreshWeather(); refreshSports(); refreshExplore();
  setInterval(() => { if (!document.hidden) refreshExplore(true); }, 5 * 60e3);
  setInterval(() => { if (!document.hidden) { refreshFeed(); refreshWeather(); } }, 15 * 60e3);
  setInterval(() => {
    news = news.filter(valid); weather = weather.filter(valid); sports = sports.filter(valid);
    // Even when hovering/focused, never leave an expired score labeled LIVE.
    for (const a of root.querySelectorAll('a[data-expires]')) {
      if (Date.parse(a.dataset.expires) <= Date.now()) {
        a.textContent = 'Update expired · open source for the latest';
        delete a.dataset.expires;
      }
    }
    render(); if (!document.hidden) refreshSports();
    if (!panel.hidden && !$('.ticker-list').contains(document.activeElement)) renderList();
  }, 60e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); refreshSports(); refreshExplore(true); } });
})();
