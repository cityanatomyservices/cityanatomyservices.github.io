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
    event.chatGeofences={type:'FeatureCollection',features:event.features.map(f=>{
      const p=f.properties,g=p.chatBoundary;
      const polygons=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
      if(!polygons.length||polygons.some(rings=>!rings.length||rings.some(ring=>ring.length<4||ring.some(c=>c.length!==2||!c.every(Number.isFinite))||ring[0].some((n,i)=>n!==ring.at(-1)[i]))))throw Error('A stop is missing its chat boundary.');
      return {type:'Feature',properties:{id:`event-${event.id}-stop-${p.id}`,stopId:p.id,number:p.number,name:`#${p.number} · ${p.title}`},geometry:g};
    })};
    return event;
  }
  function source(event,feature,date){
    const p=feature.properties;
    if(!event.dates.includes(date)||p.dates&&!p.dates.includes(date))throw Error('This stop is not listed for that event day.');
    const hours=p.hours||event.hours;
    const start=p.start||`${date}T${hours.open}:00${event.utcOffset}`;
    const end=p.end||`${date}T${hours.close}:00${event.utcOffset}`;
    return {key:`special-event:${event.id}:${p.id}:${date}`,sourceId:p.id,kind:'event',timing:p.start?'fixed':'window',
      title:`${p.number ? '#'+p.number+' · ' : ''}${p.title}`,venue:p.title,address:p.address||'',coordinates:feature.geometry.coordinates.slice(),
      description:[event.title,p.participants?.join(', '),p.scheduleNote||event.scheduleNote].filter(Boolean).join('\n'),
      conditions:p.scheduleNote||event.scheduleNote,
      url:p.url,provider:event.source.title,checked:event.checked,captured:new Date().toISOString(),
      start,end,endKnown:true,hoursUnknown:false,eventId:event.id,eventDate:date};
  }
  return {validate,source};
});
