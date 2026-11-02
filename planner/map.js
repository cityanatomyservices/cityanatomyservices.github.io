/* Render the selected day on the existing home map. Never create a second map. */
(() => {
  let map, markers = [], latest = [], active = false, coverageStamp = '', routeDirty=true, routeData={type:'FeatureCollection',features:[]}, picking;
  const M = window.PlanModel;
  const coordinates=item=>window.PlanRouting.coordinates(item);
  const fit = () => {
    if(!active)return;
    window.PlanPanel?.showMap();
    const points = latest.map(coordinates).filter(Boolean).concat(routeData.features.flatMap(f=>f.geometry.type==='LineString'?f.geometry.coordinates:f.geometry.coordinates.flat()));
    if (!map || !points.length) return;
    const bounds = points.reduce((b,p) => b.extend(p), new maplibregl.LngLatBounds(points[0], points[0]));
    const panel=document.getElementById('plan-panel');
    const right=window.PlanPanel?.isOpen?panel.getBoundingClientRect().width+96:45;
    map.fitBounds(bounds, { padding:{top:65,bottom:75,left:45,right}, maxZoom:15,duration:500 });
  };
  const focus = id => {
    const item = latest.find(i => i.id === id); if (!map || !active || !coordinates(item)) return;
    window.PlanPanel?.showMap();
    map.easeTo({ center: coordinates(item), zoom: Math.max(14,map.getZoom()), duration: 500 });
    markers.find(m => m.id === id)?.marker.togglePopup();
  };
  function update(items,changedDay = false) {
    if (changedDay) {cancelPick();routeData={type:'FeatureCollection',features:[]};routeDirty=true;drawRoutes();}
    latest = items; if (!map) return;
    markers.forEach(m => m.marker.remove()); markers = [];
    (active?items:[]).forEach((item,index) => {
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
    coverage();
  }
  function drawRoutes() {
    if(!routeDirty || !map) return;
    if(!map.getSource('planner-routes')) {
      if(!map.isStyleLoaded())return;
      map.addSource('planner-routes',{type:'geojson',data:active?routeData:{type:'FeatureCollection',features:[]}});
      map.addLayer({id:'planner-route-casing',type:'line',source:'planner-routes',paint:{'line-color':'#fff','line-width':7,'line-opacity':0.8},layout:{'line-join':'round','line-cap':'round'}});
      map.addLayer({id:'planner-route-lines',type:'line',source:'planner-routes',paint:{'line-color':'#247dbe','line-width':4,'line-opacity':0.9},layout:{'line-join':'round','line-cap':'round'}});
    } else map.getSource('planner-routes').setData(active?routeData:{type:'FeatureCollection',features:[]});
    routeDirty=false;
    map.getContainer().setAttribute('aria-label',active?`Map of selected stops with ${routeData.features.length} estimated driving journeys`:'Explore Austin map');
  }
  function routes(legs) {
    // The shared Supabase client returns geometry created in the parent window.
    // MapLibre's worker serializer needs objects from this map's own realm.
    routeData=structuredClone({type:'FeatureCollection',features:legs.filter(l=>l.geometry&&['LineString','MultiLineString'].includes(l.geometry.type)).map(l=>({type:'Feature',properties:{},geometry:l.geometry}))});
    routeDirty=true;
    drawRoutes();coverage();
  }
  function cancelPick() {
    if(picking&&map) map.off('click',picking);
    picking=null;if(map)map.getCanvas().style.cursor='';
    document.getElementById('map-caption').hidden=true;
  }
  function pick(item,callback) {
    if(!map||!active) return;
    cancelPick();
    const reopen=window.PlanPanel?.isOpen;
    window.PlanPanel?.showMap();
    if(coordinates(item)) map.easeTo({center:coordinates(item),zoom:17,duration:400});
    map.getCanvas().style.cursor='crosshair';
    document.getElementById('map-caption').hidden=false;
    document.getElementById('map-caption').textContent='Click the driving entrance · Esc to cancel';
    map.getContainer().scrollIntoView({behavior:'smooth',block:'nearest'});
    picking=event=>{const point=[Number(event.lngLat.lng.toFixed(6)),Number(event.lngLat.lat.toFixed(6))];cancelPick();if(reopen)window.PlanPanel?.open();callback(point);};
    map.on('click',picking);
  }
  document.addEventListener('keydown',event=>{if(event.key==='Escape')cancelPick();});
  function coverage(){
    if(!map)return;
    const points=active?latest.map(coordinates).filter(Boolean).concat(routeData.features.flatMap(f=>f.geometry.type==='LineString'?f.geometry.coordinates:f.geometry.coordinates.flat())):[];
    const bounds=points.length?[[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]]:null;
    const stamp=JSON.stringify(bounds);if(stamp===coverageStamp)return;coverageStamp=stamp;map.fire('plannerbounds',{bounds});
  }
  function setActive(on){
    active=!!on;if(!active)cancelPick();
    if(!map)return;
    map.fire('plannermode',{active});update(latest);routeDirty=true;drawRoutes();coverage();
  }
  function attach(shared){
    if(map===shared)return;map=shared;
    map.on('style.load',()=>{routeDirty=true;drawRoutes();});
    map.on('idle',drawRoutes);
    setActive(active);
  }
  window.PlanMap={attach,setActive,update,focus,routes,pick,cancelPick,fit,get active(){return active;}};
})();
