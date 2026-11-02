/* A single destination at a time; exporting never changes the itinerary. */
(()=>{
  const S=window.PlanStore,E=window.PlanExport,$=id=>document.getElementById(id),dialog=$('export-dialog');
  const labels={'google-calendar':'Google Calendar','apple-calendar':'Apple Calendar','google-maps':'Google Maps','apple-maps':'Apple Maps'};
  let current='',lastPlan='';
  const selected=()=>dialog.querySelector('input[name=export-format]:checked').value;
  const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
  const descriptions={
    'google-calendar':['Downloads an .ics file with your planned times, locations, source links and notes. On a computer, open Google Calendar → Settings → Import & export and select the file. Imports are copies; later planner edits do not sync automatically.','https://support.google.com/calendar/answer/37118?hl=en'],
    'apple-calendar':['Downloads an .ics file with your planned times, locations, source links and notes. On Mac, open Calendar → File → Import and select the file. Imports are copies; later planner edits do not sync automatically.','https://support.apple.com/guide/calendar/icl1023/mac'],
    'google-maps':['Creates driving-route links. Scheduled stops go in time order, followed by untimed stops in preferred order. Routes with more than five stops are split into parts for mobile browsers. Check toll preferences in Google Maps; it calculates its own routes.','https://developers.google.com/maps/documentation/urls/get-started'],
    'apple-maps':['Creates driving-route links. Scheduled stops go in time order, followed by untimed stops in preferred order. Multi-stop links require iOS 18.4+ or macOS 15.4+. Longer routes are split into parts. Apple Maps calculates its own routes.','https://developer.apple.com/documentation/mapkit/unified-map-urls']
  };
  function render(){
    const plan=S.plan,format=selected(),p=E.prepare(plan,format);current=format;lastPlan=JSON.stringify(plan);
    const date=new Intl.DateTimeFormat('en-US',{timeZone:PlanModel.zone,weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(PlanModel.instant(plan.date+'T12:00')));
    $('export-day').textContent=date;
    $('export-summary').textContent=p.items.length?`${p.items.length} ${p.calendar?'scheduled visit':'located stop'}${p.items.length===1?'':'s'} ready to export from this day.`:p.calendar?'Set an arrival time for at least one stop on this day.':'Add a stop with a map location, or set its driving entrance on the map.';
    $('export-help').textContent=descriptions[format][0];$('export-guide').href=descriptions[format][1];
    $('export-guide').textContent=`${labels[format]} instructions ↗`;
    const omitted=$('export-skipped');omitted.replaceChildren();omitted.hidden=!p.skipped.length;
    if(p.skipped.length){
      omitted.append(node('summary',`${p.skipped.length} stop${p.skipped.length===1?'':'s'} not included`));
      omitted.append(node('p',p.calendar?'Set a valid arrival time within this plan day and a visit length for these stops:':'Set a driving entrance for these stops to include them on a map:'));
      const list=document.createElement('ul');p.skipped.forEach(i=>list.append(node('li',i.source.title)));omitted.append(list);
    }
    $('export-action').textContent=p.calendar?'Download .ics':'Create route links';$('export-action').disabled=!p.items.length;
    $('export-results').replaceChildren();$('export-status').textContent='';
  }
  $('export-plan').onclick=()=>{render();dialog.showModal();};
  $('export-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>$('export-plan').focus({preventScroll:true}));
  dialog.addEventListener('change',event=>{if(event.target.name==='export-format')render();});
  $('export-action').onclick=()=>{
    try{
      const plan=S.plan,format=selected();
      if(current!==format||lastPlan!==JSON.stringify(plan))render();
      if(E.prepare(plan,format).calendar){
        const file=E.calendar(plan),url=URL.createObjectURL(new Blob([file.text],{type:file.type})),a=document.createElement('a');
        a.href=url;a.download=file.filename;dialog.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
        $('export-status').textContent=`Download prepared for ${labels[format]}. You can select another destination and export again.`;
      }else{
        const parts=E.maps(plan,format.split('-')[0]),results=$('export-results');results.replaceChildren();
        parts.forEach((part,i)=>{
          const section=document.createElement('section'),link=node('a',`Open in ${labels[format]} ↗`);
          section.append(node('h3',parts.length>1?`Part ${i+1} of ${parts.length}`:'Your route'));
          const list=document.createElement('ol');part.items.forEach(item=>list.append(node('li',item.source.title)));section.append(list);
          link.href=part.url;link.target='_blank';link.rel='noopener noreferrer';link.className='button';section.append(link);results.append(section);
        });
        $('export-status').textContent=parts.length>1?`${parts.length} route links ready. Open each part in order; adjacent parts share a stop.`:'Route link ready. Open it below, or select another destination.';
      }
    }catch(error){$('export-status').textContent=error.message;}
  };
  S.subscribe(()=>{if(dialog.open&&lastPlan!==JSON.stringify(S.plan))render();});
  S.ready().then(()=>$('export-plan').disabled=false);
})();
