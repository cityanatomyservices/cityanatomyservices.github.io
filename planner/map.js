/* Presentation only. The planner works even when WebGL or map tiles fail. */
(() => {
  let map, markers = [], latest = [], fitted = false, routeDirty=true, routeData={type:'FeatureCollection',features:[]}, picking;
  const M = window.PlanModel;
  const coordinates=item=>window.PlanRouting.coordinates(item);
  const fit = () => {
    const points = latest.map(coordinates).filter(Boolean).concat(routeData.features.flatMap(f=>f.geometry.type==='LineString'?f.geometry.coordinates:f.geometry.coordinates.flat()));
    if (!map || !points.length) return;
    const bounds = points.reduce((b,p) => b.extend(p), new maplibregl.LngLatBounds(points[0], points[0]));
    map.fitBounds(bounds, { padding: 65, maxZoom: 15, duration: 500 });
  };
  const focus = id => {
    const item = latest.find(i => i.id === id); if (!map || !coordinates(item)) return;
    window.PlanPanel?.showMap();
    map.easeTo({ center: coordinates(item), zoom: Math.max(14,map.getZoom()), duration: 500 });
    markers.find(m => m.id === id)?.marker.togglePopup();
  };
  function update(items,changedDay = false) {
    if (changedDay) {fitted = false;cancelPick();}
    latest = items; if (!map) return;
    markers.forEach(m => m.marker.remove()); markers = [];
    items.forEach((item,index) => {
      if (!coordinates(item)) return;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'map-stop';
      button.textContent = index + 1; button.setAttribute('aria-label', `${index + 1}. ${item.source.title}`);
      const body = document.createElement('div'), name = document.createElement('strong'), time = document.createElement('p'), edit = document.createElement('button');
      name.textContent = item.source.title;
      time.textContent = item.schedule.start ? `${M.local(item.schedule.start).replace('T',' · ')} CT · ${item.schedule.duration} min` : 'Not scheduled yet';
      edit.textContent = 'Edit this stop'; edit.type = 'button';
      edit.addEventListener('click', () => { window.PlanPanel?.open(); const card = document.querySelector(`[data-item-id="${item.id}"]`); card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); card?.querySelector('input,select')?.focus({ preventScroll: true }); });
      body.className='planner-popup-body';
      const directions=document.createElement('a'),actions=document.createElement('div');actions.className='planner-popup-actions';
      directions.textContent='Directions · Google Maps ↗';directions.href=window.PlanRouting.navigation(item,'google');directions.target='_blank';directions.rel='noopener noreferrer';
      actions.append(directions,edit);body.append(name,time,actions);
      window.AustinComments?.mount(body,item.source);
      const popup=new maplibregl.Popup({ offset: 20, maxWidth:'320px', className:'planner-popup' }).setDOMContent(body);
      window.AustinComments?.followPopup(popup);
      const marker = new maplibregl.Marker({ element: button }).setLngLat(coordinates(item))
        .setPopup(popup).addTo(map);
      markers.push({ id:item.id, marker });
    });
    if (!fitted && items.some(coordinates)) { fit(); fitted = true; }
  }
  function drawRoutes() {
    if(!routeDirty || !map?.isStyleLoaded()) return;
    if(!map.getSource('planner-routes')) {
      map.addSource('planner-routes',{type:'geojson',data:routeData});
      map.addLayer({id:'planner-route-casing',type:'line',source:'planner-routes',paint:{'line-color':'#fff','line-width':7,'line-opacity':0.8},layout:{'line-join':'round','line-cap':'round'}});
      map.addLayer({id:'planner-route-lines',type:'line',source:'planner-routes',paint:{'line-color':'#247dbe','line-width':4,'line-opacity':0.9},layout:{'line-join':'round','line-cap':'round'}});
    } else map.getSource('planner-routes').setData(routeData);
    routeDirty=false;
    document.getElementById('plan-map').setAttribute('aria-label',`Map with ${routeData.features.length} estimated driving journeys`);
  }
  function routes(legs) {
    // The shared Supabase client returns geometry created in the parent window.
    // MapLibre's worker serializer needs objects from this map's own realm.
    routeData=structuredClone({type:'FeatureCollection',features:legs.filter(l=>l.geometry&&['LineString','MultiLineString'].includes(l.geometry.type)).map(l=>({type:'Feature',properties:{},geometry:l.geometry}))});
    routeDirty=true;
    drawRoutes();

  }
  function cancelPick() {
    if(picking&&map) map.off('click',picking);
    picking=null;if(map)map.getCanvas().style.cursor='';
    document.getElementById('map-caption').hidden=true;
  }
  function pick(item,callback) {
    if(!map) return;
    cancelPick();
    const reopen=window.PlanPanel?.isOpen;
    window.PlanPanel?.showMap();
    if(coordinates(item)) map.easeTo({center:coordinates(item),zoom:17,duration:400});
    map.getCanvas().style.cursor='crosshair';
    document.getElementById('map-caption').hidden=false;
    document.getElementById('map-caption').textContent='Click the driving entrance · Esc to cancel';
    document.getElementById('plan-map').scrollIntoView({behavior:'smooth',block:'nearest'});
    picking=event=>{const point=[Number(event.lngLat.lng.toFixed(6)),Number(event.lngLat.lat.toFixed(6))];cancelPick();if(reopen)window.PlanPanel?.open();callback(point);};
    map.on('click',picking);
  }
  document.addEventListener('keydown',event=>{if(event.key==='Escape')cancelPick();});
  try {
    map = new maplibregl.Map({ container:'plan-map', style:'https://tiles.openfreemap.org/styles/positron', center:[-97.7431,30.2672], zoom:11, attributionControl:false });
    new ResizeObserver(()=>map.resize()).observe(document.getElementById('plan-map'));
    map.addControl(new maplibregl.AttributionControl({ compact:true,customAttribution:'Routing © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>' }), 'bottom-right');
    map.addControl(new maplibregl.NavigationControl(), 'top-left');
    map.on('load', async () => {
      window.PlanControls?.init(map,fit,()=>latest.some(coordinates));
      drawRoutes();
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
    map.on('idle', () => { document.getElementById('map-error').hidden = true;drawRoutes(); });
  } catch (_) { document.getElementById('map-error').hidden = false; }
  window.PlanMap = { update, focus, routes, pick, fit };
})();
