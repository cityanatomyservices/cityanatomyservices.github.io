const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const page=id=>'https://austin.chat/geofences/?id='+id;
const notification=(action,token)=>'https://austin.chat/geofences/notifications/#'+action+'/'+token;
export async function message(job,context,qrPNG){
 const title=context.name,url=page(context.id),manage='https://austin.chat/geofences/manage/';
 if(job.kind==='welcome'){
  const intro='Your chat geofence is ready. Share this email, link or QR code with the people you want to join.';
  const joining='Joining is free and does not require signing in. Visitors open the page, choose Chat, allow location access, and join while inside the circle.';
  const content=await qrPNG(url);
  return {subject:'Your geofence is ready: '+title,text:`${intro}\n\n${title}\n${context.description||''}\n${url}\n\n${joining}\n\nManage your geofences: ${manage}`,
   html:`<h1>${escape(title)}</h1><p>${escape(intro)}</p><p>${escape(context.description)}</p><p><a href="${url}">Open the geofence</a></p><p><a href="${url}">${url}</a></p><p><img src="cid:geofence-qr" width="280" height="280" alt="QR code for this geofence"></p><p>${joining}</p><p><a href="${manage}">Manage your geofences</a> (owner sign-in required).</p>`,
   attachments:[{filename:'geofence-qr.png',content,content_type:'image/png',content_id:'geofence-qr'}]};
 }
 const stop=notification('stop',context.stopToken);
 if(job.kind==='verify'){
  const verify=notification('verify',context.verifyToken);
  return {subject:'Confirm geofence alerts: '+title,text:`Confirm email alerts for ${title}:\n${verify}\n\nThis link expires in 24 hours. Alerts report visitors joining or leaving the geofence chat while sharing location. If you did not request this, ignore this email or turn alerts off:\n${stop}`,
   html:`<h1>Confirm geofence alerts</h1><p>Receive arrival and departure emails for ${escape(title)}.</p><p><a href="${verify}">Confirm this email address</a></p><p>This link expires in 24 hours. Alerts report visitors joining or leaving the geofence chat while sharing location.</p><p>If you did not request this, ignore this email or <a href="${stop}">turn alerts off</a>.</p>`};
 }
 const date=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',dateStyle:'medium',timeStyle:'short'});
 const lines=job.events.map(e=>`${e.name} ${e.kind==='enter'?'entered the geofence chat':'left the geofence chat or disconnected'} — ${date.format(new Date(e.at))} (Austin time)`);
 const note='Alerts describe visitors using this page with location allowed. A departure can also mean they closed the page, stopped sharing location, or lost their connection.';
 return {subject:'Geofence activity: '+title,text:`${title}\n\n${lines.join('\n')}\n\n${note}\n\nOpen the page: ${url}\nManage email alerts: ${manage}\nTurn these alerts off: ${stop}`,
  html:`<h1>${escape(title)}</h1><ul>${lines.map(line=>'<li>'+escape(line)+'</li>').join('')}</ul><p>${note}</p><p><a href="${url}">Open the geofence</a> · <a href="${manage}">Manage alerts</a></p><p><a href="${stop}">Turn these alerts off</a></p>`};
}
