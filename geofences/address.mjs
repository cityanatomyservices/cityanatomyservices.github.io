// Accessible address suggestions; typing never locks the rest of the form.
export function addressAutocomplete({input,results,status,button,lookup,canSearch,onSelect}){
 let revision=0,timer,rows=[],active=-1,nextRequest=0,inFlight=false,pending=null;
 const close=()=>{results.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
 function clear(text=''){revision++;clearTimeout(timer);pending=null;rows=[];results.replaceChildren();status.textContent=text;close();}
 function highlight(index){
  active=index;
  [...results.children].forEach((el,i)=>el.setAttribute('aria-selected',String(i===active)));
  if(active>=0){input.setAttribute('aria-activedescendant',results.children[active].id);results.children[active].scrollIntoView({block:'nearest'});}
 }
 function select(index){
  const match=rows[index];if(!match||!canSearch())return;
  clear('Address selected. Show the location on the map to check it.');input.value=match.label;onSelect(match);input.focus();
 }
 function show(matches){
  results.replaceChildren();rows=matches;active=-1;
  if(!rows.length){close();status.textContent='No Austin metro matches. Add the street name and city, or use Find address with the full address.';return;}
  rows.forEach((match,i)=>{const option=document.createElement('div');option.id='geo-address-option-'+i;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.textContent=match.label;option.addEventListener('pointerdown',e=>e.preventDefault());option.addEventListener('click',()=>select(i));results.append(option);});
  results.hidden=false;input.setAttribute('aria-expanded','true');status.textContent=rows.length+' Austin metro '+(rows.length===1?'match':'matches')+'. Choose an address.';
 }
 function queue(full=false,delay=400){
  const query=input.value.trim(),run=revision;
  if(!canSearch()||query.length<4||(!full&&!/^\d+\s+\S/.test(query)))return;
  pending={query,run,full};status.textContent='Looking for Austin metro addresses…';
  clearTimeout(timer);timer=setTimeout(execute,Math.max(delay,nextRequest-Date.now()));
 }
 async function execute(){
  if(inFlight||!pending)return;
  const {query,run,full}=pending;pending=null;
  if(run!==revision||!canSearch())return;
  inFlight=true;nextRequest=Date.now()+3200;results.setAttribute('aria-busy','true');
  try{
   const data=await lookup(full?'geocode':'suggest',query);
   if(run===revision&&canSearch()&&input.value.trim()===query)show(Array.isArray(data.matches)?data.matches:[]);
  }catch{
   if(run===revision&&canSearch()){close();status.textContent='Address lookup is temporarily unavailable. Try Find address again in a moment.';}
  }finally{
   inFlight=false;results.removeAttribute('aria-busy');
   if(pending){clearTimeout(timer);timer=setTimeout(execute,Math.max(0,nextRequest-Date.now()));}
  }
 }
 input.addEventListener('input',()=>{clear();queue();});
 input.addEventListener('keydown',e=>{
  if(e.key==='Escape'){clear();return;}
  if(e.key==='Enter'){e.preventDefault();if(!results.hidden&&active>=0)select(active);else{clear();queue(true,0);}return;}
  if(['ArrowDown','ArrowUp'].includes(e.key)&&rows.length){e.preventDefault();results.hidden=false;input.setAttribute('aria-expanded','true');highlight(active<0?(e.key==='ArrowDown'?0:rows.length-1):(active+(e.key==='ArrowDown'?1:rows.length-1)+rows.length)%rows.length);}
 });
 input.addEventListener('focus',()=>{if(rows.length){results.hidden=false;input.setAttribute('aria-expanded','true');}});
 input.addEventListener('blur',()=>close());
 button.addEventListener('click',()=>{clear();if(input.value.trim().length<4){status.textContent='Start with a street number and street name in the Austin metro area.';input.focus();return;}queue(true,0);});
 return {clear};
}
