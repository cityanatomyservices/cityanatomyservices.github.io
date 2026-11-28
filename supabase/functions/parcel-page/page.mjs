export function mountPage() {
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
  document.addEventListener('parcel-selected', async ({detail: {id, point}}) => {
    if (!panel.hidden) hideHall();
    const parcel = {id, address: '', district: '', loading: true};
    selected = parcel;
    address.textContent = 'Looking up the parcel address…';
    hall.setParcel(parcel, true);
    const site = await window.ParcelAPI.getParcel(id).catch(() => null);
    if (parcel !== selected) return;
    parcel.loading = false;
    parcel.address = site?.metadata?.situs_address?.trim() || '';
    parcel.district = await districtAt(site?.centroid || point).catch(() => '');
    if (parcel !== selected) return;
    address.textContent = [parcel.address || 'Street address unavailable', parcel.district && 'Council District ' + parcel.district].filter(Boolean).join(' · ');
    hall.setParcel(parcel);
  });
}
