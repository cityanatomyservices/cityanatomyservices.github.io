/* A configured event on the shared MapLibre map, planner and chat shell. */
(() => {
  const $=id=>document.getElementById(id),M=window.SpecialEventModel;
  window.MAP_COPY.visibleHint='Visible shares your name and approximate location only with visitors in the same studio chat zone.';
  window.MAP_COPY.chat.placeholder='Say something to visitors at this stop…';
  window.MAP_COPY.ui.locate='Show my location';
  window.MAP_COPY.ui.extents='Fit to event area';
  const slug=new URLSearchParams(location.search).get('event');
  let event,map,panel,popup,date,criteria=M.filters(),filterError='',limit=40,refreshing=false;
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const label=d=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',month:'short',day:'numeric'}).format(new Date(d+'T12:00:00-06:00'));
  const ready=(async()=>{
    await window.PlanContext.ready;window.PlanContext.assert();
    if(!/^[a-z0-9-]+$/.test(slug||''))throw Error('Choose a Special Events map from Explore.');
    const response=await fetch(`/special-events/data/${slug}.geojson?v=20261109c`);
    if(!response.ok)throw Error('Could not load this event. Please reload to try again.');
    window.PlanContext.assert();event=M.validate(await response.json());if(event.id!==window.PlanContext.id)throw Error('Event data does not match this map.');return event;
  })();
  window.addEventListener('austin:event-expired',()=>location.replace('/special-events/expired.html'));
  // Attach an error handler immediately, while the shared map is loading.
  ready.catch(error=>{if(window.PlanContext.expired){location.replace('/special-events/expired.html');return;}$('map-error').hidden=false;$('map-error').textContent=error.message;});
  function show(on,focus=false){
    if(!panel)return;
    if(on){window.PlanPanel.leave();for(const name of ['AustinChatCard','AustinMapLayers','AustinApps'])window[name]?.close?.();render();}
    panel.hidden=!on;$('ctrlStops').setAttribute('aria-expanded',String(on));$('ctrlStops').classList.toggle('is-on',on);
    const toggle=$('event-toggle');toggle.classList.toggle('is-open',on);toggle.textContent=on?'‹':'›';toggle.setAttribute('aria-expanded',String(on));toggle.setAttribute('aria-label',(on?'Close':'Open')+' Austin Studio Tour panel');toggle.title=toggle.getAttribute('aria-label');
    if(on&&focus)$('event-search').focus({preventScroll:true});
    if(!on&&panel.contains(document.activeElement))toggle.focus({preventScroll:true});
  }
  function selectDate(value){date=value;limit=40;popup?.remove();render();draw();}
  function matches(){return filterError?[]:event.features.filter(f=>(!$('event-favorites')?.checked||window.SpecialEventSavedStore.row(f.properties.id).favorite)&&M.matching(event,f,date,criteria).length);}
  function applyFilters(){
    criteria=M.filters({query:$('event-search').value,from:$('event-from').value,until:$('event-until').value,
      allDay:$('event-all-day').checked,includeUnknown:$('event-unknown').checked,facets:{}});
    panel.querySelectorAll('[data-event-facet]:checked').forEach(input=>(criteria.facets[input.dataset.eventFacet]??=[]).push(input.value));
    filterError='';try{M.visitRange(event,date,criteria);}catch(error){filterError=error.message;}
    $('event-filter-message').textContent=filterError;$('event-until').setAttribute('aria-invalid',String(!!filterError));
    const count=Object.values(criteria.facets).reduce((n,v)=>n+v.length,0);$('event-filter-summary').textContent=`More filters${count?' · '+count+' selected':''}`;
    $('event-availability-summary').textContent='Time & availability'+(criteria.from||criteria.until?` · ${criteria.from||'any'}–${criteria.until||'any'}`:criteria.allDay?' · all event hours':criteria.includeUnknown?' · include unconfirmed':'');
    limit=40;popup?.remove();render();draw();
  }
  function mountSelection(container,source){
    window.PlanSelection.mount(container,source);
    const current=window.PlanStore.plan.items.find(i=>i.source.key===source.key);
    if(current&&JSON.stringify(current.source.eventFilters)!==JSON.stringify(source.eventFilters)){
      const update=node('button','Update planned visit','event-update-plan');update.type='button';
      update.onclick=async()=>{update.disabled=true;try{await window.PlanStore.edit(plan=>{const item=plan.items.find(i=>i.source.key===source.key);if(item){item.source=source;if(!item.schedule.locked)item.schedule.start=null;}},date);render();popup?.remove();}catch(error){$('event-filter-message').textContent=error.message;}finally{update.disabled=false;}};
      container.append(update);
    }
  }
  async function refreshSavedAvailability(){
    const store=window.PlanStore,day=store.plan.date;
    const stale=item=>item.source.eventId===event.id&&item.source.availabilityChecked!==event.availabilityChecked;
    if(!event.availabilityChecked||refreshing||store.conflict||!store.plan.items.some(stale))return;
    refreshing=true;
    try{
      await store.edit(plan=>{for(const item of plan.items)if(stale(item))item.source=M.refresh(event,event.features.find(f=>f.properties.id===item.source.sourceId),{...item.source,eventDate:item.source.eventDate||item.day||plan.date});},day);
      if(!panel.hidden)render();
    }catch(error){$('event-filter-message').textContent=error.message;}
    finally{refreshing=false;if(store.plan.date!==day)refreshSavedAvailability();}
  }
  function details(f){
    const p=f.properties,body=node('div',undefined,'event-stop-detail'),source=M.source(event,f,date,criteria),people=M.matching(event,f,date,criteria);
    body.append(node('h3',`#${p.number} · ${p.title}`),node('p',p.address),node('p',`${label(date)} · ${source.hoursText||event.hours.label}`));
    const fold=node('details'),summary=node('summary',`${people.length} matching participants & hours`);fold.append(summary);
    for(const match of people){const row=node('p',undefined,'event-artists'),a=node('a',match.profile.name);a.href=match.profile.url||p.url;a.target='_blank';a.rel='noopener noreferrer';row.append(a,document.createTextNode(' · '+(M.hoursLabel(match.windows,date)||'Hours need checking')));fold.append(row);}body.append(fold);
    const link=node('a','Official stop & attendance ↗');link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';body.append(link);
    body.append(node('p',p.scheduleNote||event.scheduleNote,'event-note'));
    body.append(node('p',p.chatBoundaryDetails?.sharedBuilding?'This building has separate chat zones for nearby stops. GPS chooses your zone.':p.chatBoundaryDetails?.method==='pin-approximation'?'Chat uses an approximate zone around this stop.':'Chat is available inside this stop’s shaded zone.','event-note'));
    mountSelection(body,source);
    const plan=node('button','Open Plan');plan.type='button';plan.onclick=()=>{popup?.remove();window.PlanPanel.open();};body.append(plan);
    return body;
  }
  function pick(f){
    show(false);popup?.remove();window.PlanPanel.leave();
    map.easeTo({center:f.geometry.coordinates,zoom:Math.max(map.getZoom(),16),duration:500});
    popup=new maplibregl.Popup({maxWidth:'330px',offset:18,className:'event-popup'}).setLngLat(f.geometry.coordinates).setDOMContent(details(f));
    window.SpecialEventSaved.bind(popup,M.source(event,f,date,criteria));window.AustinComments?.followPopup(popup);popup.addTo(map);
  }
  function render(){
    if(!panel)return;
    const found=matches(),list=$('event-results');list.replaceChildren();
    $('event-count').textContent=`${found.length} of ${event.features.length} stops · ${label(date)}`;
    for(const f of found.slice(0,limit)){
      const p=f.properties,source=M.source(event,f,date,criteria),people=source.eventProfiles?.map(p=>p.name)||p.participants||[],li=node('li'),b=node('button',`#${p.number} · ${p.title}`,'event-stop');b.type='button';b.onclick=()=>pick(f);
      li.append(b,node('p',p.address,'event-address'),node('p',source.hoursText||event.hours.label,'event-hours'));
      if(people.length)li.append(node('p',people.slice(0,3).join(' · ')+(people.length>3?` · +${people.length-3} more matching`:''),'event-artists'));
      mountSelection(li,source);list.append(li);
    }
    if(!found.length)list.append(node('li',filterError||'No stops match this day and these choices. Clear filters, change the day, or include schedules that need checking.'));
    $('event-more').hidden=found.length<=limit;
  }
  function draw(){
    if(!map)return;
    if(!map.getSource('event-chat-zones')){
      map.addSource('event-chat-zones',{type:'geojson',data:event.chatGeofences});
      map.addLayer({id:'event-chat-fill',type:'fill',source:'event-chat-zones',minzoom:14,paint:{'fill-color':'#8b3ba0','fill-opacity':.09}});
      map.addLayer({id:'event-chat-line',type:'line',source:'event-chat-zones',minzoom:14,paint:{'line-color':'#8b3ba0','line-width':1.5,'line-opacity':.7}});
      map.addLayer({id:'event-chat-current',type:'line',source:'event-chat-zones',filter:['==',['get','id'],''],paint:{'line-color':'#228d75','line-width':3}});
    }
    if(!map.getSource('event-stops')){
      map.addSource('event-stops',{type:'geojson',data:{type:'FeatureCollection',features:[]},cluster:true,clusterRadius:36,clusterMaxZoom:13});
      map.addLayer({id:'event-clusters',type:'circle',source:'event-stops',filter:['has','point_count'],paint:{'circle-color':'#8b3ba0','circle-radius':20,'circle-stroke-width':2,'circle-stroke-color':'#fff'}});
      map.addLayer({id:'event-cluster-count',type:'symbol',source:'event-stops',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-font':['Noto Sans Bold'],'text-size':13},paint:{'text-color':'#fff'}});
      map.addLayer({id:'event-points',type:'circle',source:'event-stops',filter:['!', ['has','point_count']],paint:{'circle-color':'#8b3ba0','circle-radius':14,'circle-stroke-color':'#fff','circle-stroke-width':2}});
      map.addLayer({id:'event-numbers',type:'symbol',source:'event-stops',filter:['!', ['has','point_count']],layout:{'text-field':['to-string',['get','number']],'text-font':['Noto Sans Bold'],'text-size':10,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
    }
    const shown=matches();
    map.getSource('event-stops').setData({type:'FeatureCollection',features:window.PlanPanel.active?[]:shown.map(f=>({type:'Feature',geometry:f.geometry,properties:{id:f.properties.id,number:f.properties.number}}))});
    for(const id of ['event-chat-fill','event-chat-line'])map.setFilter(id,['in',['get','stopId'],['literal',shown.map(f=>f.properties.id)]]);
    for(const id of ['event-chat-fill','event-chat-line','event-chat-current'])map.setLayoutProperty(id,'visibility',window.PlanPanel.active?'none':'visible');
    map.setFilter('event-chat-current',['==',['get','id'],window.ChatRoom.room?.properties.id||'']);
  }
  window.AustinEvent={ready,open:()=>show(true,true),close:()=>show(false),get data(){return event;},init(instance){
    map=instance;document.title=event.title;$('legendTitle').textContent=event.title+' chat';
    window.SpecialEventBasemap.init(map,event);
    $('legend').setAttribute('aria-label','Event chat and local businesses');
    $('ctrlChat').title='Chat at your studio stop';$('ctrlChat').setAttribute('aria-label','Studio stop chat');
    $('plan-title').textContent='Plan your event day';document.querySelector('.plan-eyebrow').textContent=event.title;
    document.querySelector('.plan-intro').textContent='This event has its own plan, separate from your main Austin day plan.';
    document.querySelector('#plan-empty p').textContent='Choose an event date in Stops, then check Day Planner beside the places you want to visit.';
    document.querySelectorAll('[data-plan-explore]').forEach(b=>b.textContent=b.closest('#plan-panel')?'+ Add event stops':'Stops');
    $('add-day').hidden=true;
    const today=window.PlanModel.day(),preferred=window.PlanStore.plan.date;
    date=event.dates.includes(preferred)?preferred:event.dates.find(d=>d>=today)||event.dates[0];
    panel=node('section',undefined,'event-panel');panel.id='event-panel';panel.hidden=true;panel.setAttribute('aria-labelledby','event-title');
    panel.innerHTML='<header><div><p class="event-eyebrow">Special Events</p><h1 id="event-title"></h1></div><button id="event-close" type="button" aria-label="Close stops">×</button></header><div class="event-scroll"><p id="event-dates"></p><p id="event-about"></p><label>Event day<select id="event-date"></select></label><label>Search stops<input id="event-search" type="search" placeholder="Name, artist, number or address"></label><label class="event-check"><input id="event-favorites" type="checkbox" disabled><span>Favorites only</span></label><details id="event-availability"><summary id="event-availability-summary">Time &amp; availability</summary><fieldset class="event-time"><legend>Visit window (optional)</legend><label>From<input id="event-from" type="time"></label><label>Until<input id="event-until" type="time"></label><p>Times before 5 AM mean the following morning.</p></fieldset><label class="event-check"><input id="event-all-day" type="checkbox"><span>Available all tour hours (11 AM–5 PM)</span></label><label class="event-check"><input id="event-unknown" type="checkbox"><span>Include schedules that need checking</span></label><p class="event-note">Unconfirmed hours cannot match a visit time or the all-day filter.</p></details><details id="event-filters"><summary id="event-filter-summary">More filters</summary><p class="event-note">Match any choice within a group. All selected accessibility features must be listed for the same participant.</p><div id="event-facet-groups"></div></details><button id="event-clear" type="button">Clear filters</button><p id="event-filter-message" role="alert"></p><p id="event-count" role="status"></p><ul id="event-results"></ul><button id="event-more" type="button">Show more stops</button><footer id="event-source"></footer></div>';
    document.querySelector('.page').append(panel);
    const toggle=node('button','‹','event-toggle');toggle.id='event-toggle';toggle.type='button';toggle.setAttribute('aria-controls','event-panel');toggle.onclick=()=>show(panel.hidden);document.querySelector('.page').append(toggle);
    $('event-title').textContent=event.title;$('event-dates').textContent=event.dateLabel+' · '+event.hours.label;$('event-about').textContent=event.scheduleNote;
    $('event-all-day').nextElementSibling.textContent='Available all event hours ('+event.hours.label.split(' · ')[0]+')';
    $('event-about').after(node('p','Purple areas mark studio chat zones. Turn on Visible to chat with other visible visitors in your zone. Nearby zones are separate; shared buildings may be divided.','event-note'));
    event.dates.forEach(d=>{const o=node('option',label(d));o.value=d;$('event-date').append(o);});$('event-date').value=date;
    for(const group of event.filters||[]){
      const section=node('details',undefined,'event-facet'),heading=node('summary',group.label);section.append(heading);
      for(const value of group.options){const label=node('label',undefined,'event-check'),input=node('input');input.type='checkbox';input.dataset.eventFacet=group.key;input.value=value;label.append(input,node('span',value));section.append(label);}
      $('event-facet-groups').append(section);
    }
    const source=node('a',event.source.title+' ↗');source.href=event.source.url;source.target='_blank';source.rel='noopener noreferrer';
    $('event-source').append(source,node('p',`Updated ${(event.availabilityChecked||event.checked).slice(0,10)} · ${event.features.length} published map stops.`));
    if(event.chat){const buildings=node('a',event.chat.buildingSourceTitle+' ↗');buildings.href=event.chat.buildingSource;buildings.target='_blank';buildings.rel='noopener noreferrer';$('event-source').append(buildings,node('p','Chat zones follow mapped buildings with about 20 m of surrounding space where available. Approximate zones are used where a footprint is unavailable. GPS and building matches are approximate.'));}
    $('ctrlStops').onclick=()=>show(panel.hidden,true);$('event-close').onclick=()=>show(false);
    panel.addEventListener('keydown',e=>{if(e.key==='Escape')show(false);});
    $('event-date').onchange=async e=>{
      selectDate(e.target.value);
      try { await window.PlanStore.chooseDay(date); }
      catch(error) { $('event-count').textContent=error.message; }
    };
    // Opening Plan from event browsing follows the date shown in Stops.
    // Reopening an already active planner preserves its own selected day.
    $('ctrlDayPlan').addEventListener('click',async e=>{
      if(window.PlanPanel.active || window.PlanStore.plan.date===date)return;
      e.stopImmediatePropagation();
      try { await window.PlanStore.chooseDay(date);window.PlanPanel.open(); }
      catch(error) { $('map-error').hidden=false;$('map-error').textContent=error.message; }
    },true);
    $('event-search').oninput=applyFilters;
    $('event-favorites').onchange=applyFilters;
    const savedChanged=()=>{const input=$('event-favorites');input.disabled=!window.AustinSession.registered||!window.SpecialEventSavedStore.loaded;if(input.disabled)input.checked=false;render();draw();};
    window.SpecialEventSavedStore.subscribe(savedChanged);savedChanged();
    for(const id of ['event-from','event-until','event-all-day','event-unknown'])$(id).onchange=applyFilters;
    $('event-facet-groups').onchange=applyFilters;
    $('event-clear').onclick=()=>{for(const id of ['event-search','event-from','event-until'])$(id).value='';panel.querySelectorAll('#event-all-day,#event-unknown,#event-favorites,[data-event-facet]').forEach(i=>i.checked=false);applyFilters();};
    $('event-more').onclick=()=>{limit+=40;render();};
    map.on('plannermode',()=>{popup?.remove();draw();});map.on('style.load',draw);map.on('eventchatroom',draw);draw();
    map.on('click','event-points',e=>{const id=e.features?.[0]?.properties.id;const f=event.features.find(f=>f.properties.id===id);if(f)pick(f);});
    map.on('click','event-clusters',async e=>{const f=e.features?.[0];if(!f)return;const zoom=await map.getSource('event-stops').getClusterExpansionZoom(f.properties.cluster_id);map.easeTo({center:f.geometry.coordinates,zoom,duration:400});});
    for(const id of ['event-points','event-clusters']){map.on('mouseenter',id,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',id,()=>map.getCanvas().style.cursor='');}
    window.PlanStore.subscribe(()=>{const d=window.PlanStore.plan.date;if(event.dates.includes(d)&&d!==date){$('event-date').value=d;selectDate(d);}refreshSavedAvailability();});
    window.PlanStore.ready().then(refreshSavedAvailability);
    show(!window.PlanPanel.active);
  }};
})();
