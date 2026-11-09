/* Event backgrounds sit below the shared labels, stops, chat zones and routes. */
window.SpecialEventBasemap={init(map,event){
  if(event.basemap!=='stamen-watercolor')return;
  const $=id=>document.getElementById(id),source='event-watercolor';
  let watercolor=true,failed=false;
  const field=document.createElement('fieldset');field.className='map-layers-group event-basemap';
  field.innerHTML='<legend>Background</legend><label for="event-basemap-select">Map style</label><select id="event-basemap-select"><option value="watercolor">Watercolor · Stamen</option><option value="streets">Street map</option></select><p id="event-basemap-note" role="status"></p>';
  $('map-layers-panel').querySelector('.map-layers-group').before(field);
  const select=$('event-basemap-select'),note=$('event-basemap-note');
  const satellite=()=>$('ctrlSatellite').getAttribute('aria-pressed')==='true';
  function draw(){
    if(watercolor&&!map.getSource(source)){
      // A bounded, licensed Austin copy avoids the museum's missing CORS
      // headers. Its historic imagery has no labels; keep current labels.
      map.addSource(source,{type:'raster',tileSize:256,url:'/special-events/tiles/stamen-watercolor-austin/tiles.json?v=20261109b'});
      const before=map.getStyle().layers.find(layer=>layer.type==='symbol'&&layer.source==='openmaptiles')?.id||'satellite';
      // Fade the finite-resolution painting at close street zooms so current
      // roads/buildings underneath stay useful when locating an entrance.
      map.addLayer({id:source,type:'raster',source,layout:{visibility:satellite()?'none':'visible'},paint:{'raster-fade-duration':250,'raster-opacity':['interpolate',['linear'],['zoom'],13,1,16,0.35,18,0.12]}},before);
    }
    if(map.getLayer(source))map.setLayoutProperty(source,'visibility',watercolor&&!satellite()?'visible':'none');
    select.value=watercolor?'watercolor':'streets';
    note.textContent=failed?'Watercolor could not load. Showing the street map; choose Watercolor to retry.':watercolor?'Historic watercolor artwork with current labels. Street detail appears as you zoom in.':'Current streets and place names.';
  }
  select.addEventListener('change',()=>{
    watercolor=select.value==='watercolor';
    if(watercolor&&failed){
      if(map.getLayer(source))map.removeLayer(source);
      if(map.getSource(source))map.removeSource(source);
    }
    failed=false;draw();
  });
  // Satellite remains a separate overlay and does not forget the chosen base.
  $('ctrlSatellite').addEventListener('click',draw);
  map.on('style.load',draw);
  map.on('error',error=>{
    if(error.sourceId!==source||!watercolor)return;
    failed=true;watercolor=false;draw();
  });
  draw();
}};
