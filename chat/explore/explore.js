/* Optional map themes. Reading/locating never joins a chat or shares presence. */
window.AustinExplore = {
  init(map) {
    const M = window.ExploreModel, layers = window.EXPLORE_LAYERS;
    const saved = (() => { try { return JSON.parse(localStorage.getItem('austin-explore-v1')) || {}; } catch (_) { return {}; } })();
    const state = { enabled: new Set(Array.isArray(saved.enabled) ? saved.enabled.map(id => id === 'festivals' ? 'events' : id).filter(id => layers.some(l => l.id === id)) : layers.filter(l => l.defaultOn).map(l => l.id)),
      when: ['now', 'tonight', 'today', 'weekend', 'week'].includes(saved.when) ? saved.when : 'week',
      price: ['0', '10', '20'].includes(saved.price) ? saved.price : '20',
      kind: ['all', 'event', 'activity', 'offer'].includes(saved.kind) ? saved.kind : 'all',
      movieType: ['all', 'imax', 'dine-in'].includes(saved.movieType) ? saved.movieType : 'all',
      query: typeof saved.query === 'string' ? saved.query.slice(0, 100) : '',
      where: saved.where === 'map' ? 'map' : 'all', radius: '3', position: null };
    const data = new Map(), busy = new Set(), errors = new Set(), signatures = new Map();
    let matches = [], limit = 30, popup = null, activeIds = [], activeStamp = '', locateAttempt = 0;
    const button = document.getElementById('ctrlExplore');
    const panel = document.createElement('section'); panel.className = 'explore-panel'; panel.id = 'explore-panel'; panel.hidden = true;
    panel.setAttribute('aria-label', 'Explore Austin map layers');
    panel.innerHTML = `<div class="explore-header"><h2>Explore Austin</h2><button class="explore-close" aria-label="Close Explore" type="button">×</button></div>
      <div class="explore-scroll">
      <div class="explore-times" role="group" aria-label="When to explore">
        <button type="button" data-when="now">Now</button><button type="button" data-when="tonight">Tonight</button><button type="button" data-when="weekend">Weekend</button><button type="button" data-when="week">This week</button>
      </div><div class="explore-layers" role="group" aria-label="Choose map categories"></div>
      <div class="explore-browse"><label><span class="explore-sr">Search listings</span><input type="search" data-filter="query" maxlength="100" placeholder="Search names or places"></label>
        <label><span class="explore-sr">Where</span><select data-filter="where"><option value="all">All locations</option><option value="map">This map area</option><option value="near">Near me</option></select></label></div>
      <details class="explore-options"><summary>More filters</summary>
      <fieldset class="explore-filters">
        <label>Date range<select data-filter="when"><option value="now">Now / next 2 hours</option><option value="tonight">Tonight</option><option value="today">Today</option><option value="weekend">This weekend</option><option value="week">Next 7 days</option></select></label>
        <label class="explore-radius" hidden>Distance<select data-filter="radius"><option value="1">Within 1 mile</option><option value="3">Within 3 miles</option><option value="5">Within 5 miles</option></select></label>
        <label data-for-layer="free-cheap">Free & cheap price<select data-filter="price"><option value="0">Free</option><option value="10">$10 or less</option><option value="20">$20 or less</option></select></label>
        <label data-for-layer="free-cheap">Free & cheap type<select data-filter="kind"><option value="all">Everything</option><option value="event">Events</option><option value="activity">Activities</option><option value="offer">Local offers</option></select></label>
        <label data-for-layer="movies" hidden>Movie theaters<select data-filter="movieType"><option value="all">All theaters</option><option value="imax">IMAX</option><option value="dine-in">Dine-in & drinks</option></select></label>
      </fieldset></details>
      <p class="explore-note explore-location" role="status"></p>
      <p class="explore-note explore-time-note"></p>
      <p class="explore-note explore-count" role="status"></p><ul class="explore-results"></ul>
      <button type="button" class="explore-more" hidden>Show more</button>
      <details class="explore-sources"><summary>Sources & freshness</summary><div class="explore-freshness"></div>
      <p class="explore-note">Times are in Austin time. Check the organizer before going: reservations, age limits, parking or extra activities may cost more. Free & cheap requires a confirmed admission price. Movie and event prices vary; follow the source for tickets and availability. Only published schedules are listed. Report corrections through <a href="/contact/" target="_blank" rel="noopener">Contact</a>.</p></details></div>`;
    document.querySelector('.page').append(panel);
    const $ = s => panel.querySelector(s);
    function save() {
      try { localStorage.setItem('austin-explore-v1', JSON.stringify({ ...state, enabled: [...state.enabled], position: undefined })); } catch (_) { /* storage optional */ }
    }
    function open(on, returnFocus = true) {
      panel.hidden = !on; button.setAttribute('aria-expanded', String(on));
      if (on) window.AustinChatCard?.close();
      else if (returnFocus) button.focus();
    }
    window.AustinExplore.close = () => open(false, false);
    button.addEventListener('click', () => open(panel.hidden));
    $('.explore-close').addEventListener('click', () => open(false));
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') open(false); });
    const format = (value, dateOnly = false) => new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago', month: 'short', day: 'numeric', ...(dateOnly ? {} : { hour: 'numeric', minute: '2-digit' })
    }).format(new Date(value));
    const clock = value => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
    function timing(p) {
      if (p.kind === 'park') return p.parkType ? `${p.parkType} park · Check posted hours` : 'Park · Check posted hours';
      if (p.kind === 'movie') return `${format(p.start, true)} · ${[...new Set(p.showtimes.map(s => clock(s.start)))].join(', ')}`;
      if (p.allDay) return `${format(p.start, true)} · All day`;
      return `${format(p.start)}${p.endKnown === false ? '' : '–' + (M.dayKey(p.start) === M.dayKey(p.end) ? clock(p.end) : format(p.end))}`;
    }
    function node(tag, text, className) {
      const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el;
    }
    function link(text, url) {
      const a = node('a', text); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
    }
    const icons = {
      'free-cheap': '<path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7.5" cy="7.5" r="1"/>',
      movies: '<path d="M3 9h18v12H3Z M3 9 2 4l18-3 1 5Z M7 3l4 4 M14 2l4 4"/>',
      'live-music': '<path d="M10 17V5l10-2v12 M10 9l10-2"/><ellipse cx="6.5" cy="18" rx="3.5" ry="3"/><ellipse cx="16.5" cy="16" rx="3.5" ry="3"/>',
      'live-comedy': '<rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3 M8 22h8"/>',
      'pop-up-markets': '<path d="M4 7h16l1 14H3Z M8 9V6a4 4 0 0 1 8 0v3"/>',
      events: '<path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z M15 5v2 M15 10v4 M15 17v2"/>'
    };
    function closePopup() { if (popup) popup.remove(); popup = null; activeIds = []; activeStamp = ''; }
    const stamp = items => JSON.stringify(items.map(f => f.properties));
    function showItems(items, at) {
      closePopup();
      const body = node('div', undefined, 'explore-popup-body');
      body.append(node('h3', items.length > 1 ? items[0].properties.venue : items[0].properties.title));
      if (items.length > 1) body.append(node('p', `${items.length} matching listings here`));
      for (const item of items) {
        const p = item.properties, article = node('article');
        if (items.length > 1) article.append(node('h4', p.title));
        article.append(node('p', p.kind === 'park' ? timing(p) : p.kind === 'movie' ? `${format(p.start, true)} · ${p.priceLabel}` : `${p.priceLabel} · ${timing(p)}`));
        article.append(node('p', [p.venue, p.address].filter(Boolean).join(' · ')));
        if (p.description) article.append(node('p', p.description));
        if (p.conditions) article.append(node('p', p.conditions));
        if (p.kind === 'movie') {
          const times = node('div', undefined, 'explore-showtimes');
          for (const show of p.showtimes) times.append(link(`${clock(show.start)}${show.format ? ' · ' + show.format : ''} ↗`, show.url));
          article.append(times);
        }
        const actions = node('div', undefined, 'explore-popup-links');
        const destination = p.kind === 'park' ? encodeURIComponent(`${p.title}, ${p.address}`) : `${at[1]},${at[0]}`;
        actions.append(link(p.kind === 'park' ? 'City park information ↗' : 'Details ↗', p.url));
        if (p.ticketsUrl && /^https?:\/\//.test(p.ticketsUrl)) actions.append(link('Tickets ↗', p.ticketsUrl));
        actions.append(link('Directions ↗', `https://www.google.com/maps/dir/?api=1&destination=${destination}`), link('Report a change ↗', '/contact/'));
        article.append(actions, node('p', `${p.source} · Checked ${format(p.checked)} CT`));
        window.dispatchEvent(new CustomEvent('austin:planner-target', { detail: { container: article, provider: 'explore', data: item } }));
        body.append(article);
      }
      popup = new maplibregl.Popup({ maxWidth: '310px', offset: 14, className: 'explore-popup' }).setLngLat(at).setDOMContent(body).addTo(map);
      activeIds = items.map(f => f.properties.id);
      activeStamp = stamp(items);
    }
    function refreshList() {
      const list = $('.explore-results'); list.replaceChildren();
      const on = state.enabled.size > 0;
      $('.explore-filters').disabled = !on;
      for (const el of panel.querySelectorAll('[data-when]')) el.setAttribute('aria-pressed', String(state.when === el.dataset.when));
      $('[data-filter="when"]').value = state.when;
      $('.explore-time-note').textContent = state.when === 'now' ? 'Happening now or starting within two hours.' : state.when === 'tonight' ? 'Tonight: 6 PM–3 AM, Austin time.' : '';
      for (const input of panel.querySelectorAll('[data-layer]')) {
        input.closest('.explore-layer').classList.toggle('is-selected', input.checked);
        const count = input.closest('.explore-layer').querySelector('.explore-tile-count');
        count.textContent = input.checked && data.has(input.dataset.layer) ? matches.filter(f => f.properties.exploreLayer === input.dataset.layer).length : '';
      }
      for (const el of panel.querySelectorAll('[data-for-layer]')) el.hidden = !state.enabled.has(el.dataset.forLayer);
      button.classList.toggle('is-on', on);
      const suffix = state.where === 'near' ? ` within ${state.radius} miles` : state.where === 'map' ? ' in this map area' : ' across the Austin area';
      const loading = [...busy].some(id => state.enabled.has(id));
      $('.explore-count').textContent = !on ? 'Turn on a layer to explore.' : matches.length
        ? `${matches.length} matching listings${suffix}${loading ? ' · Updating…' : ''}`
        : loading ? 'Loading listings…' : [...state.enabled].every(id => errors.has(id) && !data.has(id)) ? 'Listings are unavailable right now. Please try again shortly.'
        : state.where === 'near' && !state.position ? 'Choose a location to see nearby results.'
        : 'No matching listings. Try another time, category or area.';
      if (on && [...state.enabled].some(id => errors.has(id))) $('.explore-count').textContent += ' · Some categories could not refresh; see Sources.';
      for (const f of matches.slice(0, limit)) {
        const p = f.properties, li = node('li'), b = node('button', undefined, 'explore-result'); b.type = 'button';
        b.dataset.kind = p.kind;
        const category = layers.find(l => l.id === p.exploreLayer);
        if (category) { const badge = node('small', category.title, 'explore-category'); badge.style.color = category.color || '#0067c5'; b.append(badge); }
        b.append(node('strong', p.title), node('small', ['movie','park'].includes(p.kind) ? timing(p) : `${p.priceLabel} · ${timing(p)}`, 'explore-price'), node('small', p.kind === 'park' ? p.address : p.venue));
        if (state.where === 'near' && state.position) b.append(node('small', `${M.miles(state.position, f.geometry.coordinates).toFixed(1)} miles away · straight-line distance`));
        b.addEventListener('click', () => {
          open(false);
          map.easeTo({ center: f.geometry.coordinates, zoom: Math.max(15, map.getZoom()), duration: 600 });
          showItems([f], f.geometry.coordinates);
        });
        li.append(b); list.append(li);
        window.dispatchEvent(new CustomEvent('austin:planner-target', { detail: { container: li, provider: 'explore', data: f } }));
      }
      $('.explore-more').hidden = matches.length <= limit;
      const freshness = $('.explore-freshness'); freshness.replaceChildren();
      for (const layer of layers.filter(l => state.enabled.has(l.id))) {
        const feed = data.get(layer.id);
        if (feed) {
          const delayed = Date.now() - Date.parse(feed.generated) > (layer.timeIndependent ? 72 : 6) * 3600e3;
          freshness.append(node('p', `${layer.title}: updated ${format(feed.generated)} CT${delayed ? ' · Refresh delayed' : ''}`, 'explore-note'));
          const ul = node('ul');
          for (const source of feed.sources || []) {
            const li = node('li');
            li.append(source.url && /^https?:\/\//.test(source.url) ? link(source.name, source.url) : node('span', source.name));
            li.append(document.createTextNode(`: ${source.count} entries${!source.ok || source.failures ? ' · Some updates unavailable' : ''}`)); ul.append(li);
          }
          freshness.append(ul);
        }
        if (errors.has(layer.id)) freshness.append(node('p', `${layer.title}: refresh unavailable. Only unexpired previous items are shown.`, 'explore-note'));
      }
      freshness.append(node('p', 'Events and movies refresh every 3 hours. Runs may be delayed. Expired events disappear. Unknown event end times are not guessed. Curated activities expire on their review deadline.', 'explore-note'));
    }
    let coverageStamp = '';
    function update() {
      // Use valid records in enabled layers, before area/search/time filters.
      // Otherwise "This map area" could shrink the pan limit as you move it.
      const points = layers.filter(l => state.enabled.has(l.id))
        .flatMap(l => (data.get(l.id)?.features || []).filter(f => M.valid(f)).map(f => f.geometry.coordinates));
      const coverage = points.length ? [
        [Math.min(...points.map(c => c[0])), Math.min(...points.map(c => c[1]))],
        [Math.max(...points.map(c => c[0])), Math.max(...points.map(c => c[1]))]
      ] : null;
      const nextCoverage = JSON.stringify(coverage);
      if (coverageStamp !== nextCoverage) { coverageStamp = nextCoverage; map.fire('explorebounds', { bounds: coverage }); }
      const b = map.getBounds();
      const options = { ...state, bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] };
      matches = [];
      for (const layer of layers) {
        const features = state.enabled.has(layer.id) ? M.filter(data.get(layer.id)?.features || [], options).map(f => ({ ...f, properties: { ...f.properties, exploreLayer: layer.id } })) : [];
        matches.push(...features);
      }
      // A public UT concert may also qualify for Free & cheap. Show its more
      // specific selected category once, in both the map and combined list.
      matches = M.filter([...new Map(matches.map(f => [f.properties.id, f])).values()], options);
      for (const layer of layers) {
        const features = matches.filter(f => f.properties.exploreLayer === layer.id);
        const signature = features.map(f => f.properties.id).join('|');
        if (signatures.get(layer.id) !== signature) {
          map.getSource(`explore-${layer.id}`).setData(M.venues(features)); signatures.set(layer.id, signature);
        }
      }
      if (activeIds.some(id => !matches.some(f => f.properties.id === id))) closePopup();
      else if (popup?.isOpen()) {
        const items = matches.filter(f => activeIds.includes(f.properties.id));
        if (activeStamp !== stamp(items)) showItems(items, popup.getLngLat().toArray());
      }
      refreshList();
    }
    async function getFeed(url) {
      const response = await fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const feed = await response.json();
      if (feed.type !== 'FeatureCollection' || !Array.isArray(feed.features) || !Number.isFinite(Date.parse(feed.generated))) throw new Error('Invalid map data');
      return feed;
    }
    async function load(layer) {
      if (busy.has(layer.id)) return;
      busy.add(layer.id); update();
      const results = await Promise.allSettled([getFeed(layer.url), getFeed(`https://raw.githubusercontent.com/cityanatomyservices/cityanatomyservices.github.io/main${layer.url}`)]);
      const feeds = results.filter(r => r.status === 'fulfilled').map(r => r.value).sort((a, b) => Date.parse(b.generated) - Date.parse(a.generated));
      if (feeds.length) { data.set(layer.id, feeds[0]); errors.delete(layer.id); signatures.delete(layer.id); }
      else errors.add(layer.id);
      busy.delete(layer.id); update();
    }
    for (const layer of layers) {
      const source = `explore-${layer.id}`;
      const label = node('label', undefined, 'explore-layer'), checkbox = document.createElement('input');
      label.title = layer.description;
      checkbox.type = 'checkbox'; checkbox.checked = state.enabled.has(layer.id); checkbox.dataset.layer = layer.id;
      const icon = node('span', undefined, 'explore-tile-icon'); icon.setAttribute('aria-hidden','true');
      icon.style.color = layer.color || '#ab6b00';
      icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[layer.id] || icons.events}</svg>`;
      const text = node('strong', layer.title), count = node('span', '', 'explore-tile-count'), tick = node('span', '✓', 'explore-tile-check'); tick.setAttribute('aria-hidden','true');
      label.append(checkbox, icon, text, count, tick); $('.explore-layers').append(label);
      checkbox.addEventListener('change', () => { checkbox.checked ? state.enabled.add(layer.id) : state.enabled.delete(layer.id); save(); limit = 30; update(); if (checkbox.checked) load(layer); });
      map.addSource(source, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, cluster: true, clusterRadius: 42, clusterMaxZoom: 14, clusterProperties: { eventCount: ['+', ['get', 'eventCount']] } });
      map.addLayer({ id: source + '-clusters', type: 'circle', source, filter: ['has', 'point_count'], paint: { 'circle-color': layer.color || '#0067c5', 'circle-radius': 19, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
      map.addLayer({ id: source + '-counts', type: 'symbol', source, filter: ['has', 'point_count'], layout: { 'text-field': ['to-string', ['get', 'eventCount']], 'text-size': 12, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true }, paint: { 'text-color': '#fff' } });
      map.addLayer({ id: source + '-points', type: 'circle', source, filter: ['!', ['has', 'point_count']], paint: { 'circle-color': ['match', ['get', 'kind'], 'activity', '#087f70', 'offer', '#9a4b00', 'movie', '#7844a8', layer.color || '#0067c5'], 'circle-radius': 12, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
      map.addLayer({ id: source + '-labels', type: 'symbol', source, filter: ['!', ['has', 'point_count']], layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-allow-overlap': true }, paint: { 'text-color': '#fff' } });
      map.on('click', source + '-clusters', async e => {
        const f = e.features[0];
        try { const zoom = await map.getSource(source).getClusterExpansionZoom(f.properties.cluster_id); map.easeTo({ center: f.geometry.coordinates, zoom, duration: 500 }); } catch (_) { /* source may have refreshed */ }
      });
      map.on('click', source + '-points', e => {
        const f = e.features[0], key = f.geometry.coordinates.map(n => n.toFixed(5)).join(',');
        // Several selected categories can share a venue; expose all of them
        // even when one colored marker is drawn above another.
        const items = matches.filter(item => item.geometry.coordinates.map(n => n.toFixed(5)).join(',') === key);
        if (items.length) showItems(items, f.geometry.coordinates);
      });
      for (const id of [source + '-clusters', source + '-points']) {
        map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
      }
    }
    for (const choice of panel.querySelectorAll('[data-when]')) choice.addEventListener('click', () => {
      state.when = choice.dataset.when; limit = 30; save(); update();
    });
    for (const select of panel.querySelectorAll('[data-filter]')) {
      select.value = state[select.dataset.filter];
      select.addEventListener(select.tagName === 'INPUT' ? 'input' : 'change', () => {
        state[select.dataset.filter] = select.value; limit = 30; save();
        $('.explore-radius').hidden = state.where !== 'near';
        if (select.dataset.filter === 'where') {
          locateAttempt++;
          $('.explore-location').textContent = '';
          if (state.where === 'near') {
            $('.explore-options').open = true;
            const attempt = locateAttempt;
            if (!navigator.geolocation) $('.explore-location').textContent = 'Location is unavailable. Choose This map area instead.';
            else {
              $('.explore-location').textContent = 'Finding your location… This does not make you visible in chat.';
              navigator.geolocation.getCurrentPosition(position => {
                if (attempt !== locateAttempt || state.where !== 'near') return;
                state.position = [position.coords.longitude, position.coords.latitude];
                $('.explore-location').textContent = 'Distance uses your location only on this device.';
                map.easeTo({ center: state.position, zoom: 12, duration: 600 }); update();
              }, () => {
                if (attempt !== locateAttempt) return;
                state.position = null; $('.explore-location').textContent = 'Location unavailable or permission declined. Choose This map area to browse without it.'; update();
              }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
            }
          }
        }
        update();
      });
    }
    $('.explore-more').addEventListener('click', () => { limit += 30; refreshList(); });
    map.on('moveend', () => { if (state.where === 'map') update(); });
    update(); layers.filter(l => state.enabled.has(l.id)).forEach(load);
    setInterval(update, 60000);
    setInterval(() => { if (!document.hidden) layers.filter(l => state.enabled.has(l.id)).forEach(load); }, 5 * 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { update(); layers.filter(l => state.enabled.has(l.id)).forEach(load); } });
    // Expose read-only diagnostics for browser checks, not location/presence writes.
    window.austinExplore = { refresh: update, get visibleItems() { return matches; } };
  }
};
