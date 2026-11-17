/* Owner-only editorial workspace. No planner state, social publishing or local draft storage. */
(()=>{
  const $=id=>document.getElementById(id),S=window.AustinSession,M=window.ContentDeskModel,E=window.ExploreModel,layers=window.EXPLORE_LAYERS;
  const extra=[{id:'city-hall',title:'City Hall'},{id:'classifieds',title:'Classifieds'},{id:'special-events',title:'Special Events'},{id:'pro-apps',title:'Pro Tier Apps'},{id:'businesses',title:'Neighborhood Businesses'}];
  const identity=()=>S.registered?S.user.id:null,node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  let owner=null,authorized=false,epoch=0,controller=new AbortController(),catalog=[],doc=null,id=null,revision=0,serial=0,saved=0,saving=null,timer=null,limit=30,exportDoc=null,transitioning=false;
  let feeds={},failures={},loading=new Set(),matches=[],filterTimer;
  let mapDraft=null;
  const clearedInCurate=new Set();
  const state={when:'tomorrow',date:M.day(),categories:layers.map(l=>l.id),query:'',price:'20',kind:'all',movieType:'all'};
  function current(run){return run===epoch&&owner===identity()&&authorized;}
  async function rpc(name,args={},run=epoch){
    const result=await S.client().rpc(name,args).abortSignal(AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]));
    if(run!==epoch||owner!==identity())throw Error('Account changed.');
    if(result.error){const e=Error(result.error.code==='42501'?'This page is restricted to its authorized owner.':result.error.message||'The request could not finish.');e.code=result.error.code;throw e;}
    return result.data;
  }
  function clear(){
    clearedInCurate.clear();
    mapDraft=null;$('location-dialog').close();$('location-fields').replaceChildren();$('map-status').textContent='';$('pick-status').textContent='';
    epoch++;controller.abort();controller=new AbortController();clearTimeout(timer);clearTimeout(filterTimer);authorized=false;owner=identity();catalog=[];doc=null;id=null;revision=0;serial=saved=0;saving=null;feeds={};failures={};loading=new Set();matches=[];exportDoc=null;
    $('desk-content').hidden=true;$('access-gate').hidden=false;for(const key of ['results','selected-items','saved-lists','export-preview'])$(key).replaceChildren();
    for(const key of ['list-title','list-intro','export-text'])$(key).value='';$('export-dialog').close();$('save-status').textContent='';$('source-status').textContent='';$('save-retry').hidden=true;$('save-copy').hidden=true;
  }
  async function authorize(){
    clear();const run=epoch;$('desk-signin').hidden=true;$('access-retry').hidden=true;$('gate-message').textContent='Checking access…';
    try{await S.peek();if(run!==epoch)return;owner=identity();if(!owner){$('gate-message').textContent='Sign in with your authorized owner account to open your content desk.';$('desk-signin').hidden=false;return;}
      if(!await rpc('dashboard_authorized',{},run))throw Error('This page is restricted to its authorized owner.');
      catalog=await rpc('content_desk_lists',{},run);if(run!==epoch)return;authorized=true;
      if(catalog.length)await openList(catalog[0].id);else blank();if(!current(run))return;
      $('access-gate').hidden=true;$('desk-content').hidden=false;loadResults();
    }catch(e){if(run===epoch){$('gate-message').textContent=e.message;$('access-retry').hidden=false;}}
  }
  function library(){
    const options=catalog.map(v=>new Option(v.title+' · '+v.count+' picks',v.id));
    if(doc&&!catalog.some(v=>v.id===id))options.unshift(new Option(doc.title+' · new list',id));
    $('saved-lists').replaceChildren(...options);$('saved-lists').value=id||'';$('delete-list').disabled=!revision;
  }
  function blank(copy){id=crypto.randomUUID();revision=0;doc=copy?structuredClone(copy):{title:'Tomorrow in Austin · '+M.format(M.day(Date.now(),1)+'T12:00:00-06:00',false),intro:'',items:[]};serial=saved=0;renderDocument();$('save-status').textContent='Select a few things to start this list.';}
  async function openList(next){const run=epoch,value=await rpc('content_desk_get',{p_id:next},run);if(!current(run))return;id=value.id;doc=value.document;revision=value.revision;serial=saved=0;renderDocument();$('save-status').textContent='Saved privately to your account.';}
  function renderDocument(){clearedInCurate.clear();library();$('list-title').value=doc.title;$('list-intro').value=doc.intro;$('map-status').textContent='';selected();results();}
  function saveStatus(message,error=false){$('save-status').textContent=message;$('save-status').classList.toggle('error',error);$('save-retry').hidden=!error;$('save-copy').hidden=!error;}
  function changed(){serial++;saveStatus('Saving…');clearTimeout(timer);timer=setTimeout(flush,600);}
  async function flush(){
    clearTimeout(timer);if(saving){if(!await saving)return false;return serial>saved?flush():true;}if(!doc||serial===saved)return true;
    const run=epoch,saveId=id;
    saving=(async()=>{try{while(current(run)&&saveId===id&&serial>saved){const at=serial,snapshot=structuredClone(doc);snapshot.title=snapshot.title.trim()||'Untitled list';
        const value=await rpc('content_desk_save',{p_id:saveId,p_revision:revision,p_document:snapshot},run);if(!current(run)||id!==saveId)return false;revision=value.revision;saved=at;
        const meta={id,title:snapshot.title,count:snapshot.items.length,revision,updated:value.updated};catalog=[meta,...catalog.filter(v=>v.id!==id)];library();}
      if(current(run))saveStatus('Saved privately to your account.');return current(run);
    }catch(e){if(current(run)){saveStatus(e.message+' Your changes are still here.',true);if(e.code==='42501')authorize();}return false;}finally{if(run===epoch)saving=null;}})();
    return saving;
  }
  async function switchList(next){const previous=id;if(await flush()){try{await openList(next);}catch(e){saveStatus(e.message,true);$('saved-lists').value=previous;}}else $('saved-lists').value=previous;}
  async function transition(task){if(transitioning||!authorized)return;const run=epoch;transitioning=true;document.querySelector('.workspace').inert=true;for(const key of ['saved-lists','new-list','duplicate-list','delete-list'])$(key).disabled=true;try{await task();}catch(e){if(current(run))saveStatus(e.message,true);}finally{transitioning=false;document.querySelector('.workspace').inert=false;for(const key of ['saved-lists','new-list','duplicate-list'])$(key).disabled=false;$('delete-list').disabled=!revision;}}
  async function newList(copy=false){if(!await flush())return;const before=copy?structuredClone(doc):null;if(before)before.title=(before.title+' — copy').slice(0,160);blank(before);changed();await flush();$('list-title').focus();$('list-title').select();}
  function add(item){if(!doc)return;if(doc.items.some(v=>v.id===item.id))return;if(doc.items.length>=250){results();$('pick-status').textContent='This list has 250 picks. Create a new list to keep curating.';return;}doc.items.push(structuredClone(item));changed();selected();results();}
  function remove(itemId){
    if(clearedInCurate.delete(itemId)){selected();results();return;}
    doc.items=doc.items.filter(v=>v.id!==itemId);changed();selected();results();
  }
  function clearPicks(){
    if(!doc?.items.length)return;
    for(const item of doc.items)clearedInCurate.add(item.id);
    doc.items=[];
    $('map-status').textContent='';
    changed();selected();results();
  }
  function toggleMatches(){
    if(!authorized||!doc||!matches.length)return;
    const previousCount=doc.items.length;
    if($('select-matches').checked){
      const picked=new Set(doc.items.map(item=>item.id));
      const additions=matches.filter(item=>!picked.has(item.id));
      const remaining=250-doc.items.length;
      if(additions.length>remaining){
        results();
        $('pick-status').textContent='Your list has room for '+remaining+' more. Narrow the filters or select individual listings.';
        return;
      }
      doc.items.push(...structuredClone(additions));
      for(const item of additions)clearedInCurate.delete(item.id);
    }else{
      const visibleIds=new Set(matches.map(item=>item.id));
      for(const itemId of visibleIds)clearedInCurate.delete(itemId);
      doc.items=doc.items.filter(item=>!visibleIds.has(item.id));
    }
    if(doc.items.length!==previousCount)changed();
    selected();results();
  }
  function selected(){
    $('clear-picks').disabled=!doc?.items.length;
    $('export-map').disabled=!doc?.items.length;
    if(!doc)return;const count=doc.items.length;$('selection-count').textContent=count+' '+(count===1?'pick':'picks');$('mobile-count').textContent=count;$('export-list').disabled=!count;$('selected-items').replaceChildren();
    if(!count){
      const message=clearedInCurate.size?'List cleared. To add a checked listing again, uncheck it and recheck it in Discover.':'Your next post starts here. Check any listing to add it to this list.';
      $('selected-items').append(node('p',message,'empty'));return;
    }
    doc.items.forEach((item,index)=>{const article=node('article',undefined,'pick'),top=node('div',undefined,'pick-top');top.append(node('span',String(index+1).padStart(2,'0'),'pick-number'),node('h3',item.title));article.append(top,node('p',[item.when,item.venue,item.price].filter(Boolean).join(' · '),'hint'));
      if(item.expires&&Date.parse(item.expires)<=Date.now())article.append(node('p','Saved research: recheck the source before posting.','hint'));
      const actions=node('div',undefined,'pick-tools');for(const [label,delta] of [['↑',-1],['↓',1]]){const b=node('button',label);b.setAttribute('aria-label',(delta<0?'Move up: ':'Move down: ')+item.title);b.disabled=index+delta<0||index+delta>=count;b.onclick=()=>{[doc.items[index],doc.items[index+delta]]=[doc.items[index+delta],doc.items[index]];changed();selected();};actions.append(b);}
      const drop=node('button','Remove');drop.setAttribute('aria-label','Remove '+item.title);drop.onclick=()=>remove(item.id);actions.append(drop);article.append(actions);
      const label=node('label','Your note / angle'),note=node('textarea');note.rows=2;note.maxLength=2000;note.placeholder='What makes this worth sharing?';note.value=item.note||'';note.oninput=()=>{item.note=note.value;changed();};label.append(note);article.append(label);$('selected-items').append(article);
    });
  }
  function safeLink(text,href){const a=node('a',text);a.href=M.url(href);a.target='_blank';a.rel='noopener noreferrer';return a;}
  async function json(url){const response=await fetch(url,{cache:'no-cache',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});if(!response.ok)throw Error('Source unavailable');return response.json();}
  async function eventFeed(layer){const values=await Promise.allSettled([json(layer.url),json('https://raw.githubusercontent.com/cityanatomyservices/cityanatomyservices.github.io/main'+layer.url)]);const good=values.filter(v=>v.status==='fulfilled').map(v=>v.value).filter(v=>v.type==='FeatureCollection'&&Array.isArray(v.features)&&Number.isFinite(Date.parse(v.generated))).sort((a,b)=>Date.parse(b.generated)-Date.parse(a.generated));if(!good.length)throw Error('Source unavailable');return good[0];}
  function keyFor(category){return category==='classifieds'?category+':'+$('ad-category').value:category==='businesses'?category+':'+$('neighborhood').value:category;}
  async function source(category,force=false){
    const key=keyFor(category),run=epoch;if(loading.has(key)||(!force&&feeds[key]))return;
    if(category==='businesses'&&!$('neighborhood').value)return;
    loading.add(key);results();
    try{let value;const layer=layers.find(v=>v.id===category);
      if(layer)value=await eventFeed(layer);
      else if(category==='city-hall'){value=await json('/chat/data/city-hall.json');if(!Array.isArray(value.records)||!Array.isArray(value.sources)||!value.records.every(r=>typeof r.title==='string'&&window.CityHallModel.safeURL(r.url)&&Array.isArray(r.districts)))throw Error('City Hall data could not be read.');}
      else if(category==='classifieds'){const ads=[];let offset=0,part;do{part=await rpc('classifieds_read',{p_category:key.split(':')[1],p_offset:offset},run);if(!current(run))return;ads.push(...part.ads);offset+=20;if(offset>10000&&part.more)throw Error('Too many ads; this category could not be read completely.');}while(part.more);value={ads:[...new Map(ads.map(v=>[v.id,v])).values()]};}
      else if(category==='businesses'){value=await json('/chat/data/places/'+encodeURIComponent(key.split(':')[1])+'.json');if(!Array.isArray(value.groups)||!value.groups.every(g=>Array.isArray(g.categories)&&g.categories.every(c=>Array.isArray(c.places))))throw Error('The neighborhood directory could not be read.');}
      else {value={home:await json('/home.json'),...(category==='pro-apps'?{reports:await json('/apps/reports/reports.json')}:{})};if(!Array.isArray(value.home.chips)||!Array.isArray(value.home.categories)||category==='pro-apps'&&!Array.isArray(value.reports))throw Error('The app catalog could not be read.');}
      if(!current(run))return;feeds[key]=value;delete failures[key];
      if(category==='city-hall'){const board=$('board').value,boards=[...new Set(value.records.filter(r=>r.category==='meetings').map(r=>r.board).filter(Boolean))].sort();$('board').replaceChildren(new Option('All boards',''),...boards.map(v=>new Option(v,v)));$('board').value=boards.includes(board)?board:'';}
      if(category==='businesses'&&key===keyFor(category)){const names=value.groups.flatMap(g=>g.categories.map(c=>c.name));$('business-category').replaceChildren(new Option('All categories',''),...names.map(v=>new Option(v,v)));}
    }catch(e){if(current(run))failures[key]=e.message;}finally{if(current(run)){loading.delete(key);results();}}
  }
  async function loadNeighborhoods(){if($('neighborhood').options.length>1)return;const run=epoch;try{const data=await json('/chat/data/geofences.geojson');if(!current(run))return;$('neighborhood').append(...data.features.map(f=>f.properties).sort((a,b)=>a.name.localeCompare(b.name)).map(v=>new Option(v.name,v.id)));}catch{if(current(run))$('source-status').textContent='Neighborhood directory could not load. Use Refresh to retry.';}}
  function loadResults(force=false){if(!authorized)return;limit=30;state.categories=[...document.querySelectorAll('[data-category]:checked')].map(el=>el.value);
    $('city-filters').hidden=!state.categories.includes('city-hall');$('ad-filters').hidden=!state.categories.includes('classifieds');$('business-filters').hidden=!state.categories.includes('businesses');
    if(state.categories.includes('businesses'))loadNeighborhoods();for(const category of state.categories)source(category,force);results();}
  function allResults(){
    const opts=M.options(state),now=Date.now(),out=M.events(feeds,layers,state,now);
    if(state.categories.includes('city-hall')&&feeds['city-hall']){
      const feed=feeds['city-hall'];for(const r of window.CityHallModel.filter(feed.records,{...opts,category:$('city-category').value,district:$('district').value,board:$('board').value},now))out.push({id:'city:'+r.id,title:r.title,category:'City Hall',when:(r.category==='meetings'?'':r.category==='permits'?'Issued ':r.category==='development'?'Filed ':'Published ')+M.format(r.date,!r.dateOnly)+(r.dateOnly&&r.category==='meetings'?' · Time: see agenda':''),venue:r.location||'',address:'',price:'',url:M.url(r.url),description:[r.board,r.type,r.status,r.number,r.description].filter(Boolean).join(' · '),conditions:r.hearingDate?'Hearing: '+r.hearingDate:'',expires:r.expires,checked:feed.sources.find(s=>s.id===r.source)?.checked||'',note:''});
    }
    if(state.categories.includes('classifieds')){const [first,last]=E.dateWindow(opts,now,true);for(const ad of window.ClassifiedsModel.filter(feeds[keyFor('classifieds')]?.ads||[],{first,last})){if(ad.mine)continue;const title=window.ClassifiedsModel.categories.find(c=>c.id===ad.category)?.title||'Classifieds';out.push({id:'ad:'+ad.id,title:ad.title,category:title,when:'Posted '+M.format(ad.created_at,false),venue:'',address:'',price:'',url:'https://austin.chat/classifieds/'+ad.category+'/',description:ad.body,conditions:'',note:''});}}
    for(const category of ['special-events','pro-apps'])if(state.categories.includes(category)&&feeds[category]){
      const {home,reports=[]}=feeds[category],cards=(home.chips||[]).find(c=>c.label==='Apps')?.cards||[];
      const keep=category==='special-events'?cards.filter(c=>c.category==='Special Events'&&(!c.expiresAt||Date.parse(c.expiresAt)>now)):cards.filter(c=>(c.kind||'apps')!=='maps'||home.categories.includes(c.category));
      for(const c of [...keep,...reports.map(r=>({...r,slug:r.id,kind:home.reportsKind||'apps'}))])out.push({id:'catalog:'+(c.kind||'apps')+':'+c.slug,title:c.title,category:category==='special-events'?'Special Events':'Pro Tier Apps',when:'',venue:'',address:'',price:c.requiredPlan==='pro'?'Pro membership required':'',url:M.url('/'+(c.kind||'apps')+'/'+c.slug+'/'),description:c.blurb||'',conditions:'',expires:c.expiresAt||'',note:''});
    }
    if(state.categories.includes('businesses')){const feed=feeds[keyFor('businesses')];if(feed)for(const g of feed.groups)for(const c of g.categories)if(!$('business-category').value||c.name===$('business-category').value)for(const p of c.places)out.push({id:'place:'+p.id,title:p.name,category:c.name,coordinates:[p.lng,p.lat],when:'',venue:feed.name,address:p.address||'',price:'',url:M.url(p.website)||'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p.name+' '+(p.address||'Austin TX')),description:p.opening_hours?'Published hours: '+p.opening_hours:'',conditions:'',checked:feed.fetched,note:''});}
    return [...new Map(out.filter(v=>M.matches(v,state.query)).map(v=>[v.id,v])).values()];
  }
  function results(){
    if(!authorized||!doc)return;matches=allResults();const box=$('results');box.replaceChildren();$('result-count').textContent=matches.length+' '+(matches.length===1?'listing':'listings');
    const relevant=state.categories.map(keyFor),errors=relevant.filter(k=>failures[k]),pending=relevant.filter(k=>loading.has(k));
    const old=state.categories.filter(k=>feeds[k]?.generated&&Date.now()-Date.parse(feeds[k].generated)>6*3600000),partial=state.categories.filter(k=>feeds[k]?.sources?.some(s=>s.ok===false||s.failures));
    $('source-status').textContent=[pending.length?'Updating '+pending.length+' categories…':'',errors.length?'Could not refresh: '+errors.map(k=>[...layers,...extra].find(v=>v.id===k.split(':')[0])?.title||k).join(', ')+'. Use Refresh to retry.':'',old.length||partial.length?'Some source updates are delayed. Expired event listings are hidden.':''].filter(Boolean).join(' ');$('source-status').classList.toggle('error',errors.length>0);
    $('results-note').textContent=state.categories.some(c=>['special-events','pro-apps','businesses'].includes(c))?'App maps and neighborhood businesses are directories; date filters apply to dated listings.':state.categories.includes('city-hall')?'City Hall uses meeting/hearing dates or the date a notice was posted.':'';
    const selectedIds=new Set(doc.items.map(v=>v.id));
    for(const itemId of clearedInCurate)selectedIds.add(itemId);
    const picked=matches.filter(item=>selectedIds.has(item.id)).length;
    const toggle=$('select-matches');
    toggle.checked=matches.length>0&&picked===matches.length;
    toggle.indeterminate=picked>0&&picked<matches.length;
    toggle.disabled=!matches.length||pending.length>0;
    $('pick-status').textContent='';
    for(const [index,item] of matches.slice(0,limit).entries()){
      const article=node('article',undefined,'result'),checkbox=node('input');checkbox.type='checkbox';checkbox.id='pick-'+index;checkbox.checked=selectedIds.has(item.id);checkbox.onchange=()=>checkbox.checked?add(item):remove(item.id);article.append(checkbox);
      const body=node('div'),heading=node('h3'),label=node('label',item.title);label.htmlFor=checkbox.id;heading.append(label);body.append(node('span',item.category,'category'),heading);
      if(item.when)body.append(node('p',item.when));if(item.venue||item.address)body.append(node('p',[item.venue,item.address].filter(Boolean).join(' · ')));if(item.price)body.append(node('p',item.price));
      if(item.url)body.append(safeLink('Source & details ↗',item.url));
      if(item.description||item.conditions||item.checked){const detail=node('details');detail.append(node('summary','Research details'));for(const text of [item.description,item.conditions,item.checked?'Checked '+M.format(item.checked):''].filter(Boolean))detail.append(node('p',text));body.append(detail);}
      article.append(body);box.append(article);
    }
    if(!matches.length)box.append(node('p',pending.length?'Loading the latest listings…':state.categories.length?'No listings match. Try another date, category, or search.':'Choose one or more categories to begin.','empty'));
    $('show-more').hidden=matches.length<=limit;$('show-more').textContent='Show more ('+(matches.length-Math.min(matches.length,limit))+' remaining)';
  }
  async function canExport(){const run=epoch;if(!authorized||!doc?.items.length)return false;try{if(!await rpc('dashboard_authorized',{},run)){authorize();return false;}return current(run);}catch(e){if(current(run))saveStatus(e.message,true);return false;}}
  async function preview(){if(!await canExport())return;await flush();if(!authorized||!doc)return;exportDoc=structuredClone(doc);exportDoc.title=exportDoc.title.trim()||'Untitled list';$('export-preview').innerHTML=M.html(exportDoc);$('export-text').value=M.plain(exportDoc);$('export-status').textContent='';$('text-fallback').open=false;$('export-dialog').showModal();}
  async function copy(mode){
    if(!exportDoc||!await canExport())return;
    const newsletter=mode==='substack',rich=mode!==false,text=newsletter?M.newsletterText(exportDoc):M.plain(exportDoc),markup=newsletter?M.newsletter(exportDoc):M.html(exportDoc);
    $('export-text').value=text;
    try{
      const richSupported=rich&&window.ClipboardItem&&navigator.clipboard?.write;
      if(richSupported)await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([markup],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);
      else await navigator.clipboard.writeText(text);
      $('export-status').textContent=newsletter&&richSupported?'Substack body copied. Paste into the post body with Ctrl+V (Mac: Command+V). Put your list title in Substack’s Title field.':richSupported?'Copied. Paste into your editor; formatting depends on the destination.':rich?'Copied as plain text: this browser does not support formatted clipboard copying.':'Plain text copied. Ready to paste into a caption.';
    }catch{$('text-fallback').open=true;$('export-text').focus();$('export-text').select();$('export-status').textContent='Clipboard access is unavailable. The text below is selected for you to copy.';}
  }
  function saveFile(title,content,type,suffix){
    const href=URL.createObjectURL(new Blob([content],{type:type+';charset=utf-8'})),a=node('a');
    a.href=href;a.download=(title.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,90)||'austin-list')+suffix;
    a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
  }
  async function download(html){if(!exportDoc||!await canExport())return;saveFile(exportDoc.title,html?M.file(exportDoc):M.plain(exportDoc),html?'text/html':'text/plain',html?'.html':'.txt');$('export-status').textContent='Downloaded this list.';}

  // Older saved lists predate coordinates. Recover exact source IDs where possible.
  async function recoverLocations(items){
    const missing=items.filter(item=>!M.validPoint(item.coordinates));
    const points=new Map();
    const sources=layers.filter(layer=>missing.some(item=>item.id.startsWith('event:')&&item.category===layer.title));
    const tasks=sources.map(async layer=>{
      const feed=feeds[layer.id]||await json(layer.url);
      for(const f of feed.features)if(f.geometry?.type==='Point')points.set('event:'+f.properties.id,f.geometry.coordinates);
    });
    const neighborhoods=new Set(missing.filter(item=>item.id.startsWith('place:')).map(item=>item.venue));
    if(neighborhoods.size)tasks.push((async()=>{
      const index=await json('/chat/data/geofences.geojson');
      await Promise.allSettled(index.features.filter(f=>neighborhoods.has(f.properties.name)).map(async f=>{
        const key=f.properties.id,feed=feeds['businesses:'+key]||await json('/chat/data/places/'+encodeURIComponent(key)+'.json');
        for(const group of feed.groups)for(const category of group.categories)for(const p of category.places)points.set('place:'+p.id,[p.lng,p.lat]);
      }));
    })());
    await Promise.allSettled(tasks);
    for(const item of missing)if(M.validPoint(points.get(item.id)))item.coordinates=points.get(item.id);
  }
  function downloadMap(draft){
    const markup=M.mapFile(draft.template,draft.list);
    let updated=false;
    doc.items.forEach((item,i)=>{
      if(!M.validPoint(item.coordinates)){item.coordinates=draft.list.items[i].coordinates;updated=true;}
    });
    if(updated)changed();
    saveFile(draft.list.title,markup,'text/html','-map.html');
    $('map-status').textContent='Downloaded a map with all '+doc.items.length+' '+(doc.items.length===1?'pick.':'picks.');
  }
  async function startMap(){
    if(!await canExport())return;
    const run=epoch,list=structuredClone(doc);
    $('map-status').textContent='Preparing map…';
    try{
      const request=await fetch('./map-export.html?v=20261117c',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});
      if(!request.ok)throw Error();
      const template=await request.text();
      if(!template.includes('<!--LIST_ITEMS-->'))throw Error();
      await recoverLocations(list.items);
      if(!current(run))return;
      const draft={template,list};
      const fields=$('location-fields');fields.replaceChildren();
      list.items.forEach((item,i)=>{
        if(M.validPoint(item.coordinates))return;
        const label=node('label',(i+1)+'. '+item.title),input=node('input');
        const place=[item.venue,item.address].filter(Boolean).join(' · ');
        if(place)label.append(node('small',place));
        input.required=true;input.placeholder='30.2672, -97.7431';input.dataset.index=i;
        input.oninput=()=>input.setCustomValidity('');
        label.append(input);fields.append(label);
      });
      if(!fields.childElementCount){downloadMap(draft);return;}
      mapDraft=draft;$('map-status').textContent='';$('location-dialog').showModal();
    }catch{if(current(run))$('map-status').textContent='The map export could not load. Try Export map again.';}
  }
  $('location-form').onsubmit=async e=>{
    e.preventDefault();const draft=mapDraft;
    if(!draft)return;
    for(const input of $('location-fields').querySelectorAll('input')){
      const point=M.enteredPoint(input.value);
      if(!point){input.setCustomValidity('Enter latitude (−90 to 90), then longitude (−180 to 180), separated by a comma.');input.reportValidity();return;}
      draft.list.items[Number(input.dataset.index)].coordinates=point;
    }
    if(await canExport()&&mapDraft===draft&&$('location-dialog').open){downloadMap(draft);$('location-dialog').close();}
  };
  $('cancel-map').onclick=()=>$('location-dialog').close();
  $('location-dialog').onclose=()=>{mapDraft=null;$('location-fields').replaceChildren();};
  $('select-matches').onchange=toggleMatches;
  $('clear-picks').onclick=clearPicks;
  $('export-map').onclick=()=>transition(startMap);
  for(const category of [...layers,...extra]){const label=node('label'),input=node('input');input.type='checkbox';input.value=category.id;input.dataset.category=category.id;input.checked=state.categories.includes(category.id);input.onchange=()=>loadResults();label.append(input,document.createTextNode(category.title));$('categories').append(label);}
  for(let i=1;i<=10;i++)$('district').add(new Option('District '+i+' + citywide',String(i)));
  for(const c of window.ClassifiedsModel.categories)$('ad-category').add(new Option(c.title,c.id));
  $('on-date').value=state.date;
  $('when').onchange=()=>{state.when=$('when').value;$('date-label').hidden=state.when!=='date';limit=30;results();};$('on-date').onchange=()=>{state.date=$('on-date').value;limit=30;results();};
  $('search').oninput=()=>{clearTimeout(filterTimer);filterTimer=setTimeout(()=>{state.query=$('search').value;limit=30;results();},160);};
  for(const [control,key] of [['price','price'],['kind','kind'],['movie-type','movieType']])$(control).onchange=()=>{state[key]=$(control).value;limit=30;results();};
  for(const control of ['city-category','district','board','business-category'])$(control).onchange=()=>{if(control==='city-category')$('board').value='';limit=30;results();};
  $('ad-category').onchange=()=>loadResults();$('neighborhood').onchange=()=>{$('business-category').replaceChildren(new Option('All categories',''));loadResults();};$('refresh-results').onclick=()=>loadResults(true);
  $('event-categories').onclick=()=>{document.querySelectorAll('[data-category]').forEach(el=>el.checked=layers.some(l=>l.id===el.value));loadResults();};$('clear-categories').onclick=()=>{document.querySelectorAll('[data-category]').forEach(el=>el.checked=false);loadResults();};$('show-more').onclick=()=>{limit+=30;results();};
  $('list-title').oninput=()=>{doc.title=$('list-title').value;changed();};$('list-intro').oninput=()=>{doc.intro=$('list-intro').value;changed();};$('saved-lists').onchange=()=>{const next=$('saved-lists').value;transition(()=>switchList(next));};$('new-list').onclick=()=>transition(()=>newList());$('duplicate-list').onclick=()=>transition(()=>newList(true));$('save-retry').onclick=flush;
  $('save-copy').onclick=()=>transition(async()=>{if(saving)await saving;const copy=structuredClone(doc);copy.title=(copy.title+' — recovered').slice(0,160);blank(copy);changed();await flush();});
  $('delete-list').onclick=()=>transition(async()=>{if(!revision||!confirm('Delete “'+doc.title+'”? Downloaded copies will remain.'))return;if(!await flush())return;const run=epoch;await rpc('content_desk_delete',{p_id:id,p_revision:revision},run);if(!current(run))return;catalog=catalog.filter(v=>v.id!==id);if(catalog.length)await openList(catalog[0].id);else blank();});
  $('export-list').onclick=preview;$('close-export').onclick=()=>$('export-dialog').close();$('copy-rich').onclick=()=>copy(true);$('copy-substack').onclick=()=>copy('substack');$('copy-text').onclick=()=>copy(false);$('download-html').onclick=()=>download(true);$('download-text').onclick=()=>download(false);
  for(const view of ['browse','list'])$(view+'-tab').onclick=()=>{document.querySelector('.workspace').dataset.view=view;$('browse-tab').setAttribute('aria-pressed',String(view==='browse'));$('list-tab').setAttribute('aria-pressed',String(view==='list'));};
  $('desk-signin').onclick=()=>document.querySelector('.sign-in-button')?.click();$('access-retry').onclick=authorize;
  window.addEventListener('beforeunload',e=>{if(serial>saved){e.preventDefault();e.returnValue='';}});window.addEventListener('pagehide',clear);window.addEventListener('pageshow',e=>{if(e.persisted)authorize();});
  setInterval(()=>{if(authorized&&!document.hidden)results();},60000);document.addEventListener('visibilitychange',()=>{if(authorized&&!document.hidden)loadResults(true);});
  S.subscribe(()=>{if(identity()!==owner)authorize();});authorize();
})();
