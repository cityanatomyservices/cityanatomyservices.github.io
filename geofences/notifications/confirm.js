/* Keep capability tokens out of requests/history until the explicit confirmation. */
(()=>{
 const button=document.getElementById('geo-email-confirm'),status=document.getElementById('geo-email-status');let generation=0;
 function initialize(){
 const [action,token]=location.hash.slice(1).split('/'),run=++generation;history.replaceState(null,'',location.pathname);button.hidden=false;button.disabled=true;button.onclick=null;
 if(!['verify','stop'].includes(action)||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(token)){status.textContent='This link is incomplete. Open the link from your email or manage notifications in your account.';return;}
 status.textContent=action==='verify'?'Confirm this email address to receive geofence arrival and departure alerts?':'Turn off arrival and departure emails for this geofence?';button.textContent=action==='verify'?'Confirm email alerts':'Turn off email alerts';button.disabled=false;
 button.onclick=async()=>{button.disabled=true;status.textContent='Updating email preferences…';try{
  const response=await fetch('https://aqbyxpiwugcvoephsvpm.supabase.co/functions/v1/geofence-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token}),signal:AbortSignal.timeout(20000),referrerPolicy:'no-referrer'});const data=await response.json();if(run!==generation)return;if(!response.ok)throw Error(data.error||'Please try again.');
  status.textContent=action==='verify'?'Email confirmed. Geofence arrival and departure alerts are now on.':'Email alerts are off for this geofence.';button.hidden=true;
 }catch(error){if(run===generation){status.textContent=error.message||'Could not update preferences. Please try again.';button.disabled=false;}}};
 }
 window.addEventListener('hashchange',initialize);initialize();
})();
