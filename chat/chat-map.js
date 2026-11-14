/* The main Chat map owns only live chat circles and a device-local location dot. */
(() => {
  let active=false,map,generation=0,timer,expiry,popup,position=null,circles=[],model,loading=false,clockOffset=0;
  const empty=()=>({type:'FeatureCollection',features:[]});
  const status=text=>{const el=document.getElementById('chat-map-status');if(el)el.textContent=text;};
  const circleStatus=text=>{const el=document.getElementById('chat-circles-status');if(el)el.textContent=text;};
  function draw(){
    if(!map||!model)return;
    if(!map.getSource('chat-circles')){
      if(!map.isStyleLoaded())return;
      map.addSource('chat-circles',{type:'geojson',data:empty()});
      map.addLayer({id:'chat-circle-fill',type:'fill',source:'chat-circles',paint:{'fill-color':'#007c75','fill-opacity':.2}});
      map.addLayer({id:'chat-circle-edge',type:'line',source:'chat-circles',paint:{'line-color':'#007c75','line-width':3}});
      map.addLayer({id:'chat-circle-label',type:'symbol',source:'chat-circles',layout:{'text-field':['get','name'],'text-font':['Noto Sans Bold'],'text-size':13,'text-max-width':14},paint:{'text-color':'#005a55','text-halo-color':'#ffffff','text-halo-width':2}});
      map.addSource('chat-location',{type:'geojson',data:empty()});
      map.addLayer({id:'chat-location-dot',type:'circle',source:'chat-location',paint:{'circle-radius':7,'circle-color':'#1976d2','circle-stroke-color':'#ffffff','circle-stroke-width':3}});
    }
    const now=Date.now()+clockOffset,shown=active&&!document.hidden?circles.filter(c=>c.active!==false&&(!c.startsAt||Date.parse(c.startsAt)<=now)&&(!c.activeUntil||Date.parse(c.activeUntil)>now)):[];
    circleStatus(active?(shown.length?shown.length+' active geofence '+(shown.length===1?'chat':'chats')+' available.':'No geofence chats are active right now.'):'');
    map.getSource('chat-circles').setData({type:'FeatureCollection',features:shown.map(c=>({...model.circle(c),properties:{id:c.id,name:c.name}}))});
    map.getSource('chat-location').setData(active&&position?{type:'Feature',properties:{},geometry:{type:'Point',coordinates:position}}:empty());
    clearTimeout(expiry);const ends=shown.map(c=>Date.parse(c.activeUntil)).filter(Number.isFinite);
    if(ends.length)expiry=setTimeout(()=>{popup?.remove();draw();refresh();},Math.max(1,Math.min(2147483647,Math.min(...ends)-now+20)));
  }
  async function refresh(){
    if(!active||!map||!model||loading||document.hidden)return;const run=generation;loading=true;
    try{
      const {data,error}=await window.AustinSession.client().rpc('geofence_map');
      if(run!==generation||!active)return;if(error)throw error;
      if(!Array.isArray(data?.circles))throw Error('Invalid circle list');
      clockOffset=Number.isFinite(Date.parse(data.serverNow))?Date.parse(data.serverNow)-Date.now():0;
      circles=data.circles.filter(c=>model.validId(c.id)&&Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)&&c.diameter>=10&&c.diameter<=500);
      draw();
    }catch{if(run===generation){circles=[];draw();circleStatus('Chat circles could not load. Use Chat again to retry.');}}
    finally{loading=false;if(run!==generation&&active)refresh();}
  }
  async function locate(){
    if(!active||!map)return;const run=generation;status('Finding your location…');
    if(!navigator.geolocation){status('Location is unavailable. You can still browse active chat circles.');return;}
    navigator.geolocation.getCurrentPosition(pos=>{
      if(!active||run!==generation)return;
      const {longitude,latitude}=pos.coords;
      if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||!Number.isFinite(pos.timestamp)||Date.now()-pos.timestamp>45000||pos.timestamp>Date.now()+5000){status('A fresh location is unavailable. Use GPS to try again.');return;}
      position=[longitude,latitude];draw();map.easeTo({center:position,zoom:16,pitch:0,bearing:0,duration:600});status('Showing your location and active geofence chats. Tap a circle to open its chat.');
    },()=>{if(active&&run===generation)status('Allow device location to center the map. You can still browse active chat circles.');},{enableHighAccuracy:true,maximumAge:15000,timeout:12000});
  }
  function enter(){active=true;generation++;position=null;popup?.remove();window.dispatchEvent(new CustomEvent('austin:chat-view',{detail:{active:true}}));draw();locate();refresh();clearInterval(timer);timer=setInterval(refresh,15000);}
  function leave(){if(!active)return;active=false;generation++;clearInterval(timer);clearTimeout(expiry);popup?.remove();position=null;circles=[];status('');draw();window.dispatchEvent(new CustomEvent('austin:chat-view',{detail:{active:false}}));}
  async function init(value){
    map=value;try{model=await import('/geofences/model.mjs?v=20261114b');}catch{circleStatus('Chat circles could not load. Reload to try again.');return;}draw();map.on('style.load',draw);
    for(const layer of ['chat-circle-fill','chat-circle-label']){
      map.on('mouseenter',layer,()=>{if(active)map.getCanvas().style.cursor='pointer';});map.on('mouseleave',layer,()=>{map.getCanvas().style.cursor='';});
      map.on('click',layer,event=>{
        if(!active)return;const c=circles.find(c=>c.id===event.features?.[0]?.properties.id&&c.active!==false&&(!c.activeUntil||Date.parse(c.activeUntil)>Date.now()+clockOffset));if(!c)return;
        popup?.remove();const body=document.createElement('div'),title=document.createElement('strong'),description=document.createElement('p'),link=document.createElement('a'),note=document.createElement('p');
        title.textContent=c.name;description.textContent=c.description;link.textContent='Open geofence chat';link.href=model.pageURL(c.id);link.target='_top';note.textContent=c.diameter+' meters across · Join while inside the circle with location allowed.';body.append(title,description,link,note);
        map.easeTo({center:[c.longitude,c.latitude],duration:300});
        popup=new maplibregl.Popup({maxWidth:'300px',anchor:'bottom',className:'chat-circle-popup'}).setLngLat([c.longitude,c.latitude]).setDOMContent(body).addTo(map);
      });
    }
    if(active){draw();locate();refresh();}
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden){popup?.remove();position=null;draw();}else if(active){draw();refresh();}});
  window.addEventListener('pagehide',leave);
  window.AustinChatMap={init,enter,leave,locate,get active(){return active;}};
})();
