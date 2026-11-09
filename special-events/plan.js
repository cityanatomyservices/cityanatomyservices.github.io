/* Event-only map labels and private, client-side printable map snapshots. */
(() => {
  const P=window.EventPlanPrint,S=window.PlanStore,$=id=>document.getElementById(id);
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  let map,entries=[],leaders,frame,job=0,exportMap,exportHost,pdfURL,snapshot='',lastTrigger,abortPrint;
  const account=()=>window.AustinSession.registered?window.AustinSession.user.id:null;
  const stopNote=item=>window.SpecialEventSavedStore?.row(item.source.sourceId).note||'';
  const signature=()=>JSON.stringify([S.plan,account(),account()?S.plan.items.map(i=>[i.source.sourceId,stopNote(i)]):[]]);
  const button=node('button','Print map');button.type='button';button.id='event-print-map';button.disabled=true;$('planner-map-toolbar').append(button);
  const editorButton=node('button','Print map');editorButton.type='button';editorButton.id='event-print-plan';editorButton.disabled=true;document.querySelector('.plan-map-actions').append(editorButton);
  const dialog=node('dialog',undefined,'event-print-dialog');dialog.id='event-print-dialog';dialog.setAttribute('aria-labelledby','event-print-title');
  dialog.innerHTML='<header><h2 id="event-print-title">Print your event map</h2><button type="button" id="event-print-close" aria-label="Close print preview">×</button></header><p id="event-print-status" role="status" aria-live="polite"></p><div class="event-print-actions"><button type="button" id="event-print-refresh">Prepare map</button><button type="button" id="event-print-download" disabled>Download PDF</button><button type="button" id="event-print-paper" disabled>Print</button></div><iframe id="event-print-preview" title="Printable event day map" hidden></iframe>';
  document.body.append(dialog);
  const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  function layout(){
    if(!map||!leaders)return;leaders.replaceChildren();
    const rect=map.getContainer().getBoundingClientRect(),occupied=entries.map(e=>{const p=map.project(e.point);return {x:p.x-18,y:p.y-18,w:36,h:36,pin:true};});
    const panel=$('plan-panel');if(!panel.hidden){const b=panel.getBoundingClientRect();occupied.push({x:b.x-rect.x,y:b.y-rect.y,w:b.width,h:b.height});}
    for(const entry of entries){
      const p=map.project(entry.point),label=entry.label;label.hidden=p.x<0||p.y<0||p.x>rect.width||p.y>rect.height;if(label.hidden)continue;
      const w=label.offsetWidth,h=label.offsetHeight,candidates=[];
      for(const gap of [22,70,130,200,280,360,480])for(const [dx,dy] of [[gap,-h/2],[-w-gap,-h/2],[-w/2,gap],[-w/2,-h-gap],[gap,gap],[-w-gap,-h-gap]]){
        const x=Math.max(6,Math.min(rect.width-w-6,p.x+dx)),y=Math.max(6,Math.min(rect.height-h-65,p.y+dy));
        const box={x,y,w,h};const cost=occupied.reduce((sum,b)=>sum+overlap(box,b)*(b.pin?1000000:1000),0)+Math.hypot(x+w/2-p.x,y+h/2-p.y);
        candidates.push({...box,cost});
      }
      const box=candidates.sort((a,b)=>a.cost-b.cost)[0];occupied.push({...box,x:box.x-3,y:box.y-3,w:w+6,h:h+6});
      label.style.left=`calc(50% + ${box.x-p.x}px)`;label.style.top=`calc(50% + ${box.y-p.y}px)`;
      const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      for(const [key,value] of Object.entries({x1:p.x,y1:p.y,x2:Math.max(box.x,Math.min(box.x+w,p.x)),y2:Math.max(box.y,Math.min(box.y+h,p.y))}))line.setAttribute(key,value);
      leaders.append(line);
    }
  }
  function queueLayout(){cancelAnimationFrame(frame);frame=requestAnimationFrame(layout);}
  function update(instance,items,markers){
    if(map!==instance){map=instance;leaders=document.createElementNS('http://www.w3.org/2000/svg','svg');leaders.classList.add('event-plan-leaders');leaders.setAttribute('aria-hidden','true');map.getCanvasContainer().append(leaders);map.on('move',queueLayout);map.on('resize',queueLayout);new MutationObserver(queueLayout).observe($('plan-panel'),{attributes:true,attributeFilter:['hidden']});}
    entries=[];
    items.forEach((item,index)=>{
      const marker=markers.find(m=>m.id===item.id)?.marker;if(!marker)return;
      window.SpecialEventSaved?.bind(marker.getPopup(),item.source);
      const el=marker.getElement(),label=node('span',undefined,'event-plan-label'),visit=P.visit(item,S.plan.date);
      label.append(node('strong',item.source.title),node('span',visit.date),node('span',visit.time));if(visit.hours)label.append(node('span',visit.hours));
      if(item.source.eventUnavailable)label.append(node('span','Availability needs checking','event-plan-warning'));
      el.append(label);el.setAttribute('aria-label',`${index+1}. ${item.source.title}. ${visit.date}. ${visit.time}`);
      entries.push({item,number:index+1,point:window.PlanRouting.coordinates(item),label});
    });
    button.disabled=editorButton.disabled=!entries.length;queueLayout();
  }
  function release(){abortPrint?.();abortPrint=null;exportMap?.remove();exportMap=null;exportHost?.remove();exportHost=null;}
  function invalidate(message){job++;release();if(pdfURL)URL.revokeObjectURL(pdfURL);pdfURL=null;$('event-print-download').disabled=$('event-print-paper').disabled=true;$('event-print-preview').hidden=true;$('event-print-preview').srcdoc='';if(message)$('event-print-status').textContent=message;}
  function baseStyle(){
    const style=structuredClone(map.getStyle()),allowed=new Set(['openmaptiles','event-watercolor','satellite']);
    style.layers=style.layers.filter(l=>(!l.source||allowed.has(l.source))&&l.type!=='fill-extrusion');
    style.sources=Object.fromEntries(Object.entries(style.sources).filter(([id])=>allowed.has(id)));delete style.terrain;
    return style;
  }
  async function mapImage(points,style){
    exportHost=node('div',undefined,'event-print-render');exportHost.setAttribute('aria-hidden','true');document.body.append(exportHost);
    exportMap=new maplibregl.Map({container:exportHost,style,interactive:false,attributionControl:false,pixelRatio:2,
      canvasContextAttributes:{preserveDrawingBuffer:true,antialias:true},fadeDuration:0,bearing:0,pitch:0});
    const bounds=points.reduce((b,p)=>b.extend(p),new maplibregl.LngLatBounds(points[0],points[0]));
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>finish(Error('Map tiles took too long. Check your connection and prepare the map again.')),30000);
      const onError=()=>finish(Error('Some map tiles could not load. Check your connection and prepare the map again.'));
      const ready=()=>finish();
      const finish=error=>{clearTimeout(timeout);exportMap?.off('error',onError);exportMap?.off('idle',ready);abortPrint=null;error?reject(error):resolve();};
      abortPrint=()=>finish(Error('Print preview cancelled.'));
      exportMap.on('error',onError);exportMap.once('idle',ready);
      exportMap.fitBounds(bounds,{padding:{top:45,bottom:45,left:280,right:280},maxZoom:16,duration:0});
    });
    const image=document.createElement('canvas');image.width=exportMap.getCanvas().width;image.height=exportMap.getCanvas().height;image.getContext('2d').drawImage(exportMap.getCanvas(),0,0);
    const projected=points.map(p=>{const q=exportMap.project(p);return {x:q.x,y:q.y};});
    return {image,projected};
  }
  const pageWidth=1200,pageHeight=1200*8.5/11,mapX=35,mapY=125,mapWidth=1130,mapHeight=680;
  function box(ctx,x,y,w,h){ctx.fillStyle='#ffffff';ctx.strokeStyle='#806287';ctx.lineWidth=1;ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);}
  async function prepare(){
    invalidate();const run=job,owner=account();snapshot='';
    $('event-print-status').textContent='Preparing a map of this day’s stops…';$('event-print-refresh').disabled=true;
    try{
      if(owner)await window.SpecialEventSavedStore.reload();
      if(run!==job)return;
      if(owner!==account())throw Error('Your account changed. Prepare the map again.');
      snapshot=signature();
      const plan=structuredClone(S.plan),selected=entries.map(e=>{const item=plan.items.find(i=>i.id===e.item.id)||e.item;return {item:structuredClone(item),number:e.number,point:[...e.point],notes:P.notes(item,stopNote(item),!!owner)};});
      window.PlanContext.assert();if(!window.PlanPanel.active||!selected.length)throw Error('Choose a day with planned stops on the map first.');
      const style=baseStyle(),rendered=await mapImage(selected.map(e=>e.point),style);
      if(run!==job)return;
      const canvas=document.createElement('canvas');canvas.width=pageWidth*2;canvas.height=Math.round(pageHeight*2);const ctx=canvas.getContext('2d');ctx.scale(2,2);
      ctx.font='bold 16px Arial';
      const pins=P.placePins(rendered.projected,{left:255,right:mapWidth-255,top:18,bottom:mapHeight-18});
      const records=selected.map((e,i)=>{const visit=P.visit(e.item,plan.date),title=P.wrap(`${e.number}. ${e.item.source.title}`,208,t=>ctx.measureText(t).width);
        ctx.font='14px Arial';const timing=P.wrap(visit.time+(visit.hours?' · '+visit.hours:''),208,t=>ctx.measureText(t).width);ctx.font='bold 16px Arial';
        ctx.font='13px Arial';const noteLines=e.notes.trim()?e.notes.trim().replace(/\n{3,}/g,'\n\n').split(/\r?\n/).flatMap(line=>P.wrap(line,208,t=>ctx.measureText(t).width)):[];ctx.font='bold 16px Arial';
        return {...e,visit,title,timing,noteLines,position:pins[i],location:rendered.projected[i],height:20+title.length*19+18+timing.length*18+(e.item.source.eventUnavailable?36:0)};
      });
      const pages=P.sheets(P.withNotes(records,mapHeight-40),mapHeight-40),images=[],urls=[];
      for(let pageIndex=0;pageIndex<pages.length;pageIndex++){
        if(run!==job)return;
        ctx.fillStyle='#fff';ctx.fillRect(0,0,pageWidth,pageHeight);
        ctx.fillStyle='#713b7d';ctx.font='bold 13px Arial';ctx.fillText('AUSTIN.CHAT / SPECIAL EVENTS',mapX,28);
        ctx.fillStyle='#29212e';ctx.font='bold 24px Arial';
        const heading=P.wrap(S.event?.title||'Special Event day plan',pageWidth-70,t=>ctx.measureText(t).width);heading.slice(0,2).forEach((line,i)=>ctx.fillText(line,mapX,58+i*26));
        ctx.font='16px Arial';ctx.fillText(`${P.date(plan.date)} · ${selected.length} planned stops · Austin time${pages.length>1?' · Map sheet '+(pageIndex+1)+' of '+pages.length:''}`,mapX,heading.length>1?108:91);
        ctx.drawImage(rendered.image,mapX,mapY,mapWidth,mapHeight);ctx.strokeStyle='#b8afb9';ctx.strokeRect(mapX,mapY,mapWidth,mapHeight);
        const displayed=new Set(pages[pageIndex].flat().map(e=>e.number));
        const pin=(r,emphasis)=>{const x=mapX+r.position.x,y=mapY+r.position.y;ctx.beginPath();ctx.arc(x,y,emphasis?13:9,0,Math.PI*2);ctx.fillStyle=emphasis?'#773b88':'#62616a';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold '+(emphasis?13:10)+'px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(r.number,x,y);ctx.textAlign='left';ctx.textBaseline='alphabetic';};
        records.forEach(r=>{
          if(Math.hypot(r.position.x-r.location.x,r.position.y-r.location.y)>1){ctx.strokeStyle='#69556d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(mapX+r.location.x,mapY+r.location.y);ctx.lineTo(mapX+r.position.x,mapY+r.position.y);ctx.stroke();ctx.fillStyle='#69556d';ctx.beginPath();ctx.arc(mapX+r.location.x,mapY+r.location.y,2,0,Math.PI*2);ctx.fill();}
          if(!displayed.has(r.number))pin(r,false);
        });
        pages[pageIndex].forEach((column,side)=>{
          const sorted=[...column].sort((a,b)=>a.position.y-b.position.y);let y=mapY+18;
          for(const [index,r] of sorted.entries()){
            const remaining=sorted.slice(index).reduce((sum,e)=>sum+e.height+18,0)-18;
            y=Math.max(y,Math.min(mapY+mapHeight-18-remaining,mapY+r.position.y-r.height/2));
            const x=side?mapX+mapWidth-240:mapX+12,anchorX=side?x:x+228;
            ctx.strokeStyle='#773b88';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(mapX+r.position.x,mapY+r.position.y);ctx.lineTo(anchorX,y+r.height/2);ctx.stroke();
            box(ctx,x,y,228,r.height);ctx.fillStyle='#29212e';ctx.font='bold 16px Arial';let at=y+22;
            for(const line of r.title){ctx.fillText(line,x+10,at);at+=19;}
            ctx.font='13px Arial';ctx.fillText(r.visit.date,x+10,at);at+=18;
            ctx.font='14px Arial';for(const line of r.timing){ctx.fillText(line,x+10,at);at+=18;}
            if(r.item.source.eventUnavailable){ctx.fillStyle='#8e3c11';ctx.fillText('Availability needs checking',x+10,at+5);at+=36;}
            if(r.noteLines.length){ctx.fillStyle='#29212e';ctx.font='bold 13px Arial';ctx.fillText(r.continued?'My notes (continued)':'My notes',x+10,at+4);at+=21;ctx.font='13px Arial';for(const line of r.noteLines){ctx.fillText(line,x+10,at);at+=17;}}
            y+=r.height+18;
          }
        });
        records.filter(r=>displayed.has(r.number)).forEach(r=>pin(r,true));
        ctx.fillStyle='#4d4753';ctx.font='12px Arial';
        const missing=plan.items.length-selected.length;
        ctx.fillText('Numbers match your plan. Offset pins point to exact locations. Verify opening hours before travelling.'+(missing?' '+missing+' stop(s) without coordinates are not mapped.':''),mapX,mapY+mapHeight+24);
        const watercolor=style.layers.some(l=>l.id==='event-watercolor'&&l.layout?.visibility!=='none'),satellite=style.layers.some(l=>l.id==='satellite'&&l.layout?.visibility!=='none');
        const credit='Map: OpenFreeMap / © OpenMapTiles / © OpenStreetMap contributors.'+(watercolor?' Stamen Watercolor: CC BY 3.0; OSM data: CC BY-SA 2.0. Archive: Cooper Hewitt, Smithsonian.':'')+(satellite?' Imagery © Esri.':'');
        P.wrap(credit,mapWidth,t=>ctx.measureText(t).width).forEach((line,i)=>ctx.fillText(line,mapX,mapY+mapHeight+44+i*15));
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));if(!blob)throw Error('Could not create the printable map.');
        const bytes=new Uint8Array(await blob.arrayBuffer());images.push({bytes,width:canvas.width,height:canvas.height});urls.push(canvas.toDataURL('image/jpeg',.94));
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      if(run!==job)return;window.PlanContext.assert();
      pdfURL=URL.createObjectURL(new Blob([P.pdf(images)],{type:'application/pdf'}));
      const preview=$('event-print-preview');preview.onload=()=>{if(run!==job)return;preview.contentDocument.title=`${S.event?.title||'Event'} · ${plan.date}`;$('event-print-paper').disabled=false;};
      preview.srcdoc='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@page{size:letter landscape;margin:0}*{box-sizing:border-box}body{margin:0;background:#eee}img{display:block;width:100%;height:auto;background:white;margin:0 auto 12px;break-after:page;page-break-after:always}img:last-child{break-after:auto;page-break-after:auto}@media print{body{background:white}img{width:11in;height:8.5in;margin:0}}</style></head><body>'+urls.map((url,i)=>`<img src="${url}" alt="Planned stops map sheet ${i+1}">`).join('')+'</body></html>';
      preview.hidden=false;$('event-print-download').disabled=false;
      $('event-print-status').textContent=`${pages.length} printable map sheet${pages.length===1?'':'s'} ready for ${P.date(plan.date)}. Each sheet covers all ${selected.length} mapped stops.${pages.length>1?' Titles continue across the sheets to keep them readable.':''} Use Download PDF to save a copy, or Print.`;
    }catch(error){if(run===job)$('event-print-status').textContent=error.message;}
    finally{if(run===job){release();$('event-print-refresh').disabled=false;}}
  }
  function open(event){lastTrigger=event.currentTarget;dialog.showModal();prepare();}
  button.onclick=editorButton.onclick=open;$('event-print-refresh').onclick=prepare;$('event-print-close').onclick=()=>dialog.close();
  $('event-print-download').onclick=()=>{if(!pdfURL||signature()!==snapshot)return;const a=node('a');a.href=pdfURL;a.download=`${S.scope}-${S.plan.date}-map.pdf`;dialog.append(a);a.click();a.remove();};
  $('event-print-paper').onclick=()=>{if(!pdfURL||signature()!==snapshot)return;$('event-print-preview').contentWindow.focus();$('event-print-preview').contentWindow.print();};
  dialog.addEventListener('close',()=>{invalidate();lastTrigger?.focus();});
  S.subscribe(()=>{if(dialog.open&&snapshot&&snapshot!==signature()){invalidate('Your plan changed. Prepare the map again to print the current day and times.');$('event-print-refresh').disabled=false;}});
  window.SpecialEventSavedStore?.subscribe(()=>{if(dialog.open&&snapshot&&snapshot!==signature()){invalidate('Your saved notes or account changed. Prepare the map again to include the current notes.');$('event-print-refresh').disabled=false;}});
  window.addEventListener('austin:planner-view',event=>{if(!event.detail.active&&dialog.open)dialog.close();queueLayout();});
  window.addEventListener('pagehide',()=>{invalidate();cancelAnimationFrame(frame);});
  window.SpecialEventPlan={update};
})();
