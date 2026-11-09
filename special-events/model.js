/* Event sources use the existing day planner and its flexible/fixed timing. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SpecialEventModel=api;})(globalThis,()=>{
  function validate(event){
    if(!event || !/^[a-z0-9-]+$/.test(event.id)||!event.title||!event.dates?.length||!event.features?.length)throw Error('Event data is incomplete.');
    if(!event.dates.every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)))throw Error('Invalid event dates.');
    const ids=new Set();
    for(const f of event.features){const p=f.properties,c=f.geometry?.coordinates;if(f.geometry?.type!=='Point'||!c?.every(Number.isFinite)||c.length!==2||Math.abs(c[0])>180||Math.abs(c[1])>90||!p?.id||!p.title||ids.has(p.id))throw Error('Invalid or duplicate event stop.');ids.add(p.id);}
    const b=event.bounds;
    if(!b||b.length!==2||!b.flat().every(Number.isFinite)||b[0][0]>=b[1][0]||b[0][1]>=b[1][1])throw Error('Invalid event extent.');
    if(event.features.some(f=>{const [x,y]=f.geometry.coordinates;return x<b[0][0]||x>b[1][0]||y<b[0][1]||y>b[1][1];}))throw Error('A stop falls outside the event extent.');
    if(event.availabilityChecked)for(const feature of event.features)for(const profile of feature.properties.profiles||[]){
      const a=profile.availability,clock=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
      if(!profile.name||!a||!['published','unknown'].includes(a.status)||!a.days||Object.entries(a.days).some(([date,windows])=>!event.dates.includes(date)||!Array.isArray(windows)||windows.some(w=>!clock.test(w.open)||!clock.test(w.close)||(!w.nextDay&&w.close<=w.open))))throw Error('Invalid participant opening hours.');
    }
    event.chatGeofences={type:'FeatureCollection',features:event.features.map(f=>{
      const p=f.properties,g=p.chatBoundary;
      const polygons=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
      if(!polygons.length||polygons.some(rings=>!rings.length||rings.some(ring=>ring.length<4||ring.some(c=>c.length!==2||!c.every(Number.isFinite))||ring[0].some((n,i)=>n!==ring.at(-1)[i]))))throw Error('A stop is missing its chat boundary.');
      return {type:'Feature',properties:{id:`event-${event.id}-stop-${p.id}`,stopId:p.id,number:p.number,name:`#${p.number} · ${p.title}`},geometry:g};
    })};
    return event;
  }
  const nextDay=date=>new Date(Date.parse(date+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  const stamp=(event,date,time)=>`${date}T${time}:00${event.utcOffset}`;
  function merge(windows){
    const result=[];
    for(const w of windows.map(w=>({start:Date.parse(w.start),end:Date.parse(w.end)})).sort((a,b)=>a.start-b.start)){
      if(!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.end<=w.start)continue;
      const last=result.at(-1);if(last&&w.start<=last.end)last.end=Math.max(last.end,w.end);else result.push(w);
    }
    return result.map(w=>({start:new Date(w.start).toISOString(),end:new Date(w.end).toISOString()}));
  }
  function filters(value={}){
    return {query:String(value.query||'').trim().toLowerCase(),from:value.from||'',until:value.until||'',
      allDay:!!value.allDay,includeUnknown:!!value.includeUnknown,facets:structuredClone(value.facets||{})};
  }
  function visitRange(event,date,value={}){
    const f=filters(value),clock=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if(f.from&&!clock.test(f.from)||f.until&&!clock.test(f.until))throw Error('Choose valid visit times.');
    const start=stamp(event,f.from&&f.from<'05:00'?nextDay(date):date,f.from||'05:00');
    const end=stamp(event,!f.until||f.until<='05:00'?nextDay(date):date,f.until||'05:00');
    if(Date.parse(end)<=Date.parse(start))throw Error('Visit until must be later than visit from.');
    return {start,end};
  }
  function intersect(windows,range){return merge(windows.map(w=>({start:new Date(Math.max(Date.parse(w.start),Date.parse(range.start))).toISOString(),end:new Date(Math.min(Date.parse(w.end),Date.parse(range.end))).toISOString()})));}
  function matching(event,feature,date,value={}){
    if(!event.dates.includes(date))return [];
    const p=feature.properties,f=filters(value),range=visitRange(event,date,f);
    if(!event.availabilityChecked){
      if(p.dates&&!p.dates.includes(date)||f.query&&![p.title,p.number,p.address,...(p.participants||[])].join(' ').toLowerCase().includes(f.query))return [];
      const published=[{start:p.start||stamp(event,date,(p.hours||event.hours).open),end:p.end||stamp(event,date,(p.hours||event.hours).close)}],windows=intersect(published,range);
      if(f.allDay&&!published.some(w=>Date.parse(w.start)<=Date.parse(stamp(event,date,event.hours.open))&&Date.parse(w.end)>=Date.parse(stamp(event,date,event.hours.close))))return [];
      if(p.start&&(Date.parse(p.start)<Date.parse(range.start)||Date.parse(p.end)>Date.parse(range.end)))return [];
      return windows.length?[{profile:{name:p.title},windows,unknown:false}]:[];
    }
    const profiles=p.profiles?.length?p.profiles:[{name:p.title,facets:{},availability:{status:'unknown',days:{}}}];
    return profiles.flatMap(profile=>{
      const a=profile.availability||{status:'unknown',days:{}};
      if(a.status==='published'&&!Object.hasOwn(a.days,date))return [];
      if(a.status==='unknown'&&!f.includeUnknown)return [];
      if(f.query){
        const numeric=/^\d+$/.test(f.query),place=numeric?Number(f.query)===p.number:(p.address||'').toLowerCase().includes(f.query);
        if(numeric?!place:!place&&!profile.name.toLowerCase().includes(f.query))return [];
      }
      for(const [key,selected] of Object.entries(f.facets)){
        if(!selected.length)continue;
        const values=profile.facets?.[key]||[],all=event.filters?.find(g=>g.key===key)?.match==='all';
        if(!(all?selected.every(v=>values.includes(v)):selected.some(v=>values.includes(v))))return [];
      }
      const published=merge((a.days[date]||[]).map(w=>({start:stamp(event,date,w.open),end:stamp(event,w.nextDay?nextDay(date):date,w.close)})));
      if(f.allDay&&!published.some(w=>Date.parse(w.start)<=Date.parse(stamp(event,date,event.hours.open))&&Date.parse(w.end)>=Date.parse(stamp(event,date,event.hours.close))))return [];
      const windows=intersect(published,range),unknown=!published.length;
      if(unknown&&!f.includeUnknown)return [];
      if(!windows.length&&(!unknown||f.from||f.until||f.allDay))return [];
      return [{profile,windows,unknown}];
    });
  }
  function hoursLabel(windows,date){
    const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'});
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'});
    return windows.map(w=>`${fmt.format(new Date(w.start))}–${fmt.format(new Date(w.end))}${day.format(new Date(w.end))!==date?' next day':''}`).join(' or ');
  }
  function summary(event,value={}){
    const f=filters(value),parts=[];
    if(f.query)parts.push(`Search: ${f.query}`);
    if(f.from||f.until)parts.push(`Visit window: ${f.from||'any time'}–${f.until||'any time'}`);
    if(f.allDay)parts.push('Available all tour hours');
    for(const group of event.filters||[]){const selected=f.facets[group.key];if(selected?.length)parts.push(`${group.label}: ${selected.join(', ')}`);}
    return parts.join(' · ');
  }
  function source(event,feature,date,value={}){
    const p=feature.properties;
    if(!event.dates.includes(date)||p.dates&&!p.dates.includes(date))throw Error('This stop is not listed for that event day.');
    if(event.availabilityChecked){
      const selected=matching(event,feature,date,value);
      if(!selected.length)throw Error('No participants match this day and these filters.');
      const availabilityWindows=merge(selected.flatMap(p=>p.windows)),unknown=!availabilityWindows.length;
      const names=selected.map(p=>p.profile.name),eventFilters=filters(value),eventFiltersSummary=summary(event,eventFilters);
      const hours=unknown?'Hours need checking':hoursLabel(availabilityWindows,date);
      const conditions=[`Published availability for ${date}: ${hours}.`,`Matching participants: ${names.join('; ')}.`,eventFiltersSummary,
        selected.some(p=>p.unknown)?'Some matching participants have incomplete hours; check their official profiles.':'Check official profiles for schedule changes.'].filter(Boolean).join('\n');
      const range=visitRange(event,date,value);
      return {key:`special-event:${event.id}:${p.id}:${date}`,sourceId:p.id,kind:'event',timing:unknown?'unknown':'window',
        title:`#${p.number} · ${p.title}`,venue:p.title,address:p.address||'',coordinates:feature.geometry.coordinates.slice(),
        description:event.title,conditions,url:p.url,provider:event.source.title,checked:event.availabilityChecked,captured:new Date().toISOString(),
        start:availabilityWindows[0]?.start||null,end:availabilityWindows.at(-1)?.end||null,endKnown:!unknown,hoursUnknown:unknown,
        validFrom:range.start,validUntil:range.end,availabilityWindows,hoursText:hours,eventId:event.id,eventDate:date,
        eventFilters,eventFiltersSummary,eventProfiles:selected.map(p=>({id:p.profile.id,name:p.profile.name,url:p.profile.url})),availabilityChecked:event.availabilityChecked};
    }
    const selected=matching(event,feature,date,value);if(!selected.length)throw Error('This stop is not listed for that event day and time.');
    const start=p.start||selected[0].windows[0].start;
    const end=p.end||selected[0].windows.at(-1).end;
    return {key:`special-event:${event.id}:${p.id}:${date}`,sourceId:p.id,kind:'event',timing:p.start?'fixed':'window',
      title:`${p.number ? '#'+p.number+' · ' : ''}${p.title}`,venue:p.title,address:p.address||'',coordinates:feature.geometry.coordinates.slice(),
      description:[event.title,p.participants?.join(', '),p.scheduleNote||event.scheduleNote].filter(Boolean).join('\n'),
      conditions:p.scheduleNote||event.scheduleNote,
      url:p.url,provider:event.source.title,checked:event.checked,captured:new Date().toISOString(),
      start,end,endKnown:true,hoursUnknown:false,eventId:event.id,eventDate:date};
  }
  function refresh(event,feature,previous){
    const date=previous.eventDate,value=previous.eventFilters||{includeUnknown:true};
    if(feature&&matching(event,feature,date,value).length)return source(event,feature,date,value);
    return {...previous,start:null,end:null,endKnown:false,timing:'unknown',hoursUnknown:false,availabilityWindows:[],
      eventUnavailable:true,availabilityChecked:event.availabilityChecked,checked:event.availabilityChecked,
      conditions:'Current organizer listings do not confirm this stop for the saved day and filters. Check the source, change the day, or update this visit from Stops.',hoursText:'Availability needs updating.'};
  }
  return {validate,source,matching,filters,visitRange,merge,hoursLabel,summary,refresh};
});
