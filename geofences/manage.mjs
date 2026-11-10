import {validate,validId,pageURL} from './model.mjs?v=20261109h';
import {call,redirectBilling} from './client.mjs?v=20261109h';
import {createMap} from './map.mjs?v=20261109h';
import {qr,copyLink,downloadQR} from './share.mjs?v=20261109h';
const $=id=>document.getElementById(id),form=$('geofence-form'),field=name=>form.elements.namedItem(name),S=window.AustinSession;
const previewHost=document.querySelector('.geofence-preview'),phone=matchMedia('(max-width:700px)');
function layout(){if(phone.matches)$('geo-confirm').closest('label').before(previewHost);else document.querySelector('.geofence-grid').append(previewHost);}
phone.addEventListener('change',layout);layout();
let owner=null,revision=0,busy=false,chosen=null,preview=null,draftId=crypto.randomUUID(),mapView,mapPromise,checkoutEnabled=false;
const node=(tag,text)=>{const e=document.createElement(tag);e.textContent=text;return e;};
function message(text){$('geo-form-status').textContent=text;}
function controls(){field('address').disabled=field('mode').value!=='address'||busy;for(const n of ['latitude','longitude'])field(n).disabled=field('mode').value!=='coordinates'||busy;
 $('geo-search').disabled=busy;$('geo-preview').disabled=busy;$('geo-pay').disabled=busy||!checkoutEnabled||!preview||!$('geo-confirm').checked;$('geo-confirm').disabled=busy||!preview;
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
form.addEventListener('input',e=>{if(e.target.id==='geo-confirm'){controls();return;}if(e.target.name==='address'){chosen=null;$('geo-results').replaceChildren();}invalidate();
 if(e.target.name==='diameter'&&mapView){try{mapView.draw(value(),false);$('geo-preview-caption').textContent=field('diameter').value+' meters across. Show location again to confirm this size.';}catch{}}
});
$('geo-search').onclick=async()=>{const run=revision,who=owner;busy=true;controls();$('geo-results').textContent='Looking up address…';
 try{const data=await call('geocode',{address:field('address').value});if(run!==revision||who!==owner)return;$('geo-results').replaceChildren();
 if(!data.matches.length)$('geo-results').textContent='No matching address found. Try a full street address or use coordinates.';
 for(const match of data.matches){const b=node('button',match.label);b.type='button';b.onclick=()=>{chosen=match;field('address').value=match.label;$('geo-results').textContent='Address selected. Show the location on the map to check it.';invalidate();};$('geo-results').append(b);}
 }catch(e){if(who===owner)$('geo-results').textContent=e.message;}finally{if(who===owner){busy=false;controls();}}};
$('geo-preview').onclick=async()=>{const run=revision,who=owner;busy=true;controls();message('Loading map preview…');try{const data=value(),view=await map();if(run!==revision||who!==owner)return;view.draw(data);preview=data;if(phone.matches)$('geofence-map').scrollIntoView({behavior:'smooth',block:'center'});$('geo-preview-caption').textContent=`${data.diameter} meters across · ${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}`;message('Check the circle, then confirm the location below.');}catch(e){if(who===owner)message(e.message);}finally{if(who===owner){busy=false;controls();}}};
form.onsubmit=async e=>{e.preventDefault();if(busy||!preview||!$('geo-confirm').checked||!checkoutEnabled)return;const who=owner;busy=true;controls();message('Saving your geofence…');try{await call('save',{id:draftId,fields:preview});if(who!==owner)return;message('Opening secure payment…');const data=await call('checkout',{id:draftId});if(who!==owner)return;redirectBilling(data.url);}catch(error){if(who===owner){await list();message(error.message+' If this geofence appears below, use its Continue to payment button to retry.');}}finally{if(who===owner){busy=false;controls();}}};
async function list(){const who=owner;if(!who)return;$('geo-list-status').textContent='Loading your geofences…';
 try{const data=await call('list');if(who!==owner)return;checkoutEnabled=data.checkoutEnabled;controls();$('geo-owned').replaceChildren();$('geo-list-status').textContent=data.spaces.length?'':'You have no geofences yet.';
 if(!checkoutEnabled)message('Geofence payments are being set up. You can try the location and circle preview now.');
 for(const item of data.spaces){const card=node('article','');card.className='geofence-card';const active=item.status==='active'&&Date.parse(item.paidUntil)>Date.now();card.append(node('h3',item.name),node('p',item.description),node('p',`${item.diameter} m diameter · ${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}`));
 card.append(node('p',active?`${item.cancelAtPeriodEnd?'Active until':'Paid through'} ${new Date(item.paidUntil).toLocaleDateString()}`:item.hasBilling?'Not active — check your subscription or payment status.':'Draft — payment not started.'));
 const link=node('a',pageURL(item.id));link.href=pageURL(item.id);link.className='geofence-link';card.append(link);const qrHost=node('div','');qrHost.className='geofence-qr';qrHost.innerHTML=qr(item.id);card.append(node('br',''),qrHost);
 const actions=node('div','');actions.className='geofence-actions';const status=node('p','');status.setAttribute('role','status');
 const action=(label,fn)=>{const b=node('button',label);b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};actions.append(b);return b;};
 action('Copy link',()=>copyLink(item.id).then(()=>{status.textContent='Link copied.';}));action('Download QR code',()=>downloadQR(item.id));
 if(item.hasBilling){action('Manage billing',async()=>redirectBilling((await call('portal',{id:item.id})).url));action('Check payment',async()=>{await call('status',{id:item.id});await list();});}
 if(!active){const b=action('Continue to payment · $10/month',async()=>redirectBilling((await call('checkout',{id:item.id})).url));b.disabled=!checkoutEnabled;}
 card.append(actions,status);$('geo-owned').append(card);
 }
 }catch(e){if(who===owner)$('geo-list-status').textContent=e.message;}
}
$('geo-refresh').onclick=list;$('geo-signin-button').onclick=()=>window.AustinAccount?.open();
async function account(){await S.peek();const next=S.registered?S.user.id:null;if(next===owner)return;owner=next;revision++;busy=false;chosen=null;preview=null;checkoutEnabled=false;draftId=crypto.randomUUID();form.reset();$('geo-results').replaceChildren();$('geo-owned').replaceChildren();message('');$('geo-address-fields').hidden=false;$('geo-coordinate-fields').hidden=true;$('geo-member').hidden=!owner;$('geo-signin').hidden=!!owner;controls();if(owner){await list();map().catch(e=>message(e.message));}}
S.subscribe(()=>account());await account();if(!owner){$('geo-signin').hidden=false;$('geo-member').hidden=true;}
const params=new URLSearchParams(location.search),returned=params.get('id');
if(owner&&validId(returned)&&['success','return'].includes(params.get('billing'))){$('geo-list-status').textContent='Checking payment confirmation…';try{await call('status',{id:returned});await list();}catch(e){$('geo-list-status').textContent=e.message;}history.replaceState(null,'','/geofences/manage/');}
