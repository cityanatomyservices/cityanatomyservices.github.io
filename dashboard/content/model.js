/* Shared Browse filters; selected records are frozen editorial snapshots. */
(function(root,factory){const api=factory(typeof module==='object'?require('../../chat/explore/model.js'):root.ExploreModel);if(typeof module==='object')module.exports=api;else root.ContentDeskModel=api;})(globalThis,M=>{
  const clean=v=>String(v??'').replace(/\r/g,'');
  const url=v=>{if(typeof v!=='string'||!v.trim())return '';try{const u=new URL(v,'https://austin.chat');return /^https?:$/.test(u.protocol)?u.href:'';}catch{return '';}};
  const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const day=(now=Date.now(),delta=0)=>new Date(Date.parse(M.dayKey(now)+'T12:00:00Z')+delta*86400000).toISOString().slice(0,10);
  const format=(v,time=true)=>Number.isFinite(Date.parse(v))?new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',weekday:'short',month:'short',day:'numeric',...(time?{hour:'numeric',minute:'2-digit'}:{})}).format(new Date(v)):'';
  function options(state,now=Date.now()) {return {...state,when:state.when==='tomorrow'?'date':state.when,date:state.when==='tomorrow'?day(now,1):state.date,where:'all',kind:state.kind||'all',price:state.price||'20',movieType:state.movieType||'all'};}
  function event(f,category){
    const p=f.properties,shows=p.kind==='movie'?p.showtimes||[]:[];
    const times=shows.length?shows.map(s=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}).format(new Date(s.start))+(s.format?' ('+s.format+')':'')).join(', '):'';
    return {id:'event:'+p.id,title:p.title,category,coordinates:f.geometry.coordinates.slice(),when:shows.length?format(p.start,false)+' · '+times:format(p.start,!p.allDay)+(p.allDay?' · All day':p.endKnown?' – '+new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',minute:'2-digit'}).format(new Date(p.end)):''),venue:p.venue||'',address:p.address||'',price:p.priceLabel|| (p.price===0?'Free':Number.isFinite(p.price)?'$'+p.price:'Check admission'),url:url(p.url),description:p.description||'',conditions:p.conditions||'',checked:p.checked||'',expires:p.expires||'',start:p.start,note:''};
  }
  function events(feeds,layers,state,now=Date.now()){
    const records=new Map(),opts=options(state,now);
    for(const layer of layers.filter(l=>state.categories.includes(l.id)))for(const f of M.filter(feeds[layer.id]?.features||[],opts,now))records.set(f.properties.id,event(f,layer.title));
    return [...records.values()].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.title.localeCompare(b.title));
  }
  function matches(item,query){return !query||[item.title,item.venue,item.address,item.description].join(' ').toLowerCase().includes(query.trim().toLowerCase());}
  function lines(item,links){return [item.when,[item.venue,item.address].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · '),item.price,item.conditions,item.note,links&&url(item.url)].filter(Boolean);}
  function plain(doc,{links=true}={}){return [doc.title,doc.intro,...doc.items.map((item,i)=>`${i+1}. ${item.title}\n${lines(item,links).join('\n')}`),'Curated with Austin.chat'].filter(Boolean).join('\n\n');}
  function html(doc,{links=true}={}){return `<article style="max-width:680px;margin:auto;font-family:Arial,sans-serif;color:#173d34;line-height:1.6;background:#fff;padding:32px;border-top:6px solid #16735d"><p style="font-size:11px;letter-spacing:2px;color:#55756b">THE AUSTIN EDIT</p><h1 style="font-size:30px;line-height:1.2;margin:12px 0 20px">${esc(doc.title)}</h1>${doc.intro?`<p style="white-space:pre-wrap">${esc(doc.intro)}</p>`:''}${doc.items.map((item,i)=>`<section style="border-top:1px solid #dce6e1;padding:20px 0"><p style="color:#55756b;font-size:11px;margin:0">${String(i+1).padStart(2,'0')} / ${esc(item.category)}</p><h2 style="font-size:21px;line-height:1.35;margin:5px 0 10px">${esc(item.title)}</h2>${lines(item,false).map(v=>`<p style="margin:4px 0;white-space:pre-wrap">${esc(v)}</p>`).join('')}${links&&url(item.url)?`<p style="margin:10px 0 0"><a style="color:#16735d" href="${esc(url(item.url))}" target="_blank" rel="noopener noreferrer">Details &amp; source ↗</a></p>`:''}</section>`).join('')}<p style="font-size:12px;color:#55756b;border-top:1px solid #dce6e1;padding-top:18px">Curated with <a href="https://austin.chat/" style="color:#16735d">Austin.chat</a></p></article>`;}
  const file=doc=>'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>'+esc(doc.title)+'</title><body style="background:#eff3ef;margin:0;padding:24px 0">'+html(doc)+'</body></html>';
  // Newsletter editors keep semantic blocks but discard card CSS. The post
  // title belongs in their separate Title field; this is the article body.
  function newsletter(doc){
    const paragraphs=value=>clean(value).split(/\n\s*\n/).filter(Boolean).map(v=>'<p>'+esc(v).replace(/\n/g,'<br>')+'</p>').join('');
    const detail=(label,value)=>value?'<strong>'+label+':</strong> '+esc(value).replace(/\n/g,'<br>'):'';
    return (doc.intro?paragraphs(doc.intro):'')+doc.items.map((item,i)=>{
      const place=[item.venue,item.address].filter(Boolean).filter((v,n,a)=>a.indexOf(v)===n).join(' · ');
      const facts=[detail('When',item.when),detail('Where',place),detail('Admission',item.price)].filter(Boolean).join('<br>');
      return (i?'<hr>':'')+'<h2><strong>'+esc((i+1)+'. '+item.title)+'</strong></h2>'+(facts?'<p>'+facts+'</p>':'')+(item.conditions?paragraphs(item.conditions):'')+(item.note?paragraphs(item.note):'')+(url(item.url)?'<p><a href="'+esc(url(item.url))+'">Details &amp; source ↗</a></p>':'');
    }).join('')+'<hr><p><em>Curated with <a href="https://austin.chat/">Austin.chat</a></em></p>';
  }
  function newsletterText(doc){return [doc.intro,...doc.items.map((item,i)=>`${i+1}. ${item.title}\n${lines(item,true).join('\n')}`),'Curated with Austin.chat'].filter(Boolean).join('\n\n');}
  function validPoint(point){
    return Array.isArray(point)&&point.length===2&&point.every(Number.isFinite)&&Math.abs(point[0])<=180&&Math.abs(point[1])<=90;
  }
  function enteredPoint(text){
    const parts=text.trim().split(',').map(s=>s.trim());
    if(parts.length!==2||!parts.every(s=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)))return null;
    const point=[Number(parts[1]),Number(parts[0])];
    return validPoint(point)?point:null;
  }
  function mapFile(template,doc){
    const rows=doc.items.map(item=>{
      if(!validPoint(item.coordinates))throw Error('A pick is missing its map location.');
      const [lng,lat]=item.coordinates;
      return `<li><button data-lng="${lng}" data-lat="${lat}">${esc(item.title)}</button></li>`;
    });
    return template.replace(/<!--LIST_(TITLE|ITEMS)-->/g,(_,key)=>key==='TITLE'?esc(doc.title.trim()||'Untitled list'):rows.join('\n'));
  }
  return {clean,url,esc,day,format,options,event,events,matches,plain,html,file,newsletter,newsletterText,validPoint,enteredPoint,mapFile};
});
