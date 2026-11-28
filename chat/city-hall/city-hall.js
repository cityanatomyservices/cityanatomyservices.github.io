/* City government listings for the parcel workspace. */
window.AustinCityHall = {
  mount(panel, active) {
    const M = window.CityHallModel;
    const categories = [
      { id: 'meetings', title: 'Public Meetings', note: 'Next 7 days · Soonest first', icon: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6 M17 2v6 M3 11h18 M7 15h3 M14 15h3"/>' },
      { id: 'announcements', title: 'Public Announcements', note: 'City news from the last 30 days and upcoming zoning notices · Newest first', icon: '<path d="m3 10 15-6v16L3 14Z M7 16l2 5 M21 9v6"/>' },
      { id: 'permits', title: 'Permits report', note: 'Permits issued in the last 7 days · Newest first', icon: '<path d="M5 3h10l4 4v14H5Z M14 3v5h5 M8 12h8 M8 16h6"/>' },
      { id: 'development', title: 'Development', note: 'Site-plan applications filed in the last 30 days · Newest first', icon: '<path d="M3 21V9h8v12 M11 21V3h10v18 M1 21h22 M6 12h2 M6 16h2 M14 7h4 M14 11h4 M14 15h4"/>' }
    ];
    let feed = null, pending = null, fetched = 0, error = false, limit = 30;
    let parcel = null;
    const state = { scope: 'all', when: 'all', date: '', category: 'meetings', district: '', board: '', query: '', sort: 'default' };
    panel.classList.add('city-hall-content');
    panel.setAttribute('aria-labelledby', 'city-hall-heading');
    panel.innerHTML = `<h3 id="city-hall-heading">City Hall</h3>
      <p class="explore-note city-hall-intro">Browse Austin records or select a parcel on the map.</p>
      <fieldset class="explore-filters"><legend class="explore-sr">Scope and dates</legend>
        <label>Show records for<select data-filter="scope"><option value="all">All Austin</option><option value="parcel" disabled>Selected parcel</option></select></label>
        <label>Time period<select data-filter="when"><option value="all">All available dates</option><option value="now">Now</option><option value="today">Today</option><option value="weekend">This weekend</option><option value="week">This week</option><option value="date">Specific date</option></select></label>
        <label class="date-field" hidden>Date in Austin<input type="date" data-filter="date"></label>
      </fieldset>
      <div class="city-hall-filters"><fieldset class="explore-filters"><legend class="explore-sr">City Hall category and date order</legend>
        <label>City Hall category<select data-filter="category">${categories.map(c => `<option value="${c.id}">${c.title}</option>`).join('')}</select></label>
        <label>Sort by date<select data-filter="sort"><option value="default">Recommended</option><option value="asc">Oldest / soonest first</option><option value="desc">Newest / latest first</option></select></label>
      </fieldset><div class="explore-browse"><label><span class="explore-sr">Search City Hall</span><input type="search" maxlength="100" placeholder="Search meetings, addresses or cases" data-filter="query"></label></div>
      <fieldset class="explore-filters"><legend class="explore-sr">Filter City Hall listings</legend>
        <label>City council district<select data-filter="district"><option value="">All districts</option><option value="citywide">Citywide only</option>${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">District ${i + 1} + citywide</option>`).join('')}</select></label>
        <label class="city-hall-board">Board / commission<select data-filter="board"><option value="">All boards</option></select></label>
      </fieldset><p class="explore-note city-hall-district-note"></p></div>
      <p class="explore-note city-hall-window"></p><p class="explore-note city-hall-status" role="status" aria-live="polite"></p>
      <button type="button" class="explore-more city-hall-retry" hidden>Retry update</button>
      <ul class="explore-results city-hall-results"></ul><button type="button" class="explore-more city-hall-more" hidden>Show more</button>
      <details class="explore-sources"><summary>Sources &amp; freshness</summary><div class="city-hall-sources"></div>
      <p class="explore-note">Times are in Austin time. Meetings come from the city’s calendars and agenda pages; permits, site plans and zoning notices come from Austin Open Data. Check the official agenda for participation, changes or cancellations. Refreshes run every three hours; the city publishes datasets on its own schedule.</p></details>`;
    const $ = selector => panel.querySelector(selector);
    const node = (tag, text, className) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; };
    const dateOptions = {timeZone:'America/Chicago', month:'short', day:'numeric'};
    const dateFormat = new Intl.DateTimeFormat('en-US', dateOptions);
    const timeFormat = new Intl.DateTimeFormat('en-US', {...dateOptions, hour:'numeric', minute:'2-digit'});
    const format = (value, dateOnly = false) => (dateOnly ? dateFormat : timeFormat).format(new Date(value));
    function sourceLink(label, url) {
      const a = node('a', label); a.href = M.safeURL(url); a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
    }
    $('.city-hall-results').id = 'city-hall-list';
    panel.querySelectorAll('[data-filter]').forEach(el => el.addEventListener(el.type === 'search' ? 'input' : 'change', () => {
      state[el.dataset.filter] = el.value;
      if (el.dataset.filter === 'category') { state.board = ''; $('[data-filter=board]').value = ''; }
      if (el.dataset.filter === 'when') {
        state.date = state.when === 'date' ? M.day(Date.now()) : '';
        $('[data-filter=date]').value = state.date;
      }
      if (el.dataset.filter === 'date' && !state.date) {
        state.when = 'all'; $('[data-filter=when]').value = 'all';
      }
      limit = 30; update();
    }));
    $('.city-hall-more').addEventListener('click', () => { limit += 30; update(); });
    $('.city-hall-retry').addEventListener('click', () => load(true));
    function update() {
      if (!active()) return;
      const now = Date.now(), records = feed?.records || [];
      const local = state.scope === 'parcel' && parcel;
      const filtered = local ? records.filter(r => M.forParcel(r, parcel)) : records;
      $('[data-filter=district]').closest('label').hidden = !!local;
      $('.date-field').hidden = state.when !== 'date';
      const matches = M.filter(filtered, local ? { ...state, district: '' } : state, now), selected = categories.find(c => c.id === state.category);
      $('.city-hall-filters').hidden = !selected;
      $('.city-hall-board').hidden = state.category !== 'meetings';
      const boards = [...new Set(records.filter(r => r.category === 'meetings' && M.current(r, now)).map(r => r.board).filter(Boolean))].sort();
      if (state.board && !boards.includes(state.board)) boards.push(state.board);
      const boardSelect = $('[data-filter=board]');
      if (boardSelect.dataset.options !== JSON.stringify(boards)) {
        boardSelect.replaceChildren(new Option('All boards', ''), ...boards.map(b => new Option(b, b)));
        boardSelect.value = state.board; boardSelect.dataset.options = JSON.stringify(boards);
      }
      const sites = state.category === 'permits' || state.category === 'development';
      $('.city-hall-intro').textContent = local
        ? 'Parcel ' + parcel.id + (parcel.address ? ' · ' + parcel.address : '') + (parcel.district ? ' · Council District ' + parcel.district : '')
        : 'Browse city government records across Austin.';
      $('.city-hall-district-note').textContent = local ? (sites
        ? (parcel.address ? 'Showing records with the same published street address.' : parcel.loading ? 'Looking up the parcel address…' : parcel.addressError ? 'Address lookup failed. Select the parcel again or choose All Austin.' : 'A street address is unavailable for this parcel. Choose All Austin to search records.')
        : 'Showing citywide records' + (parcel.district ? ' and records published for District ' + parcel.district : '') + '.' + (parcel.districtError ? ' District boundaries could not load.' : '') + ' Check the official agenda for mention of this parcel.')
        : state.category === 'meetings'
        ? 'Citywide meetings appear in every district. Meeting location does not define its district.'
        : state.district ? 'Includes citywide items. Records without a published district are shown under All districts.' : '';
      const waitingForAddress = local && sites && (parcel.loading || parcel.addressError);
      const period = state.when === 'week' ? (state.category === 'meetings' ? 'Next 7 days.' : 'Posted in the past 7 days; zoning notices use their hearing date.') : state.when === 'now' ? (state.category === 'meetings' ? 'Starting within two hours.' : 'Posted in the past two hours; zoning notices use their hearing date.') : state.when === 'all' ? 'All available dates.' : state.when === 'date' ? 'On ' + state.date + '.' : 'Using the time frame above.';
      $('.city-hall-window').textContent = period + ' Available records: ' + selected.note.split(' · ')[0] + '. Records without a published time match their Austin calendar day.';
      const relevantSources = (feed?.sources || []).filter(s => !selected || s.category === state.category);
      const failed = relevantSources.filter(s => !s.ok || !s.checked || now - Date.parse(s.checked) >= (s.category === 'meetings' ? 12 : 72) * 3600000);
      $('.city-hall-status').textContent = pending && !feed ? 'Loading city updates…' : !feed && error ? 'City updates are unavailable. Try again.' : waitingForAddress ? (parcel.loading ? 'Waiting for the parcel address…' : 'Address matches are unavailable.') : !selected ? 'Choose a category to see city updates.' : `${matches.length} ${state.category === 'meetings' ? (matches.length === 1 ? 'upcoming meeting' : 'upcoming meetings') : (matches.length === 1 ? 'matching listing' : 'matching listings')}${matches.length ? '' : ' · No current listings match these filters.'}`;
      if (feed && (error || failed.length)) $('.city-hall-status').textContent += ' Some sources could not refresh. See Sources & freshness.';
      $('.city-hall-retry').hidden = !error; $('.city-hall-retry').disabled = !!pending;
      const list = $('.city-hall-results'); list.replaceChildren();
      for (const r of matches.slice(0, limit)) {
        const li = node('li'), article = node('article', null, 'city-hall-result');
        const heading = node('h3'); heading.append(sourceLink(r.title, r.url));
        const prefix = r.category === 'permits' ? 'Issued ' : r.category === 'development' ? 'Filed ' : r.category === 'announcements' ? 'Published ' : '';
        article.append(node('p', prefix + format(r.date, r.dateOnly) + (r.category === 'meetings' && r.dateOnly ? ' · Time: see agenda' : ''), 'city-hall-date'), heading);
        const district = r.scope === 'citywide' ? 'Citywide' : r.districts.length ? 'District ' + r.districts.join(', ') : 'District not provided';
        article.append(node('p', [r.board || r.type, district, r.status].filter(Boolean).join(' · '), 'city-hall-meta'));
        if (r.location) article.append(node('p', r.location, 'city-hall-meta'));
        if (r.description || (r.number && !r.title.includes(r.number))) {
          const details = node('details', null, 'city-hall-description'); details.append(node('summary', 'Details'));
          if (r.number) details.append(node('p', 'Case / permit: ' + r.number));
          if (r.description) details.append(node('p', r.description));
          article.append(details);
        }
        article.append(sourceLink(r.category === 'meetings' ? 'Meeting details & agenda ↗' : 'Official city record ↗', r.url));
        li.append(article); list.append(li);
        window.dispatchEvent(new CustomEvent('austin:reminder-target', {detail:{container:li,provider:'city-hall',data:r}}));
        if (r.category === 'meetings') window.PlanSelection.mount(li, window.PlanSources.meeting({
          ...r, checked: feed.sources.find(s => s.id === r.source)?.checked
        }));
      }
      $('.city-hall-more').hidden = matches.length <= limit;
      const sources = $('.city-hall-sources'); sources.replaceChildren();
      for (const s of relevantSources) {
        const p = node('p'); p.append(sourceLink(s.title, s.url), document.createTextNode(' · ' + (s.checked ? 'Checked ' + format(s.checked) : 'Not yet available') + (failed.includes(s) ? ' · Update unavailable; expired records are hidden.' : ''))); sources.append(p);
      }
    }
    async function load(force = false) {
      if (pending || (!force && feed && Date.now() - fetched < 180000)) { update(); return; }
      pending = (async () => {
        const response = await fetch('/chat/data/city-hall.json', { cache: 'no-store', signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error('City Hall unavailable');
        const value = await response.json();
        if (value.version !== 1 || !Array.isArray(value.records) || !Array.isArray(value.sources) || !value.sources.length ||
          !value.records.every(r => typeof r.title === 'string' && M.safeURL(r.url) && Array.isArray(r.districts) && Number.isFinite(Date.parse(r.date)) && Number.isFinite(Date.parse(r.expires))) ||
          !value.sources.every(s => M.safeURL(s.url) && typeof s.title === 'string')) throw new Error('Invalid city feed');
        feed = value; fetched = Date.now(); error = false;
      })();
      update();
      try { await pending; } catch (_) { error = true; } finally { pending = null; update(); }
    }
    const timer = setInterval(() => { if (active()) { update(); if (Date.now() - fetched > 900000) load(); } }, 60000);
    window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
    update();
    return {
      refresh: () => load(),
      setParcel(value, selected = false) {
        parcel = value;
        $('[data-filter=scope] option[value=parcel]').disabled = !value;
        if (selected) {
          state.scope = 'parcel';
          state.category = 'permits';
          state.board = ''; state.query = ''; state.district = '';
          for (const key of ['scope', 'category', 'board', 'query', 'district']) {
            $('[data-filter=' + key + ']').value = state[key];
          }
          limit = 30;
        }
        update();
      }
    };
  }
};
