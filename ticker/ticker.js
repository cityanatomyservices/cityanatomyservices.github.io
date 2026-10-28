/* Austin.chat's shared ticker. No API keys, proxies, or publisher HTML in the DOM. */
(() => {
  'use strict';
  const root = document.getElementById('austin-ticker');
  if (!root) return;
  const categories = { headlines: 'Headlines', weather: 'Weather', sports: 'Texas sports', events: 'Events', property: 'Property', city: 'City', transport: 'Getting around', national: 'National / Austin' };
  const links = [
    { category: 'sports', title: 'Austin FC schedule & results', source: 'Austin FC', url: 'https://www.austinfc.com/schedule/' },
    { category: 'property', title: 'Browse Austin homes for sale', source: 'Realtor.com · listing search', url: 'https://www.realtor.com/realestateandhomes-search/Austin_TX' },
    { category: 'property', title: 'Austin homes, condos & open houses', source: 'Realty Austin · listing search', url: 'https://www.realtyaustin.com/listings/city/tx/austin' },
    { category: 'events', title: 'Explore more Austin events', source: 'City of Austin · calendar', url: 'https://www.austintexas.gov/events' },
    { category: 'transport', title: 'Check Austin traffic & road closures', source: 'TxDOT · DriveTexas', url: 'https://drivetexas.org/' },
    { category: 'transport', title: 'Check bus & rail service alerts', source: 'CapMetro', url: 'https://www.capmetro.org/service-alerts' },
    { category: 'weather', title: 'Austin forecast & weather alerts', source: 'National Weather Service', url: 'https://forecast.weather.gov/MapClick.php?lat=30.2672&lon=-97.7431' },
  ];
  const stocks = [
    { proName: 'NASDAQ:TSLA', title: 'Tesla · Austin' },
    { proName: 'NYSE:DELL', title: 'Dell · Round Rock' },
    { proName: 'NASDAQ:SLAB', title: 'Silicon Labs · Austin' },
  ];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches;
  try { if (localStorage.getItem('austin-ticker-paused') === 'true') paused = true; } catch (_) { /* storage optional */ }
  let news = [], weather = [], sports = [], sources = [], generated = null, pending = false;
  let hovering = false, focusing = false, dragging = false, frameTime = 0, scrollRemainder = 0;
  let widgetTheme = null;
  root.innerHTML = `
    <div class="ticker-bar">
      <button type="button" class="ticker-brand" aria-expanded="false" aria-controls="ticker-panel">Austin now</button>
      <div class="ticker-viewport" aria-label="Austin updates; links open in a new tab"><div class="ticker-track"></div></div>
      <button type="button" class="ticker-button ticker-pause" aria-label="Pause ticker"></button>
      <button type="button" class="ticker-button ticker-expand" aria-expanded="false" aria-controls="ticker-panel" aria-label="Browse Austin updates">⌃</button>
    </div>
    <section class="ticker-panel" id="ticker-panel" aria-label="Austin updates" hidden>
      <div class="ticker-panel-header"><h2>Austin now</h2>
        <label>Show <select aria-label="Filter Austin updates"><option value="all">Everything</option>${Object.entries(categories).map(([key, value]) => `<option value="${key}">${value}</option>`).join('')}</select></label>
        <button type="button" class="ticker-button ticker-close" aria-label="Close Austin updates">✕</button>
      </div>
      <p class="ticker-note ticker-updated"></p>
      <details class="ticker-markets"><summary>Austin-area stocks · TSLA / DELL / SLAB</summary>
        <p class="ticker-note">Quotes by TradingView; prices may be delayed. Open a company for its quote timestamp and market status.</p>
        <div class="ticker-stock-links"></div><div class="ticker-market-widget"></div>
      </details>
      <ul class="ticker-list"></ul>
      <details class="ticker-sources"><summary>Sources & updates</summary>
        <p class="ticker-note">Headlines link to the original reporting. The news and events feed checks hourly; scheduled runs can be delayed. Weather checks every 15 minutes. Sports check every minute while this tab is visible. If ESPN blocks direct access, dated snapshots refresh on a 15-minute schedule; scheduled runs and scores may be delayed. Coverage includes Texas NFL, NBA, WNBA, MLB, NHL, MLS (including Austin FC), NWSL teams and Division I college football, men’s/women’s basketball and baseball. Events are upcoming, in-person UT Austin listings marked for the general public; check admission details. Property searches link to current listings, not an MLS feed. National stories must mention Austin or the surrounding area and a federal topic.</p>
        <ul class="ticker-source-list"></ul>
      </details>
    </section>`;
  const $ = selector => root.querySelector(selector);
  const viewport = $('.ticker-viewport'), track = $('.ticker-track'), panel = $('.ticker-panel');
  const pauseButton = $('.ticker-pause'), select = $('select');
  const dateText = (value, time = false) => new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', month: 'short', day: 'numeric', ...(time ? { hour: 'numeric', minute: '2-digit' } : {}),
  }).format(new Date(value));
  function valid(item) {
    try {
      return Boolean(item && typeof item.title === 'string' && item.title.trim() && categories[item.category]
        && ['https:', 'http:'].includes(new URL(item.url).protocol)
        && (!item.expires || Date.parse(item.expires) > Date.now()));
    } catch (_) { return false; }
  }
  function currentItems() {
    // Round-robin categories keeps housing/events from being buried under headlines.
    const all = [...weather, ...sports, ...news, ...links].filter(valid);
    const groups = Object.keys(categories).map(key => all.filter(item => item.category === key));
    const result = [];
    for (let i = 0; groups.some(group => group[i]); i++) {
      for (const group of groups) if (group[i]) result.push(group[i]);
    }
    return result;
  }
  function anchor(item, compact = false) {
    const a = document.createElement('a');
    a.href = item.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    if (item.expires) a.dataset.expires = item.expires;
    if (compact) a.className = 'ticker-item';
    const tag = document.createElement('span'); tag.className = 'ticker-tag'; tag.textContent = categories[item.category];
    const title = document.createElement('span');
    title.textContent = (item.starts ? `${dateText(item.starts, !item.allDay)} · ` : '') + item.title;
    const meta = document.createElement('small');
    meta.textContent = [item.source, item.location, item.published ? dateText(item.published) : null].filter(Boolean).join(' · ');
    a.append(tag, title, meta);
    return a;
  }
  function renderList() {
    const list = $('.ticker-list'); list.replaceChildren();
    const items = currentItems().filter(item => select.value === 'all' || item.category === select.value);
    for (const item of items) { const li = document.createElement('li'); li.append(anchor(item)); list.append(li); }
    if (!items.length) { const li = document.createElement('li'); li.textContent = 'No current updates in this category.'; list.append(li); }
    $('.ticker-updated').textContent = generated
      ? `News & events checked ${dateText(generated, true)} CT${Date.now() - Date.parse(generated) > 3 * 3600e3 ? ' · Updates are delayed' : ''}. Links open in a new tab.`
      : 'Live headlines are temporarily unavailable. Browse the local sources below. Links open in a new tab.';
  }
  function render() {
    // Do not replace a focused link or move the reader's position while browsing.
    if (focusing || hovering || dragging || !panel.hidden) { pending = true; return; }
    pending = false;
    const oldGroup = track.firstElementChild;
    const oldLeft = viewport.scrollLeft % (oldGroup?.offsetWidth || 1);
    const oldLink = oldGroup && [...oldGroup.children].reverse().find(a => a.offsetLeft - oldGroup.offsetLeft <= oldLeft);
    const offset = oldLink ? oldLeft - (oldLink.offsetLeft - oldGroup.offsetLeft) : 0;
    const group = document.createElement('div'); group.className = 'ticker-group';
    currentItems().slice(0, 28).forEach(item => group.append(anchor(item, true)));
    const clone = group.cloneNode(true); clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a').forEach(a => { a.tabIndex = -1; });
    track.replaceChildren(group, clone);
    const matching = oldLink && [...group.children].find(a => a.href === oldLink.href);
    viewport.scrollLeft = matching ? matching.offsetLeft - group.offsetLeft + offset : oldLeft;
    renderList();
    const list = $('.ticker-source-list'); list.replaceChildren();
    for (const source of sources) {
      const li = document.createElement('li');
      li.textContent = `${source.name}${source.ok ? '' : ' · last check failed; unexpired cached items only'}`;
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
    paused = !paused; showPaused();
    try { localStorage.setItem('austin-ticker-paused', String(paused)); } catch (_) { /* optional */ }
  });
  reduced.addEventListener('change', event => { if (event.matches) { paused = true; showPaused(); } });
  function openPanel(open) {
    panel.hidden = !open;
    for (const button of [$('.ticker-brand'), $('.ticker-expand')]) button.setAttribute('aria-expanded', String(open));
    $('.ticker-expand').textContent = open ? '⌄' : '⌃';
    if (open) { renderList(); select.focus(); loadMarkets(); }
    else $('.ticker-expand').focus();
  }
  for (const button of [$('.ticker-brand'), $('.ticker-expand')]) button.addEventListener('click', () => openPanel(panel.hidden));
  $('.ticker-close').addEventListener('click', () => openPanel(false));
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) openPanel(false); });
  select.addEventListener('change', renderList);
  root.addEventListener('mouseenter', () => { hovering = true; });
  root.addEventListener('mouseleave', () => { hovering = false; });
  root.addEventListener('focusin', () => { focusing = true; });
  root.addEventListener('focusout', () => { focusing = false; });
  viewport.addEventListener('pointerdown', () => { dragging = true; });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointercancel', () => { dragging = false; });
  function animate(timestamp) {
    const elapsed = Math.min(timestamp - frameTime, 60); frameTime = timestamp;
    if (pending && !focusing && !hovering && !dragging && panel.hidden) render();
    if (!paused && !hovering && !focusing && !dragging && panel.hidden && !document.hidden) {
      scrollRemainder += elapsed * .035;
      const pixels = Math.floor(scrollRemainder);
      scrollRemainder -= pixels;
      viewport.scrollLeft += pixels;
      const width = track.firstElementChild?.getBoundingClientRect().width || 0;
      if (width && viewport.scrollLeft >= width) viewport.scrollLeft -= width;
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
  async function refreshWeather() {
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
    weather = fresh.filter(valid); render();
  }
  let sportsLoading = false;
  async function refreshSports() {
    if (sportsLoading) return;
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
    if (!$('.ticker-markets').open || panel.hidden) return;
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
  refreshFeed(); refreshWeather(); refreshSports();
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
  }, 60e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); refreshSports(); } });
})();
