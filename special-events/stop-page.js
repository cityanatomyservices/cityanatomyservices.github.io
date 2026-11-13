/* One public stop, using exactly the full tour's GPS gate and live chat room. */
(() => {
  const $=id=>document.getElementById(id),data=JSON.parse($('stop-data').textContent);
  let expired=false,started=false,map,bounds;
  function expire(){
    if(Date.now()<Date.parse(data.expiresAt))return false;
    expired=true;$('stop-active').hidden=true;$('stop-expired').hidden=false;
    window.ChatLocate?.stop();window.ChatEngine?.leave();
    if($('chatwin')){window.ChatPanel?.close();window.ChatPanel?.clear();}
    $('stop-members')?.replaceChildren();return true;
  }
  if(expire())return;
  // Recheck on return from a backgrounded phone; do not rely on deploy timing.
  setTimeout(expire,Math.min(2147483647,Date.parse(data.expiresAt)-Date.now()+20));
  setInterval(expire,10000);document.addEventListener('visibilitychange',expire);
  if($('stop-search')){
    const rows=[...$('stop-directory').children];
    $('stop-search').addEventListener('input',()=>{
      const query=$('stop-search').value.trim().toLocaleLowerCase();let count=0;
      rows.forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase().includes(query);if(!row.hidden)count++;});
      $('stop-count').textContent=`${count} studio ${count===1?'stop':'stops'}`;
    });return;
  }
  const event=window.SpecialEventModel.validate(data),feature=event.features[0],zone=event.chatGeofences.features[0];
  window.MAP_COPY.chat.placeholder='Say something to visitors at this studio…';
  const fit=()=>{if(map&&bounds)map.fitBounds(bounds,{padding:48,maxZoom:18,duration:0});};
  try{
    const polygons=zone.geometry.type==='Polygon'?[zone.geometry.coordinates]:zone.geometry.coordinates;
    bounds=new maplibregl.LngLatBounds();polygons.forEach(p=>p[0].forEach(c=>bounds.extend(c)));
    map=new maplibregl.Map({container:'stop-map',style:window.MAP_CONFIG.basemap,center:feature.geometry.coordinates,zoom:17,attributionControl:true});
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-left');fit();
    map.on('load',()=>{
      map.addSource('stop-zone',{type:'geojson',data:zone});
      map.addLayer({id:'stop-zone-fill',type:'fill',source:'stop-zone',paint:{'fill-color':'#87449a','fill-opacity':0.2}});
      map.addLayer({id:'stop-zone-line',type:'line',source:'stop-zone',paint:{'line-color':'#783888','line-width':3}});
      const pin=document.createElement('div');pin.className='stop-marker';pin.textContent=feature.properties.number;
      new maplibregl.Marker({element:pin}).setLngLat(feature.geometry.coordinates).addTo(map);
    });
    window.StudioStopMap=map;
  }catch(_){$('stop-map').textContent='The map could not load. The studio address is above; you can still try GPS and chat.';}
  $('stop-fit').onclick=fit;
  $('ctrlChat').onclick=()=>{$('stop-chat').scrollIntoView({behavior:'smooth',block:'start'});$('stop-gps').focus({preventScroll:true});};
  function people(list){
    const roster=$('stop-members');roster.replaceChildren();
    for(const person of list){const li=document.createElement('li'),name=document.createElement('span');window.AustinMember.paintIdentity(name,person);li.append(name);if(person.self)li.append(' (you)');roster.append(li);}
  }
  // No neighborhood directory is needed on this page. room.js retains the
  // same event-only participation, presence leases and live-only transport.
  $('stop-gps').onclick=async()=>{
    if(expire())return;
    if(started){window.ChatRoom.locate();return;}
    $('stop-gps').disabled=true;
    try{
      await window.ChatRoom.start({type:'FeatureCollection',features:[]},{event,hooks:{onPeople:people}});
      if(expire())return;
      started=true;$('visibleBtn').disabled=false;$('newName').disabled=false;
      $('stop-gps').textContent='Refresh GPS';
    }catch(_){$('roomLine').textContent='Chat could not connect. Please refresh this page and try again.';}
    finally{if(!expired)$('stop-gps').disabled=false;}
  };
  $('stop-copy').onclick=async()=>{
    const link=document.querySelector('link[rel="canonical"]').href;
    try{await navigator.clipboard.writeText(link);$('stop-share-status').textContent='Link copied.';}
    catch(_){$('stop-share-status').textContent='Copy the link shown below the QR code.';}
  };
})();
