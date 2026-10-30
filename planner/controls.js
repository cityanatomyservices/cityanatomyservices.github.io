/* Map display controls; no itinerary writes or chat presence changes. Menus,
   Explore data and selection actions use the home map's existing modules. */
window.PlanControls={init(map,fit,hasPlaces){
  const $=id=>document.getElementById(id),status=document.createElement('p');status.id='map-control-status';status.setAttribute('role','status');document.querySelector('.plan-map-area').append(status);
  map.addSource('satellite',{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,attribution:'Tiles &copy; Esri'});
  const firstRoute=map.getLayer('planner-route-casing')?'planner-route-casing':undefined;
  map.addLayer({id:'satellite',type:'raster',source:'satellite',layout:{visibility:'none'}},firstRoute);
  if(map.getSource('openmaptiles'))map.addLayer({id:'buildings-3d',type:'fill-extrusion',source:'openmaptiles','source-layer':'building',minzoom:13,layout:{visibility:'none'},paint:{'fill-extrusion-color':'#b7c3bc','fill-extrusion-opacity':.8,'fill-extrusion-height':['coalesce',['get','render_height'],6],'fill-extrusion-base':['coalesce',['get','render_min_height'],0]}},firstRoute);
  let tilted=false,satellite=false,gps=null;
  const tilt=on=>{tilted=on;$('ctrlTilt').textContent=on?'2D':'3D';$('ctrlTilt').title=on?'Switch to 2D':'Switch to 3D';$('ctrlTilt').setAttribute('aria-pressed',String(on));$('ctrlTilt').classList.toggle('is-on',on);if(map.getLayer('buildings-3d'))map.setLayoutProperty('buildings-3d','visibility',on?'visible':'none');map.easeTo({pitch:on?55:0,duration:500});};
  tilt(false);$('ctrlTilt').onclick=()=>tilt(!tilted);
  $('ctrlSatellite').title='Satellite imagery';$('ctrlSatellite').setAttribute('aria-label','Satellite imagery');
  $('ctrlSatellite').onclick=()=>{satellite=!satellite;map.setLayoutProperty('satellite','visibility',satellite?'visible':'none');$('ctrlSatellite').setAttribute('aria-pressed',String(satellite));$('ctrlSatellite').classList.toggle('is-on',satellite);};
  $('ctrlExtent').title='Show all planned places';$('ctrlExtent').setAttribute('aria-label','Show all planned places');
  $('ctrlExtent').onclick=()=>{tilt(false);if(hasPlaces())fit();else map.easeTo({center:[-97.7431,30.2672],zoom:10,bearing:0,pitch:0,duration:500});};
  $('ctrlLocate').title='GPS: show my location';$('ctrlLocate').setAttribute('aria-label','GPS: show my location');
  $('ctrlLocate').onclick=()=>{
    if(!navigator.geolocation){status.textContent='Location is unavailable on this device.';return;}
    $('ctrlLocate').disabled=true;status.textContent='Finding your location…';
    navigator.geolocation.getCurrentPosition(p=>{
      const at=[p.coords.longitude,p.coords.latitude];gps?.remove();gps=new maplibregl.Marker({color:'#247dbe'}).setLngLat(at).addTo(map);map.easeTo({center:at,zoom:15,duration:600});status.textContent='';$('ctrlLocate').disabled=false;
    },()=>{status.textContent='Location unavailable or permission declined. You can still browse the map.';$('ctrlLocate').disabled=false;},{enableHighAccuracy:false,timeout:12000,maximumAge:60000});
  };
  window.AustinExplore.init(map);
}};
