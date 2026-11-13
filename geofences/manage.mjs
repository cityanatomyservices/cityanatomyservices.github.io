import {validate,validId,pageURL} from './model.mjs?v=20261109h';
import {call,redirectBilling} from './client.mjs?v=20261109h';
import {createMap} from './map.mjs?v=20261109h';
import {qr,copyLink,downloadQR} from './share.mjs?v=20261109h';
const $=id=>document.getElementById(id),form=$('geofence-form'),field=name=>form.elements.namedItem(name),S=window.AustinSession;
const previewHost=document.querySelector('.geofence-preview'),phone=matchMedia('(max-width:700px)');
function layout(){if(phone.matches)$('geo-confirm').closest('label').before(previewHost);else document.querySelector('.geofence-grid').append(previewHost);}
phone.addEventListener('change',layout);layout();
let owner=null,revision=0,busy=false,chosen=null,preview=null,draftId=crypto.randomUUID(),mapView,mapPromise,checkoutEnabled=false,freeTesting=false;
const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
function message(text){$('geo-form-status').textContent=text;}
function pricing(){
 $('geo-pricing').textContent=freeTesting?'Free while testing — no payment or card required.':'$10 USD per month for each geofence, billed monthly.';
 $('geo-pay').textContent=freeTesting?'Create geofence · Free while testing':'Continue to payment · $10/month';
 $('geo-billing-note').textContent=freeTesting?'Temporary free access lasts while testing is enabled. You will not be charged automatically. Location and size are fixed once activated. Your permanent link stays the same.':'Renews monthly until canceled. Cancel through Manage billing; access continues through the paid period. Your link stays the same. Location and size are fixed once checkout starts.';
}
function controls(){field('address').disabled=field('mode').value!=='address'||busy;for(const n of ['latitude','longitude'])field(n).disabled=field('mode').value!=='coordinates'||busy;
 $('geo-gps').disabled=busy;$('geo-search').disabled=busy;$('geo-preview').disabled=busy;$('geo-pay').disabled=busy||!checkoutEnabled||!preview||!$('geo-confirm').checked;$('geo-confirm').disabled=busy||!preview;
 for(const name of ['name','description','diameter'])field(name).disabled=busy;
 form.querySelectorAll('[name=mode]').forEach(e=>e.disabled=busy);
}
function invalidate(){revision++;preview=null;$('geo-confirm').checked=false;controls();}
function point(){if(field('mode').value==='address'){if(!chosen)throw Error('Find and select an address first.');return chosen;}
 if(field('latitude').value.trim()===''||field('longitude').value.trim()==='')throw Error('Enter both latitude and longitude.');return {latitude:Number(field('latitude').value),longitude:Number(field('longitude').value)};
}
function value(){return validate({name:field('name').value,description:field('description').value,...point(),diameter:Number(field('diameter').value)});}
async function map(){if(!mapPromise)mapPromise=createMap('geofence-map').then(v=>mapView=v).catch(e=>{mapPromise=null;throw e;});return mapPromise;}
field('mode').forEach(e=>e.addEventListener('change',()=>{chosen=null;$('geo-results').replaceChildren();field('address').value='';field('latitude').value=field('longitude').value='';$('geo-address-fields').hidden=field('mode').value!=='address';$('geo-coordinate-fields').hidden=field('mode').value!=='coordinates';invalidate();}));
$('geo-gps').onclick=async()=>{
 if(busy)return;invalidate();const run=revision,who=owner;busy=true;controls();message('Finding your current location…');
 try{
  if(!navigator.geolocation)throw Error('GPS is unavailable in this browser. Enter an address or coordinates instead.');
  const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,maximumAge:0,timeout:20000}));
  if(run!==revision||who!==owner)return;
  const {latitude,longitude,accuracy}=position.coords;
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>85||Math.abs(longitude)>180||!Number.isFinite(position.timestamp)||Date.now()-position.timestamp>45000||position.timestamp>Date.now()+5000)throw Error('GPS did not return a fresh location. Try again or enter coordinates.');
  field('mode').value='coordinates';chosen=null;field('address').value='';$('geo-results').replaceChildren();$('geo-address-fields').hidden=true;$('geo-coordinate-fields').hidden=false;
  field('latitude').value=latitude.toFixed(6);field('longitude').value=longitude.toFixed(6);
  message('Current location selected'+(Number.isFinite(accuracy)?' · about '+Math.round(accuracy)+' m accuracy':'')+'. Show the location on the map and check the circle.');
 }catch(error){if(run===revision&&who===owner)message(error.code===1?'Location permission is off. Allow it or enter an address or coordinates.':error.code===3?'GPS timed out. Try again outdoors or enter coordinates.':error.message||'Could not find your location. Try again or enter coordinates.');}
 finally{if(run===revision&&who===owner){busy=false;controls();}}
};
form.addEventListener('input',e=>{if(e.target.id==='geo-confirm'){controls();return;}if(e.target.name==='address'){chosen=null;$('geo-results').replaceChildren();}invalidate();
 if(e.target.name==='diameter'&&mapView){try{mapView.draw(value(),false);$('geo-preview-caption').textContent=field('diameter').value+' meters across. Show location again to confirm this size.';}catch{}}
});
$('geo-search').onclick=async()=>{const run=revision,who=owner;busy=true;controls();$('geo-results').textContent='Looking up address…';
 try{const data=await call('geocode',{address:field('address').value});if(run!==revision||who!==owner)return;$('geo-results').replaceChildren();
 if(!data.matches.length)$('geo-results').textContent='No matching address found. Try a full street address or use coordinates.';
 for(const match of data.matches){const b=node('button',match.label);b.type='button';b.onclick=()=>{chosen=match;field('address').value=match.label;$('geo-results').textContent='Address selected. Show the location on the map to check it.';invalidate();};$('geo-results').append(b);}
 }catch(e){if(who===owner)$('geo-results').textContent=e.message;}finally{if(who===owner){busy=false;controls();}}};
$('geo-preview').onclick=async()=>{const run=revision,who=owner;busy=true;controls();message('Loading map preview…');try{const data=value(),view=await map();if(run!==revision||who!==owner)return;view.draw(data);preview=data;if(phone.matches)$('geofence-map').scrollIntoView({behavior:'smooth',block:'center'});$('geo-preview-caption').textContent=`${data.diameter} meters across · ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`;message('Check the circle, then confirm the location below.');}catch(e){if(who===owner)message(e.message);}finally{if(who===owner){busy=false;controls();}}};
form.onsubmit=async e=>{e.preventDefault();if(busy||!preview||!$('geo-confirm').checked||!checkoutEnabled)return;const who=owner;busy=true;controls();message('Saving your geofence…');try{await call('save',{id:draftId,fields:preview});if(who!==owner)return;message(freeTesting?'Activating your geofence…':'Opening secure payment…');const data=await call('checkout',{id:draftId});if(who!==owner)return;if(data.activated===true){draftId=crypto.randomUUID();invalidate();await list();message('Your geofence is active for free while testing. Open its permanent link or download the QR code below.');$('geo-owned').scrollIntoView({behavior:'smooth',block:'start'});}else redirectBilling(data.url);}catch(error){if(who===owner){await list();message(error.message+' If this geofence appears below, use its activation button to retry.');}}finally{if(who===owner){busy=false;controls();}}};
async function list(){const who=owner;if(!who)return;$('geo-list-status').textContent='Loading your geofences…';
 try{const data=await call('list');if(who!==owner)return;checkoutEnabled=data.checkoutEnabled;freeTesting=data.freeTesting===true;pricing();controls();$('geo-owned').replaceChildren();$('geo-list-status').textContent=data.spaces.length?'':'You have no geofences yet.';
 if(!checkoutEnabled)message('Geofence payments are being set up. You can try the location and circle preview now.');
 for(const item of data.spaces){const card=node('article','');card.className='geofence-card';const active=item.temporaryAccess===true||item.status==='active'&&Date.parse(item.paidUntil)>Date.now();card.append(node('h3',item.name),node('p',item.description),node('p',`${item.diameter} m diameter · ${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`));
 card.append(node('p',item.temporaryAccess?'Active · Free while testing. No automatic charge.':active?`${item.cancelAtPeriodEnd?'Active until':'Paid through'} ${new Date(item.paidUntil).toLocaleDateString()}`:item.hasBilling?'Not active — check your subscription or payment status.':'Not active yet.'));
 const link=node('a',pageURL(item.id));link.href=pageURL(item.id);link.className='geofence-link';card.append(link);const qrHost=node('div','');qrHost.className='geofence-qr';qrHost.innerHTML=qr(item.id);card.append(node('br',''),qrHost);
 const actions=node('div','');actions.className='geofence-actions';const status=node('p','');status.setAttribute('role','status');
 const action=(label,fn)=>{const b=node('button',label);b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};actions.append(b);return b;};
 action('Copy link',()=>copyLink(item.id).then(()=>{status.textContent='Link copied.';}));action('Download QR code',()=>downloadQR(item.id));
 if(item.hasBilling){action('Manage billing',async()=>redirectBilling((await call('portal',{id:item.id})).url));action('Check payment',async()=>{await call('status',{id:item.id});await list();});}
 if(!active){const b=action(freeTesting?'Activate free while testing':'Continue to payment · $10/month',async()=>{const data=await call('checkout',{id:item.id});if(data.activated===true)await list();else redirectBilling(data.url);});b.disabled=!checkoutEnabled;}
 card.append(actions,status);$('geo-owned').append(card);
 }
 }catch(e){if(who===owner)$('geo-list-status').textContent=e.message;}
}
$('geo-refresh').onclick=list;$('geo-signin-button').onclick=()=>window.AustinAccount?.open();
async function account(){await S.peek();const next=S.registered?S.user.id:null;if(next===owner)return;owner=next;revision++;busy=false;chosen=null;preview=null;checkoutEnabled=false;draftId=crypto.randomUUID();form.reset();$('geo-results').replaceChildren();$('geo-owned').replaceChildren();message('');$('geo-address-fields').hidden=false;$('geo-coordinate-fields').hidden=true;$('geo-member').hidden=!owner;$('geo-signin').hidden=!!owner;controls();if(owner){await list();map().catch(e=>message(e.message));}}
S.subscribe(()=>account());await account();if(!owner){$('geo-signin').hidden=false;$('geo-member').hidden=true;}
if(!owner){try{const {data}=await S.client().rpc('access_testing_status');if(!owner){freeTesting=data?.geofencesEnabled===true;pricing();}}catch{}}
const params=new URLSearchParams(location.search),returned=params.get('id');
if(owner&&validId(returned)&&['success','return'].includes(params.get('billing'))){$('geo-list-status').textContent='Checking payment confirmation…';try{await call('status',{id:returned});await list();}catch(e){$('geo-list-status').textContent=e.message;}history.replaceState(null,'','/geofences/manage/');}
