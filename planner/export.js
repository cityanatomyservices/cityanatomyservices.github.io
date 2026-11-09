/* Portable exports of one selected day. No account writes or external requests. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./model.js'));
  else root.PlanExport=factory(root.PlanModel);
})(typeof globalThis==='object'?globalThis:this,M=>{
  const formats=['google-calendar','google-maps','apple-calendar','apple-maps'];
  const point=item=>{
    const p=item.schedule.routeCoordinates||item.source.coordinates;
    return Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90?p:null;
  };
  const scheduled=item=>Number.isFinite(Date.parse(item.schedule.start));
  function prepare(plan,format){
    if(!formats.includes(format))throw new Error('Choose an export destination.');
    const calendar=format.endsWith('-calendar');
    const items=plan.items.filter(i=>!i.day||i.day===plan.date).slice().sort((a,b)=>
      (scheduled(a)?Date.parse(a.schedule.start):Infinity)-(scheduled(b)?Date.parse(b.schedule.start):Infinity));
    const eligible=item=>{
      if(item.source.eventUnavailable)return false;
      if(item.source.eventId&&scheduled(item)&&Array.isArray(item.source.availabilityWindows)){
        const [start,end]=M.interval(item);
        if(!M.availability(item,plan).some(([a,b])=>start>=a&&end<=b))return false;
      }
      return calendar ? scheduled(item)&&M.onDay(plan.date,item.schedule.start)&&Number.isFinite(item.schedule.duration)&&item.schedule.duration>0 : !!point(item);
    };
    return {calendar,items:items.filter(eligible),skipped:items.filter(i=>!eligible(i))};
  }
  const text=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  // RFC 5545 folds at 75 UTF-8 octets, never inside a Unicode code point.
  function fold(line){
    const encoder=new TextEncoder();let out='',bytes=0;
    for(const char of line){const size=encoder.encode(char).length;if(bytes+size>75){out+='\r\n ';bytes=1;}out+=char;bytes+=size;}
    return out;
  }
  const utc=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  function sourceUrl(value){try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch(_){return '';}}
  function calendar(plan,now=Date.now()){
    const prepared=prepare(plan,'google-calendar');
    if(!prepared.items.length)throw new Error('Set an arrival time for at least one stop on this day.');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Austin.Chat//Austin day Planner//EN','CALSCALE:GREGORIAN',`X-WR-CALNAME:${text(plan.date)}`,`X-WR-TIMEZONE:${M.zone}`];
    for(const item of prepared.items){
      const s=item.source,u=item.schedule,p=point(item),url=sourceUrl(s.showtimes?.find(show=>show.start===u.showtime)?.url||s.url);
      const description=[`Planned visit from Austin day Planner · ${plan.date}.`,u.durationConfirmed===false?'Visit length is unconfirmed; check the source.':'',s.conditions,u.note,url?'Source: '+url:''].filter(Boolean).join('\n\n');
      lines.push('BEGIN:VEVENT',`UID:${encodeURIComponent(plan.id)}-${encodeURIComponent(item.id)}@austin.chat`,`DTSTAMP:${utc(now)}`,`DTSTART:${utc(u.start)}`,`DTEND:${utc(Date.parse(u.start)+u.duration*60000)}`,`SUMMARY:${text(s.title)}`,`LOCATION:${text([s.venue,s.address].filter(Boolean).join(' · '))}`,`DESCRIPTION:${text(description)}`,'CLASS:PRIVATE');
      if(p)lines.push(`GEO:${p[1]};${p[0]}`);
      if(url)lines.push(`URL:${url}`);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return {text:lines.map(fold).join('\r\n')+'\r\n',filename:`austin-day-${plan.date}.ics`,type:'text/calendar;charset=utf-8'};
  }
  function directions(items,service,avoidTolls){
    const locations=items.map(i=>{const p=point(i);return `${p[1]},${p[0]}`;});
    const url=new URL(service==='google'?'https://www.google.com/maps/dir/':'https://maps.apple.com/directions');
    if(service==='google'){
      url.searchParams.set('api','1');url.searchParams.set('travelmode','driving');
      if(locations.length>1)url.searchParams.set('origin',locations[0]);
      url.searchParams.set('destination',locations.at(-1));
      if(locations.length>2)url.searchParams.set('waypoints',locations.slice(1,-1).join('|'));
    }else{
      url.searchParams.set('mode','driving');
      if(locations.length>1)url.searchParams.set('source',locations[0]);
      url.searchParams.set('destination',locations.at(-1));
      for(const at of locations.slice(1,-1))url.searchParams.append('waypoint',at);
      if(avoidTolls)url.searchParams.set('avoid','tolls');
    }
    return url.href;
  }
  function maps(plan,service){
    if(!['google','apple'].includes(service))throw new Error('Choose a map destination.');
    const {items}=prepare(plan,service+'-maps'),parts=[];
    // Google mobile browsers: 3 intermediate stops + origin/destination.
    // Apple: source + up to 14 stops. Repeat the boundary to retain every leg.
    const maximum=service==='google'?5:15;
    for(let start=0;start<items.length;){
      const chunk=items.slice(start,start+maximum);
      parts.push({items:chunk,url:directions(chunk,service,plan.routing?.avoidTolls)});
      if(start+chunk.length>=items.length)break;
      start+=chunk.length-1;
    }
    return parts;
  }
  return {prepare,calendar,maps};
});
