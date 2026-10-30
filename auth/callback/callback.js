/* This page only relays a one-time PKCE code to the page that started sign-in.
   No SDK, tokens, analytics, external resources, or browser storage here. */
(() => {
  const query=new URLSearchParams(location.search),attempt=query.get('attempt');
  const payload={type:'austin-oauth-callback',attempt,code:query.get('code')||'',error:query.get('error')||''};
  history.replaceState(null,'',location.pathname);
  const status=document.getElementById('callback-status');
  if(!/^[a-f0-9-]{36}$/.test(attempt||'')||(!payload.code&&!payload.error)) {status.textContent='This sign-in link is incomplete. Return to Austin.chat and try again.';return;}
  let channel,finished=false;
  function result(data) {
    if(data?.type!=='austin-oauth-result'||data.attempt!==attempt)return;
    finished=true;clearInterval(timer);clearTimeout(timeout);channel?.close();
    status.textContent=data.ok?'You’re signed in. You can return to your original Austin.chat window.':'Sign-in did not finish. Return to Austin.chat and try again.';
    if(data.ok)window.close();
  }
  if(typeof BroadcastChannel!=='undefined') {channel=new BroadcastChannel('austin-sign-in:'+attempt);channel.onmessage=event=>result(event.data);}
  window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===window.opener)result(event.data);});
  function send(){if(finished)return;channel?.postMessage(payload);try{window.opener?.postMessage(payload,location.origin);}catch(_){}}
  const timer=setInterval(send,500),timeout=setTimeout(()=>{
    clearInterval(timer);channel?.close();status.textContent='Your original sign-in window could not be reached. Return there and try again; keep it open during sign-in.';
  },15000);
  send();
})();
