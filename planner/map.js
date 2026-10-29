/* Presentation only. The planner works even when WebGL or map tiles fail. */
(() => {
  let map, markers = [], latest = [], fitted = false;
  const M = window.PlanModel;
  const fit = () => {
    const points = latest.map(i => i.source.coordinates).filter(Boolean);
    if (!map || !points.length) return;
    const bounds = points.reduce((b,p) => b.extend(p), new maplibregl.LngLatBounds(points[0], points[0]));
    map.fitBounds(bounds, { padding: 65, maxZoom: 15, duration: 500 });
  };
  const focus = id => {
    const item = latest.find(i => i.id === id); if (!map || !item?.source.coordinates) return;
    map.easeTo({ center: item.source.coordinates, zoom: Math.max(14,map.getZoom()), duration: 500 });
    markers.find(m => m.id === id)?.marker.togglePopup();
  };
  function update(items) {
    latest = items; if (!map) return;
    markers.forEach(m => m.marker.remove()); markers = [];
    items.forEach((item,index) => {
      if (!item.source.coordinates) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'map-stop';
      button.textContent = index + 1; button.setAttribute('aria-label', `${index + 1}. ${item.source.title}`);
      const body = document.createElement('div'), name = document.createElement('strong'), time = document.createElement('p'), edit = document.createElement('button');
      name.textContent = item.source.title;
      time.textContent = item.schedule.start ? `${M.local(item.schedule.start).replace('T',' · ')} CT · ${item.schedule.duration} min` : 'Not scheduled yet';
      edit.textContent = 'Edit this stop'; edit.type = 'button';
      edit.addEventListener('click', () => { const card = document.querySelector(`[data-item-id="${item.id}"]`); card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); card?.querySelector('input,select')?.focus({ preventScroll: true }); });
      body.append(name,time,edit);
      const marker = new maplibregl.Marker({ element: button }).setLngLat(item.source.coordinates)
        .setPopup(new maplibregl.Popup({ offset: 20 }).setDOMContent(body)).addTo(map);
      markers.push({ id:item.id, marker });
    });
    if (!fitted && items.some(i => i.source.coordinates)) { fit(); fitted = true; }
  }
  try {
    map = new maplibregl.Map({ container:'plan-map', style:'https://tiles.openfreemap.org/styles/positron', center:[-97.7431,30.2672], zoom:11, attributionControl:false });
    map.addControl(new maplibregl.AttributionControl({ compact:true }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.on('load', async () => {
      try {
        const response = await fetch('/chat/data/geofences.geojson');
        if (!response.ok) return;
        const data = await response.json();
        const colors = ['#4e79a7','#f28e2b','#59a14f','#e15759','#76b7b2','#edc948','#b07aa1','#ff9da7'];
        data.features.forEach((f,i) => { f.properties.planColor = colors[i % colors.length]; });
        map.addSource('neighborhoods',{ type:'geojson',data });
        map.addLayer({ id:'neighborhood-fill',type:'fill',source:'neighborhoods',paint:{'fill-color':['get','planColor'],'fill-opacity':.18} });
        map.addLayer({ id:'neighborhood-lines',type:'line',source:'neighborhoods',paint:{'line-color':'#fff','line-width':1} });
      } catch (_) { /* selected markers and itinerary remain usable */ }
    });
    map.on('error', () => { if (!map.isStyleLoaded()) document.getElementById('map-error').hidden = false; });
    map.on('idle', () => { document.getElementById('map-error').hidden = true; });
  } catch (_) { document.getElementById('map-error').hidden = false; }
  document.getElementById('fit-plan').addEventListener('click', fit);
  window.PlanMap = { update, focus };
})();
