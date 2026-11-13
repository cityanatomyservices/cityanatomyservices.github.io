import {validId,fixStatus,pageURL} from './model.mjs?v=20261109h';
import {createMap} from './map.mjs?v=20261109h';
import {qr,copyLink,downloadQR} from './share.mjs?v=20261109h';
const $=id=>document.getElementById(id),S=window.AustinSession,id=new URLSearchParams(location.search).get('id');
let fence,view,fix,watch=null,refresh=null,timer=null,attempt=0,wanted=false,inflight=false,lastMessage=0;
const status=text=>{$('geo-gps-status').textContent=text;};
async function rpc(args){const {data,error}=await S.client().rpc('geofence_chat',{p_id:id,...args});if(error)throw error;return data;}
function clearChat(){ $('geo-chat-content').hidden=true;$('geo-people').textContent='Open Chat and allow location to join and see who is here.';$('geo-messages').replaceChildren();$('geo-message').value='';lastMessage=0;}
async function leave(){attempt++;wanted=false;fix=null;clearInterval(timer);clearInterval(refresh);if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;timer=refresh=null;clearChat();$('geo-join').hidden=false;$('geo-leave').hidden=true;status('You left the chat.');try{await rpc({p_leave:true});}catch{}}
async function poll(text=null){if(!wanted||inflight)return;const reason=fixStatus(fence,fix);if(reason){clearChat();status(reason);return;}const run=attempt;inflight=true;
 try{const data=await rpc({p_lat:fix.latitude,p_lng:fix.longitude,p_accuracy:fix.accuracy,p_timestamp:new Date(fix.timestamp).toISOString(),p_text:text});if(run!==attempt||!wanted||fixStatus(fence,fix))return;
  $('geo-chat-content').hidden=false;status('You are inside the circle. Chat is open.');const people=document.createElement('ul');for(const p of data.people){const row=document.createElement('li');row.textContent=p.name+(p.id===data.self?' (you)':'');people.append(row);}$('geo-people').replaceChildren(document.createTextNode(`Here now (${data.people.length})`),people);
  for(const m of data.messages){if(m.id<=lastMessage)continue;lastMessage=m.id;const li=document.createElement('li'),name=document.createElement('strong');name.textContent=m.nickname+(m.visitor_id===data.self?' (you)':'');li.append(name,document.createTextNode(m.body));$('geo-messages').append(li);while($('geo-messages').children.length>100)$('geo-messages').firstChild.remove();$('geo-messages').scrollTop=$('geo-messages').scrollHeight;}
  if(text)$('geo-message').value='';
 }catch(e){if(run===attempt){clearChat();status(e.message||'Chat connection lost. Retrying…');if(e.code==='PT410'){await leave();status('This geofence is no longer active.');}}}finally{inflight=false;}
}
async function join(){if(wanted)return;if(!navigator.geolocation){status('This browser does not provide location.');return;}wanted=true;attempt++;const run=attempt;$('geo-join').hidden=true;$('geo-leave').hidden=false;status('Allow location access to check this circle.');try{await S.ready();if(run!==attempt)return;}catch{await leave();status('Could not connect to chat. Please try again.');return;}
 const success=pos=>{if(run!==attempt)return;fix={latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy,timestamp:pos.timestamp};if(fixStatus(fence,fix)){clearChat();rpc({p_leave:true}).catch(()=>{});}poll();};
 const failure=()=>{if(run!==attempt)return;fix=null;clearChat();status('Location is unavailable. Allow precise location access to join.');rpc({p_leave:true}).catch(()=>{});};
 const options={enableHighAccuracy:true,maximumAge:0,timeout:15000};watch=navigator.geolocation.watchPosition(success,failure,options);refresh=setInterval(()=>navigator.geolocation.getCurrentPosition(success,failure,options),20000);timer=setInterval(()=>poll(),3000);
}
$('geo-chat-toggle').onclick=()=>{const open=$('geo-chat-panel').hidden;$('geo-chat-panel').hidden=!open;$('geo-chat-toggle').setAttribute('aria-expanded',String(open));if(open){$('geo-chat-panel').scrollIntoView({behavior:'smooth',block:'start'});$('geo-join').focus({preventScroll:true});}else if(wanted)leave();};
async function ownership(){const who=S.registered?S.user.id:null;$('geo-manage').hidden=true;if(!who||!validId(id))return;try{const {data,error}=await S.client().rpc('geofence_is_owner',{p_id:id});if(!error&&S.registered&&S.user.id===who)$('geo-manage').hidden=data!==true;}catch{}}
S.subscribe(ownership);S.peek().then(ownership).catch(()=>{});
$('geo-join').onclick=join;$('geo-leave').onclick=leave;
$('geo-chat-form').onsubmit=e=>{e.preventDefault();const text=$('geo-message').value.trim();if(text&&text.length<=500)poll(text);};
window.addEventListener('pagehide',()=>{leave();view?.remove();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&wanted)leave();});
let accountId=S.user?.id;S.subscribe(()=>{const next=S.user?.id;if(accountId!==undefined&&next!==accountId&&wanted)leave();accountId=next;});
try{if(!validId(id))throw Error('Open the permanent link or QR code shared by the geofence owner.');const {data,error}=await S.client().rpc('geofence_read',{p_id:id});if(error)throw Error('Could not load this geofence. Reload to try again.');if(!data)throw Error('This geofence is not active. The link will work here when its owner activates the geofence.');fence=data;document.title=fence.name+' · Austin.Chat';$('geo-title').textContent=fence.name;$('geo-description').textContent=fence.description;$('geo-public-status').textContent=fence.diameter+' meters across';$('geo-room').hidden=false;
 $('geo-qr').innerHTML=qr(id);$('geo-permalink').textContent=pageURL(id);$('geo-permalink').href=pageURL(id);$('geo-share').onclick=async()=>{try{await copyLink(id);$('geo-public-status').textContent='Link copied.';}catch{$('geo-public-status').textContent='Copy the permanent link shown below the map.';}};$('geo-download').onclick=()=>downloadQR(id);view=await createMap('geofence-map');view.draw(fence);$('geo-fit').onclick=()=>view.fit();
}catch(e){$('geo-public-status').textContent=e.message;}
