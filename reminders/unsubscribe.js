/* A GET/page preview never cancels anything; only the explicit button sends. */
(() => {
  const token=location.hash.slice(1),button=document.getElementById('reminder-cancel'),status=document.getElementById('reminder-cancel-status');
  history.replaceState(null,'',location.pathname);
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(token)){
    status.textContent='This cancellation link is incomplete. Open the link from your email or manage reminders in your account.';return;
  }
  button.disabled=false;
  button.onclick=async()=>{
    button.disabled=true;status.textContent='Cancelling…';
    try{
      const response=await fetch('https://aqbyxpiwugcvoephsvpm.supabase.co/functions/v1/reminders?unsubscribe='+token,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000),referrerPolicy:'no-referrer'});
      if(!response.ok||!(await response.json()).cancelled)throw new Error('Unavailable');
      status.textContent='Event reminders cancelled. You can close this page.';button.hidden=true;
    }catch{status.textContent='Reminders could not be cancelled. Please try again or manage them in your account.';button.disabled=false;}
  };
})();
