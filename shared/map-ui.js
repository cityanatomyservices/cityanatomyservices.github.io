/* The common map chrome for catalog apps. Existing map engines keep their
   own data, popups and special controls. Shared menus own account/planner UI. */
(() => {
  const tasks=new Map();
  function script(src,available){
    if(available?.())return Promise.resolve();
    if(!tasks.has(src))tasks.set(src,new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>reject(new Error('Could not load map menus.'));document.head.append(el);}));
    return tasks.get(src);
  }
  function css(href){const el=document.createElement('link');el.rel='stylesheet';el.href=href;document.head.append(el);}
  // Standalone engine URLs use the same public frame as catalog links.
  const canonical={ '/datacenters/':'/maps/datacenters/','/AISD/':'/maps/aisd/','/budget/':'/maps/budget/','/models/':'/maps/models/','/parcels/':'/apps/parcels/','/parcels/embed.html':'/apps/parcels/','/news/':'/maps/news/','/moontower/':'/maps/moontower-demo/','/1885murdertour/app.html':'/apps/1885/','/moontowertour/app.html':'/apps/moontower/','/planner/app.html':'/myplanmap/','/chat/':'/' };
  const pathname=location.pathname.replace(/index\.html$/,'');
  if(window===window.top&&canonical[pathname]&&!new URLSearchParams(location.search).has('standalone')){location.replace(canonical[pathname]+location.search+location.hash);return;}
  async function mount(map){
    if(map.__austinUI)return;map.__austinUI=true;window.austinMap=map;
    const $=id=>document.getElementById(id),root=map.getContainer().closest('.page,.shopmap')||map.getContainer().parentElement;
    root.classList.add('page','austin-map-surface');document.documentElement.setAttribute('data-austin-map','');
    const oldStack=$('stack')||root.querySelector('.stack'),legacy=[...root.querySelectorAll('.map-controls,.views')];
    const loading=document.createElement('p');loading.className='map-ui-status';loading.setAttribute('role','status');root.append(loading);
    try{
      for(const href of ['/chat/style.css?v=20261029v','/chat/explore/explore.css?v=20261028e','/planner/select.css?v=20261029v','/chat/panel.css?v=20261023e','/shared/comments.css?v=20261030e','/shared/map-ui.css?v=20261030e','/appearance.css?v=20261028h'])css(href);
      await script('/chat/theme.js?v=20261028g');
      await script('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/dist/umd/supabase.min.js',()=>window.supabase);
      for(const [file,version,global] of [['visit','e','AustinVisit'],['session','a','AustinSession'],['member','c','AustinMember'],['preferences','c','AustinPreferences'],['favorite-button','c','AustinFavorites'],['comments','e','AustinComments']])await script(`/shared/${file}.js?v=20261030${version}`,()=>window[global]);
      for(const [file,version,global] of [['model','20261029r','PlanModel'],['sources','20261029r','PlanSources'],['repository','20261029r','PlanRepository'],['store','20261030a','PlanStore']])await script(`/planner/${file}.js?v=${version}`,()=>window[global]);
      const response=await fetch('/shared/map-controls.html?v=20261030e');if(!response.ok)throw new Error('Map controls could not load.');
      const template=document.createElement('template');template.innerHTML=await response.text();const stack=template.content.firstElementChild;stack.classList.add('austin-map-ui');
      const existing={ctrlLocate:$('ctrlLocate')||$('btn-locate'),ctrlTilt:$('ctrlTilt')||$('btn-tilt'),ctrlSatellite:$('ctrlSatellite'),ctrlExtent:$('ctrlExtent')||$('btn-extents')};
      for(const [id,old] of Object.entries(existing))if(old){
        const replacement=stack.querySelector('#'+id);old.className='round'+(id==='ctrlLocate'||id==='ctrlSatellite'?' round-text':'');
        if(id==='ctrlLocate')old.textContent='GPS';if(id==='ctrlSatellite')old.textContent='Sat';if(id==='ctrlExtent')old.innerHTML=replacement.innerHTML;
        old.hidden=false;replacement.replaceWith(old);
      }
      for(const id of ['ctrlZoomIn','ctrlZoomOut','btn-zoom-in','btn-zoom-out','btn-home'])if($(id))$(id).hidden=true;
      // Tour-specific actions stay in a small panel, leaving the common stack
      // in the same order and at the same size on every map.
      let tourPanel;
      if(oldStack){
        const extra=[...oldStack.children].filter(child=>!child.hidden&&!['btn-chat','btn-visible'].includes(child.id));
        for(const id of ['btn-chat','btn-visible'])if($(id)){const child=$(id);child.hidden=true;root.append(child);}
        if(extra.length){
          tourPanel=document.createElement('section');tourPanel.className='catalog-panel tour-tools';tourPanel.id='tour-tools';tourPanel.hidden=true;
          const title=document.createElement('h2');title.textContent='Tour options';tourPanel.append(title);
          for(const child of extra){const label=document.createElement('label');label.textContent=child.id==='btn-mode'?'Map appearance':'Walking / cycling';label.append(child);tourPanel.append(label);}
          const toggle=document.createElement('button');toggle.id='ctrlTour';toggle.type='button';toggle.className='round round-text';toggle.textContent='Tour';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','tour-tools');stack.append(toggle);
          toggle.onclick=()=>{const open=tourPanel.hidden;for(const name of ['AustinApps','AustinMedia','AustinDayPlan','AustinExplore','AustinChatCard'])window[name]?.close?.();tourPanel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));};
          root.append(tourPanel);
        }
        oldStack.remove();
      }
      root.append(stack);legacy.forEach(el=>el.hidden=true);root.querySelectorAll('a.home,.map-brand').forEach(el=>el.hidden=true);
      if(!map.getContainer().querySelector('.maplibregl-ctrl-zoom-in'))map.addControl(new maplibregl.NavigationControl(),'top-left');
      let gps,tilted=map.getPitch()>10,satellite=false;
      const currentBounds=map.getBounds().toArray();
      if(!existing.ctrlLocate)$('ctrlLocate').onclick=()=>{
        if(!navigator.geolocation){loading.textContent='Location is unavailable.';return;}
        loading.textContent='Finding your location…';navigator.geolocation.getCurrentPosition(p=>{const at=[p.coords.longitude,p.coords.latitude];gps?.remove();gps=new maplibregl.Marker({color:'#247dbe'}).setLngLat(at).addTo(map);map.easeTo({center:at,zoom:15,duration:600});loading.textContent='';},()=>loading.textContent='Location unavailable or permission declined.',{timeout:12000,maximumAge:60000});
      };
      (existing.ctrlLocate||$('ctrlLocate')).setAttribute('aria-label','GPS: show my location');
      if(!existing.ctrlTilt){const tilt=()=>{const b=$('ctrlTilt');b.textContent=tilted?'2D':'3D';b.title=tilted?'Switch to 2D':'Switch to 3D';b.setAttribute('aria-pressed',String(tilted));b.classList.toggle('is-on',tilted);};tilt();$('ctrlTilt').onclick=()=>{tilted=!tilted;tilt();map.easeTo({pitch:tilted?55:0,duration:500});};}
      function imagery(){if(existing.ctrlSatellite||map.getSource('austin-satellite'))return;map.addSource('austin-satellite',{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,attribution:'Tiles &copy; Esri'});const layers=map.getStyle().layers;const before=layers.find(l=>['circle','symbol','fill-extrusion','custom'].includes(l.type))?.id;map.addLayer({id:'austin-satellite',type:'raster',source:'austin-satellite',layout:{visibility:satellite?'visible':'none'}},before);}
      imagery();map.on('style.load',imagery);
      if(!existing.ctrlSatellite)$('ctrlSatellite').onclick=()=>{satellite=!satellite;map.setLayoutProperty('austin-satellite','visibility',satellite?'visible':'none');$('ctrlSatellite').setAttribute('aria-pressed',String(satellite));$('ctrlSatellite').classList.toggle('is-on',satellite);};
      (existing.ctrlSatellite||$('ctrlSatellite')).setAttribute('aria-label','Satellite imagery');
      if(!existing.ctrlExtent)$('ctrlExtent').onclick=()=>map.fitBounds(currentBounds,{padding:50,pitch:0,bearing:0,duration:600});
      (existing.ctrlExtent||$('ctrlExtent')).setAttribute('aria-label','Show map extent');
      await script('/planner/select.js?v=20261030e');
      await script('/chat/catalog-menu.js?v=20261030c');
      await script('/chat/explore/config.js?v=20261028e');await script('/chat/explore/model.js?v=20261028e');await script('/chat/explore/explore.js?v=20261030e');
      window.AustinExplore.init(map);
      const existingChat=$('btn-chat');
      if(existingChat){
        const chat=$('ctrlChat'),card=document.createElement('section');card.id='planner-chat-host';card.className='planner-chat-card';card.hidden=true;
        const title=document.createElement('h2'),help=document.createElement('p'),close=document.createElement('button'),visibility=document.createElement('label');title.textContent='Neighborhood chat';help.textContent='Use GPS to find your neighborhood. Visibility is your choice.';close.textContent='Close';close.type='button';visibility.textContent='Chat visibility ';const visible=$('btn-visible');if(visible){visible.hidden=false;visibility.append(visible);}existingChat.hidden=false;card.append(title,help,visibility,existingChat,close);root.append(card);
        const hide=()=>{card.hidden=true;chat.setAttribute('aria-expanded','false');window.ChatPanel?.close();};
        chat.onclick=()=>{const open=card.hidden;for(const name of ['AustinApps','AustinMedia','AustinDayPlan','AustinExplore'])window[name]?.close?.();card.hidden=!open;chat.setAttribute('aria-expanded',String(open));};close.onclick=hide;
        window.AustinChatCard={close:hide};
      }else{const host=document.createElement('div');host.id='planner-chat-host';host.hidden=true;root.append(host);await script('/chat/widget.js?v=20261030e');}
      stack.addEventListener('click',event=>{if(tourPanel&&event.target.closest('button')?.id!=='ctrlTour'){tourPanel.hidden=true;$('ctrlTour').setAttribute('aria-expanded','false');}});
      loading.textContent='';root.dataset.mapUiReady='true';
    }catch(error){loading.textContent=error.message+' Reload to retry.';console.error(error);}
  }
  window.AustinMapUI={mount:map=>{if(map.getStyle())mount(map);else map.once('load',()=>mount(map));}};
})();
