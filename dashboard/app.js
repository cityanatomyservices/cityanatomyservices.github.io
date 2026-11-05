import {columns,display,workbook} from './export.js?v=20261105b';
const $=id=>document.getElementById(id),S=window.AustinSession;
let generation=0,controller=new AbortController(),owner=null,authorized=false,reports=[],query=null,
  pageRows=[],pageIndex=0,cursors=[''],nextCursor=null,busy=false,staticRows=null;
const identity=()=>S.registered?S.user.id:null;
function valid(run){if(run!==generation||identity()!==owner||!authorized)throw new Error('Session changed. Run the report again.');}
async function rpc(name,args={},run=generation){
  const result=await S.client().rpc(name,args).abortSignal(controller.signal);
  if(run!==generation||identity()!==owner)throw new Error('Session changed.');
  if(result.error)throw new Error(result.error.code==='42501'?'This dashboard is restricted to its authorized owner.':result.error.message||'The request could not finish.');
  return result.data;
}
function clear(){
  generation++;controller.abort();controller=new AbortController();authorized=false;owner=identity();
  reports=[];query=null;pageRows=[];staticRows=null;busy=false;cursors=[''];pageIndex=0;nextCursor=null;
  $('dashboard-content').hidden=true;$('dashboard-gate').hidden=false;$('results').tHead.replaceChildren();$('results').tBodies[0].replaceChildren();
  $('report').replaceChildren();$('query-form').reset();$('grant-form').reset();$('grant-button').disabled=false;$('revoke-button').disabled=false;$('grant-status').textContent='';$('query-status').textContent='';$('result-summary').textContent='Choose a report to begin.';
  $('page-number').textContent='';$('export').disabled=true;$('previous').disabled=true;$('next').disabled=true;$('cancel').hidden=true;
}
async function authorize(){
  clear();const run=generation;$('access-retry').hidden=true;$('dashboard-signin').hidden=true;$('gate-message').textContent='Checking access…';
  try{
    await S.peek();if(run!==generation)return;owner=identity();
    if(!owner){$('gate-message').textContent='Sign in with the authorized owner account to use reports and exports.';$('dashboard-signin').hidden=false;return;}
    const catalog=await rpc('dashboard_catalog',{},run);
    const response=await fetch('/dashboard/datasets.json?v=20261105b',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw new Error('The site dataset catalog could not load.');
    const datasets=await response.json();if(run!==generation)return;
    reports=[...catalog.map(r=>({...r,section:'Members and site activity'})),...datasets];authorized=true;
    populate();$('report-count').textContent=reports.length+' available reports';$('dashboard-gate').hidden=true;$('dashboard-content').hidden=false;controls();
  }catch(error){if(run!==generation)return;$('gate-message').textContent=error.message;$('access-retry').hidden=false;}
}
function populate(){
  const selected=$('report').value,find=$('report-find').value.toLowerCase(),groups=new Map();$('report').replaceChildren();
  for(const r of reports.filter(r=>(r.title+' '+r.section).toLowerCase().includes(find))){
    if(!groups.has(r.section)){const group=document.createElement('optgroup');group.label=r.section;groups.set(r.section,group);$('report').append(group);}
    const option=document.createElement('option');option.value=r.id;option.textContent=r.title;groups.get(r.section).append(option);
  }
  if([...$('report').options].some(o=>o.value===selected))$('report').value=selected;
  changed();
}
function changed(){
  const r=reports.find(r=>r.id===$('report').value);$('report-description').textContent=r?.description||'No matching reports.';
  $('room-filter').hidden=r?.id!=='chat';if(r?.id!=='chat')$('room').value='';
  query=null;staticRows=null;pageRows=[];nextCursor=null;cursors=[''];pageIndex=0;$('results').tHead.replaceChildren();$('results').tBodies[0].replaceChildren();
  $('result-summary').textContent='Run this report to see results.';$('page-number').textContent='';controls();
}
function controls(){
  $('run-query').disabled=busy||!authorized||!$('report').value;$('export').disabled=busy||!query;
  $('previous').disabled=busy||!query||pageIndex===0;$('next').disabled=busy||nextCursor===null;
  $('cancel').hidden=!busy;for(const id of ['report','report-find','search','date-from','date-to','room'])$(id).disabled=busy;
}
function filters(){
  const from=$('date-from').value,to=$('date-to').value;
  const start=from?new Date(from+'T00:00:00Z').toISOString():null;
  const end=to?new Date(Date.parse(to+'T00:00:00Z')+86400000).toISOString():null;
  if(start&&end&&start>=end)throw new Error('The end date must be on or after the start date.');
  return {report:reports.find(r=>r.id===$('report').value),search:$('search').value.trim(),from:start,to:end,room:$('room').value.trim()};
}
async function staticData(q,run){
  const response=await fetch(q.report.url,{cache:'no-store',credentials:'omit',signal:controller.signal});
  if(!response.ok)throw new Error('This dataset could not load. Try again.');const data=await response.json();valid(run);
  let source=q.report.key===null?data:data[q.report.key];if(!Array.isArray(source))throw new Error('The dataset format changed. Refresh its report catalog.');
  if(q.report.key==='groups')source=source.flatMap(group=>(group.categories||[]).flatMap(category=>(category.places||[]).map(place=>({neighborhood:data.name,group:group.name,category:category.name,...place}))));
  if((q.from||q.to)&&!q.report.dateField)throw new Error('This dataset has no date column. Clear the date filters.');
  return source.map((v,index)=>v?.type==='Feature'?{...v.properties,geometry_type:v.geometry?.type,
    ...(v.geometry?.type==='Point'?{longitude:v.geometry.coordinates[0],latitude:v.geometry.coordinates[1]}:{})}:typeof v==='object'&&v!==null?v:{value:v})
    .filter(row=>(!q.search||JSON.stringify(row).toLowerCase().includes(q.search.toLowerCase()))&&
      (!q.from||Date.parse(row[q.report.dateField])>=Date.parse(q.from))&&(!q.to||Date.parse(row[q.report.dateField])<Date.parse(q.to)));
}
async function fetchPage(q,cursor,limit,run){
  valid(run);
  if(q.report.url){
    if(!staticRows)staticRows=await staticData(q,run);const offset=Number(cursor||0),rows=staticRows.slice(offset,offset+limit);
    return {rows,more:offset+limit<staticRows.length,cursor:offset+limit<staticRows.length?String(offset+limit):null};
  }
  return rpc('dashboard_query',{p_report:q.report.id,p_search:q.search,p_from:q.from,p_to:q.to,p_room:q.room,p_cursor:cursor||'',p_limit:limit},run);
}
function render(rows){
  pageRows=rows;const head=$('results').tHead,body=$('results').tBodies[0];head.replaceChildren();body.replaceChildren();
  const keys=columns(rows),tr=document.createElement('tr');for(const key of keys){const th=document.createElement('th');th.scope='col';th.textContent=key;tr.append(th);}head.append(tr);
  for(const row of rows){const tr=document.createElement('tr');for(const key of keys){const td=document.createElement('td');td.textContent=display(row[key]);tr.append(td);}body.append(tr);}
  $('result-summary').textContent=rows.length?`${pageIndex*200+1}–${pageIndex*200+rows.length} shown${nextCursor!==null?' · more available':''}`:'No matching rows.';
  $('page-number').textContent='Page '+(pageIndex+1);
}
async function runPage(index,newQuery=false){
  if(busy)return;const run=generation;busy=true;controls();$('query-status').textContent='Running report…';
  try{
    if(newQuery){query=filters();cursors=[''];staticRows=null;}
    const result=await fetchPage(query,cursors[index],200,run);valid(run);pageIndex=index;nextCursor=result.more?result.cursor:null;render(result.rows);
    $('query-status').textContent='';
  }catch(error){if(run===generation){$('query-status').textContent=error.message;query=null;}}
  finally{if(run===generation){busy=false;controls();}}
}
async function exportReport(){
  if(busy||!query)return;const run=generation,q=query;busy=true;controls();let rows=[],cursor='',started=new Date().toISOString();
  try{
    if(!await rpc('dashboard_authorized',{},run))throw new Error('Dashboard access has been revoked.');
    do{
      const result=await fetchPage(q,cursor,1000,run);valid(run);rows.push(...result.rows);
      if(rows.length>50000||(rows.length===50000&&result.more))throw new Error('More than 50,000 rows match. Narrow the filters and export again. No partial file was downloaded.');
      $('query-status').textContent='Preparing Excel: '+rows.length.toLocaleString()+' rows…';cursor=result.more?result.cursor:null;
    }while(cursor!==null);
    if(!await rpc('dashboard_authorized',{},run))throw new Error('Dashboard access has been revoked.');valid(run);
    const book=workbook(window.XLSX,rows,{Report:q.report.title,'Export started (UTC)':started,'Export finished (UTC)':new Date().toISOString(),
      'Matching rows':rows.length,Search:q.search,'From (inclusive, UTC)':q.from,'To (exclusive, UTC)':q.to,Room:q.room,
      Note:'Live report; records may change while exporting. IDs remain stable across pages. Geometry is omitted from dataset exports.'});
    window.XLSX.writeFile(book,'austin-'+q.report.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-'+new Date().toISOString().slice(0,10)+'.xlsx');
    $('query-status').textContent='Exported '+rows.length.toLocaleString()+' rows to Excel.';
  }catch(error){if(run===generation)$('query-status').textContent=error.message;}
  finally{rows=[];if(run===generation){busy=false;controls();}}
}
async function grant(revoke=false){
  if(!authorized)return;const run=generation,email=$('grant-email').value.trim();
  if(!$('grant-email').reportValidity())return;
  if(revoke&&!confirm('Revoke only this member’s Substack-derived site access? Their paid subscriptions will stay unchanged.'))return;
  if(!revoke&&!$('grant-form').reportValidity())return;
  $('grant-button').disabled=true;$('revoke-button').disabled=true;$('grant-status').textContent='Saving…';
  try{
    const until=!revoke?new Date($('grant-until').value).toISOString():null;
    if(until&&Date.parse(until)<=Date.now())throw new Error('Use the subscriber’s future paid-through date.');
    const result=await rpc(revoke?'dashboard_substack_revoke':'dashboard_substack_grant',revoke?{p_email:email}:{p_email:email,p_plan:$('grant-plan').value,p_until:until},run);valid(run);
    $('grant-status').textContent=revoke?'Substack-derived access revoked if present. Site-paid access was preserved.':'Included site Pro access saved. No charge or email was created.'+(result?.hasSiteBilling?' This member also has site billing; review their subscriptions to avoid paying twice.':'');
    $('grant-verified').checked=false;
  }catch(error){if(run===generation)$('grant-status').textContent=error.message;}
  finally{if(run===generation){$('grant-button').disabled=false;$('revoke-button').disabled=false;}}
}
$('query-form').onsubmit=e=>{e.preventDefault();runPage(0,true);};$('report').onchange=changed;$('report-find').oninput=populate;
$('previous').onclick=()=>runPage(pageIndex-1);$('next').onclick=()=>{cursors[pageIndex+1]=nextCursor;runPage(pageIndex+1);};$('export').onclick=exportReport;
$('cancel').onclick=()=>{controller.abort();controller=new AbortController();};
$('grant-form').onsubmit=e=>{e.preventDefault();grant();};$('revoke-button').onclick=()=>grant(true);
$('dashboard-signin').onclick=()=>document.querySelector('.sign-in-button')?.click();$('access-retry').onclick=authorize;
S.subscribe(()=>{if(identity()!==owner)authorize();});window.addEventListener('pagehide',clear);authorize();
