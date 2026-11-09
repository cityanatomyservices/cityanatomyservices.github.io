/* Shared visit labels and a small image-only PDF encoder. No account/network I/O. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('../planner/model.js'));else root.EventPlanPrint=factory(root.PlanModel);})(typeof globalThis==='object'?globalThis:this,M=>{
  const date=d=>new Intl.DateTimeFormat('en-US',{timeZone:M.zone,weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(M.instant(d+'T12:00')));
  const time=t=>new Intl.DateTimeFormat('en-US',{timeZone:M.zone,hour:'numeric',minute:'2-digit'}).format(new Date(t));
  function visit(item,day){
    const start=Date.parse(item.schedule.start),end=start+M.duration(item)*60000;
    if(!Number.isFinite(start))return {date:date(day),time:'Visit time not set',...(item.source?.hoursText&&!item.source.hoursUnknown&&!item.source.eventUnavailable?{hours:'Available: '+item.source.hoursText}:{})};
    const startDay=M.day(start),endDay=M.day(end);
    return {date:date(startDay),time:`${time(start)}–${time(end)}${endDay!==startDay?' ('+date(endDay)+')':''} CT`};
  }
  function wrap(text,width,measure){
    const lines=[];let line='';
    for(const word of String(text).split(/\s+/)){
      if(measure(word)>width){if(line){lines.push(line);line='';}let part='';for(const char of word){if(part&&measure(part+char)>width){lines.push(part);part='';}part+=char;}line=part;continue;}
      if(line&&measure(line+' '+word)>width){lines.push(line);line=word;}else line+=(line?' ':'')+word;
    }
    if(line)lines.push(line);return lines.length?lines:[''];
  }
  // Labels are never omitted to solve crowding: continue on another map sheet.
  function sheets(entries,height=620){
    const pages=[];let page=[[],[]],used=[0,0];
    for(const entry of entries){let side=used[0]<=used[1]?0:1;
      if((entry.continued||used[side]+entry.height>height)&&page.flat().length){pages.push(page);page=[[],[]];used=[0,0];side=0;}
      page[side].push(entry);used[side]+=entry.height+18;
    }
    if(page.flat().length)pages.push(page);
    return pages.map(page=>{
      const sorted=page.flat().sort((a,b)=>(a.position?.x||0)-(b.position?.x||0));
      const used=column=>column.reduce((n,e)=>n+e.height+18,0)-18;
      let best=page,cost=Infinity;
      for(let cut=1;cut<sorted.length;cut++){const left=sorted.slice(0,cut),right=sorted.slice(cut),a=used(left),b=used(right);if(a<=height&&b<=height&&Math.abs(a-b)<cost){best=[left,right];cost=Math.abs(a-b);}}
      return best;
    });
  }
  function notes(item,stopNote,registered){
    if(!registered)return '';
    const visitNote=item.schedule?.note||'';
    return [stopNote,visitNote&&visitNote!==stopNote?(stopNote?'Visit notes: ':'')+visitNote:''].filter(Boolean).join('\n');
  }
  function withNotes(entries,height=640){
    return entries.flatMap(entry=>{
      const lines=entry.noteLines||[];if(!lines.length)return [entry];
      const capacity=Math.max(1,Math.floor((height-entry.height-22)/17)),parts=[];
      for(let at=0;at<lines.length;at+=capacity){const noteLines=lines.slice(at,at+capacity);parts.push({...entry,noteLines,continued:at>0,height:entry.height+22+noteLines.length*17});}
      return parts;
    });
  }
  function placePins(points,bounds){
    const occupied=[];
    for(const point of points){
      let chosen;const fits=p=>p.x>=bounds.left&&p.x<=bounds.right&&p.y>=bounds.top&&p.y<=bounds.bottom&&occupied.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=29);
      if(fits(point))chosen={...point};
      search:for(let ring=1;!chosen&&ring<=32;ring++)for(let step=0;step<ring*12;step++){
        const angle=step/(ring*12)*Math.PI*2,p={x:point.x+ring*16*Math.cos(angle),y:point.y+ring*16*Math.sin(angle)};
        if(fits(p)){chosen=p;break search;}
      }
      occupied.push(chosen||{...point});
    }
    return occupied;
  }
  function pdf(images){
    if(!images.length)throw Error('No map sheets to print.');
    const enc=new TextEncoder(),chunks=[],offsets=[0];let length=0;
    const add=value=>{const bytes=typeof value==='string'?enc.encode(value):value;chunks.push(bytes);length+=bytes.length;};
    const object=(id,parts)=>{offsets[id]=length;add(`${id} 0 obj\n`);for(const part of parts)add(part);add('\nendobj\n');};
    add('%PDF-1.4\n');object(1,['<< /Type /Catalog /Pages 2 0 R >>']);
    object(2,[`<< /Type /Pages /Count ${images.length} /Kids [${images.map((_,i)=>(3+i*3)+' 0 R').join(' ')}] >>`]);
    images.forEach((image,i)=>{const id=3+i*3,stream='q\n792 0 0 612 0 0 cm\n/Map Do\nQ\n';
      object(id,[`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 792 612] /Resources << /XObject << /Map ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`]);
      object(id+1,[`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,image.bytes,'\nendstream']);
      object(id+2,[`<< /Length ${enc.encode(stream).length} >>\nstream\n`,stream,'endstream']);
    });
    const start=length;add(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);for(const n of offsets.slice(1))add(String(n).padStart(10,'0')+' 00000 n \n');
    add(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`);
    const result=new Uint8Array(length);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}return result;
  }
  return {date,visit,wrap,sheets,notes,withNotes,placePins,pdf};
});
