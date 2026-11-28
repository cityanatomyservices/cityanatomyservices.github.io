export function mountPage(mountMap) {
  const CFG = window.PARCELS_CONFIG;
  const { createClient } = window.supabase;
  const sb = createClient(CFG.supabase.url, CFG.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'austin-parcel-public-reads' }
  });
  window.ParcelAPI.init(sb);

  window.ParcelDrawer.mount();

  const panel = document.getElementById('city-hall-panel');
  const toggle = document.getElementById('ctrlCityHall');
  const reportButton = document.getElementById('parcel-city');
  const close = document.getElementById('hall-close');
  const address = document.getElementById('parcel-address');
  const hall = window.AustinCityHall.mount(document.getElementById('city-content'), () => !panel.hidden);
  let selected, boundaries, opener;

  function showHall(source) {
    opener = source;
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    document.getElementById('drawer').inert = true;
    close.focus();
    hall.refresh();
  }
  function hideHall() {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    const drawer = document.getElementById('drawer');
    drawer.inert = !drawer.classList.contains('is-open');
    (opener === reportButton && drawer.inert ? toggle : opener || toggle).focus();
  }
  toggle.addEventListener('click', () => panel.hidden ? showHall(toggle) : hideHall());
  reportButton.addEventListener('click', () => {
    hall.setParcel(selected, true);
    showHall(reportButton);
  });
  close.addEventListener('click', hideHall);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.stopImmediatePropagation();
      hideHall();
    }
  }, true);

  async function districtAt(point) {
    if (!boundaries) {
      boundaries = fetch('/budget/data/council_districts.geojson', {signal: AbortSignal.timeout(15000)})
        .then(response => {
          if (!response.ok) throw Error('District boundaries unavailable');
          return response.json();
        }).catch(error => { boundaries = null; throw error; });
    }
    const feature = window.ChatLocate.find(await boundaries, point);
    return String(feature?.properties.district_number || '');
  }
  const validPoint = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90;
  let locate = null;
  try {
    locate = mountMap(selectParcel);
  } catch (error) {
    console.warn('[parcels] interactive map unavailable', error);
    const filters = document.getElementById('filter-panel');
    if (filters.classList.contains('is-collapsed')) document.getElementById('filter-toggle').click();
    for (const control of filters.querySelectorAll('.filter-group, #filter-clear, #filter-search, #filter-result, #filter-toggle')) control.hidden = true;
    document.getElementById('map').hidden = true;
  }

  function publishContext(parcel) {
    if (parcel !== selected) return;
    const street = parcel.address || (parcel.loading ? 'Looking up the parcel address…'
      : parcel.addressError ? 'Address lookup failed. Select this parcel again to retry.' : 'Street address unavailable');
    address.textContent = [street, parcel.district && 'Council District ' + parcel.district,
      parcel.districtError && 'Council district unavailable'].filter(Boolean).join(' · ');
    hall.setParcel(parcel);
  }
  async function selectParcel(id, point, row, trigger) {
    if (!panel.hidden) hideHall();
    const parcel = {id, address:'', district:'', loading:!row};
    selected = parcel;
    window.ParcelDrawer.openForParcel(id, trigger);
    hall.setParcel(parcel, true);
    address.textContent = 'Looking up the parcel address…';
    if (!row) {
      try {
        row = await window.ParcelAPI.getParcel(id);
        if (validPoint(row?.centroid)) point = row.centroid;
      } catch { parcel.addressError = true; }
    }
    if (parcel !== selected) return;
    parcel.loading = false;
    parcel.address = row?.metadata?.situs_address?.trim() || '';
    publishContext(parcel);
    if (!validPoint(point)) return;
    try { parcel.district = await districtAt(point); }
    catch { parcel.districtError = true; }
    publishContext(parcel);
  }
  const form = document.getElementById('address-search');
  const matches = document.getElementById('address-matches');
  const status = document.getElementById('address-status');
  const instructions = locate ? 'Search by address or select a parcel on the map.' : 'The map is unavailable. Search by address to open a parcel report.';
  status.textContent = instructions;
  let lookup = 0;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const attempt = ++lookup;
    matches.replaceChildren();
    status.textContent = 'Searching parcel addresses…';
    try {
      const rows = await window.ParcelAPI.findAddress(document.getElementById('site-address').value);
      if (attempt !== lookup) return;
      status.textContent = rows.length > 10 ? 'First 10 matches. Add more of the address to narrow the results.'
        : rows.length ? 'Select an address to open its parcel report.' : 'No matching address. Try the street number and the first part of the street name.';
      for (const row of rows.slice(0, 10)) {
        const item = document.createElement('li'), button = document.createElement('button');
        button.type = 'button';
        button.textContent = row.metadata.situs_address + ' · Parcel ' + row.parcel_id;
        button.onclick = () => {
          const point = row.centroid?.coordinates;
          if (validPoint(point)) locate?.(row.parcel_id, point);
          if (locate && matchMedia('(max-width: 600px)').matches && !document.getElementById('filter-panel').classList.contains('is-collapsed')) document.getElementById('filter-toggle').click();
          selectParcel(row.parcel_id, point, row, button);
        };
        item.append(button); matches.append(item);
      }
    } catch (error) { if (attempt === lookup) status.textContent = error.message; }
  });
  document.getElementById('filter-clear').addEventListener('click', () => {
    form.reset();
    form.dispatchEvent(new Event('input'));
  });
  form.addEventListener('input', () => {
    ++lookup; matches.replaceChildren(); status.textContent = instructions;
  });

}
