/* A configured event on the shared MapLibre map, planner and chat shell. */
(() => {
  const $=id=>document.getElementById(id),M=window.SpecialEventModel;
  window.MAP_COPY.visibleHint='Visible shares your name and approximate location with people across this event area.';
  window.MAP_COPY.chat.placeholder='Say something to the event…';
  window.MAP_COPY.ui.locate='Show my location';
  window.MAP_COPY.ui.extents='Fit to event area';
  const slug=new URLSearchParams(location.search).get('event');
  let event,map,panel,popup,date,query='',kind='',limit=40;
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  const label=d=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',month:'short',day:'numeric'}).format(new Date(d+'T12:00:00-06:00'));
  const ready=(async()=>{
    if(!/^[a-z0-9-]+$/.test(slug||''))throw Error('Choose a Special Events map from Explore.');
    const response=await fetch(`/special-events/data/${slug}.geojson?v=20261108a`);
    if(!response.ok)throw Error('Could not load this event. Please reload to try again.');
    event=M.validate(await response.json());return event;
  })();
  // Attach an error handler immediately, while the shared map is loading.
  ready.catch(error=>{$('map-error').hidden=false;$('map-error').textContent=error.message;});
  function show(on,focus=false){
    if(!panel)return;
    if(on){window.PlanPanel.leave();for(const name of ['AustinChatCard','AustinMapLayers','AustinApps'])window[name]?.close?.();render();}
    panel.hidden=!on;$('ctrlStops').setAttribute('aria-expanded',String(on));$('ctrlStops').classList.toggle('is-on',on);
    if(on&&focus)$('event-search').focus({preventScroll:true});
    if(!on&&panel.contains(document.activeElement))$('ctrlStops').focus({preventScroll:true});
  }
  function selectDate(value){date=value;limit=40;popup?.remove();render();draw();}
  function matches(){return event.features.filter(f=>{const p=f.properties;return (!p.dates||p.dates.includes(date))&&(!kind||p.category===kind)&&(!query||[p.title,p.number,p.address,...(p.participants||[])].join(' ').toLowerCase().includes(query));});}
  function details(f){
    const p=f.properties,body=node('div',undefined,'event-stop-detail');
    body.append(node('h3',`#${p.number} · ${p.title}`),node('p',p.address),node('p',`${label(date)} · ${event.hours.label}`));
    if(p.participants?.length){const fold=node('details'),summary=node('summary',`${p.participants.length} artists & hosts`);fold.append(summary,node('p',p.participants.join(' · '),'event-artists'));body.append(fold);}
    const link=node('a','Official stop & attendance ↗');link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';body.append(link);
    body.append(node('p',p.scheduleNote||event.scheduleNote,'event-note'));
    window.PlanSelection.mount(body,M.source(event,f,date));
    const plan=node('button','Open Plan');plan.type='button';plan.onclick=()=>{popup?.remove();window.PlanPanel.open();};body.append(plan);
    return body;
  }
  function pick(f){
    show(false);popup?.remove();window.PlanPanel.leave();
    map.easeTo({center:f.geometry.coordinates,zoom:Math.max(map.getZoom(),16),pitch:0,duration:500});
    popup=new maplibregl.Popup({maxWidth:'330px',offset:18,className:'event-popup'}).setLngLat(f.geometry.coordinates).setDOMContent(details(f)).addTo(map);
  }
  function render(){
    if(!panel)return;
    const found=matches(),list=$('event-results');list.replaceChildren();
    $('event-count').textContent=`${found.length} of ${event.features.length} stops · ${label(date)}`;
    for(const f of found.slice(0,limit)){
      const p=f.properties,li=node('li'),b=node('button',`#${p.number} · ${p.title}`,'event-stop');b.type='button';b.onclick=()=>pick(f);
      li.append(b,node('p',p.address,'event-address'));
      if(p.participants?.length)li.append(node('p',p.participants.slice(0,3).join(' · ')+(p.participants.length>3?` · +${p.participants.length-3} more`:''),'event-artists'));
      window.PlanSelection.mount(li,M.source(event,f,date));list.append(li);
    }
    if(!found.length)list.append(node('li','No stops match. Try another name, number, address or category.'));
    $('event-more').hidden=found.length<=limit;
  }
  function draw(){
    if(!map)return;
    if(!map.getSource('event-stops')){
      map.addSource('event-stops',{type:'geojson',data:{type:'FeatureCollection',features:[]},cluster:true,clusterRadius:36,clusterMaxZoom:13});
      map.addLayer({id:'event-clusters',type:'circle',source:'event-stops',filter:['has','point_count'],paint:{'circle-color':'#8b3ba0','circle-radius':20,'circle-stroke-width':2,'circle-stroke-color':'#fff'}});
      map.addLayer({id:'event-cluster-count',type:'symbol',source:'event-stops',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-font':['Noto Sans Bold'],'text-size':13},paint:{'text-color':'#fff'}});
      map.addLayer({id:'event-points',type:'circle',source:'event-stops',filter:['!', ['has','point_count']],paint:{'circle-color':'#8b3ba0','circle-radius':14,'circle-stroke-color':'#fff','circle-stroke-width':2}});
      map.addLayer({id:'event-numbers',type:'symbol',source:'event-stops',filter:['!', ['has','point_count']],layout:{'text-field':['to-string',['get','number']],'text-font':['Noto Sans Bold'],'text-size':10,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
    }
    map.getSource('event-stops').setData({type:'FeatureCollection',features:window.PlanPanel.active?[]:matches()});
  }
  window.AustinEvent={ready,open:()=>show(true,true),close:()=>show(false),get data(){return event;},init(instance){
    map=instance;document.title=event.title;$('legendTitle').textContent=event.title+' chat';
    $('legend').setAttribute('aria-label','Event chat and local businesses');
    $('ctrlChat').title='Event-wide chat';$('ctrlChat').setAttribute('aria-label','Event chat');
    $('plan-title').textContent='Plan your event day';document.querySelector('.plan-eyebrow').textContent=event.title;
    document.querySelector('.plan-intro').textContent='Choose event stops, arrange your day, then export it.';
    document.querySelector('#plan-empty p').textContent='Choose an event date in Stops, then check Day Planner beside the places you want to visit.';
    document.querySelectorAll('[data-plan-explore]').forEach(b=>b.textContent=b.closest('#plan-panel')?'+ Add event stops':'Stops');
    const today=window.PlanModel.day(),preferred=window.PlanStore.plan.date;
    date=event.dates.includes(preferred)?preferred:event.dates.find(d=>d>=today)||event.dates[0];
    panel=node('section',undefined,'event-panel');panel.id='event-panel';panel.hidden=true;panel.setAttribute('aria-labelledby','event-title');
    panel.innerHTML='<header><div><p class="event-eyebrow">Special Events</p><h1 id="event-title"></h1></div><button id="event-close" type="button" aria-label="Close stops">×</button></header><div class="event-scroll"><p id="event-dates"></p><p id="event-about"></p><label>Event day<select id="event-date"></select></label><label>Search stops<input id="event-search" type="search" placeholder="Name, artist, number or address"></label><label>Location type<select id="event-kind"><option value="">All types</option></select></label><p id="event-count" role="status"></p><ul id="event-results"></ul><button id="event-more" type="button">Show more stops</button><footer id="event-source"></footer></div>';
    document.querySelector('.page').append(panel);
    $('event-title').textContent=event.title;$('event-dates').textContent=event.dateLabel+' · '+event.hours.label;$('event-about').textContent=event.scheduleNote;
    event.dates.forEach(d=>{const o=node('option',label(d));o.value=d;$('event-date').append(o);});$('event-date').value=date;
    [...new Set(event.features.map(f=>f.properties.category))].filter(Boolean).sort().forEach(c=>{const o=node('option',c);o.value=c;$('event-kind').append(o);});
    const source=node('a',event.source.title+' ↗');source.href=event.source.url;source.target='_blank';source.rel='noopener noreferrer';
    $('event-source').append(source,node('p',`Updated ${event.checked.slice(0,10)} · ${event.features.length} published map stops.`));
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
    $('event-search').oninput=e=>{query=e.target.value.trim().toLowerCase();limit=40;render();draw();};
    $('event-kind').onchange=e=>{kind=e.target.value;limit=40;render();draw();};
    $('event-more').onclick=()=>{limit+=40;render();};
    map.on('plannermode',()=>{popup?.remove();draw();});map.on('style.load',draw);draw();
    map.on('click','event-points',e=>{const id=e.features?.[0]?.properties.id;const f=event.features.find(f=>f.properties.id===id);if(f)pick(f);});
    map.on('click','event-clusters',async e=>{const f=e.features?.[0];if(!f)return;const zoom=await map.getSource('event-stops').getClusterExpansionZoom(f.properties.cluster_id);map.easeTo({center:f.geometry.coordinates,zoom,duration:400});});
    for(const id of ['event-points','event-clusters']){map.on('mouseenter',id,()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave',id,()=>map.getCanvas().style.cursor='');}
    window.PlanStore.subscribe(()=>{const d=window.PlanStore.plan.date;if(event.dates.includes(d)&&d!==date){$('event-date').value=d;selectDate(d);}});
    if(!window.PlanPanel.active)show(true);
  }};
})();
