/* Account UI belongs to the site frame, not to chat or the itinerary. */
(() => {
  const session=window.AustinSession,button=document.querySelector('.sign-in-button');
  if(!session||!button)return;
  const dialog=document.createElement('dialog');dialog.className='account-dialog';dialog.id='account-dialog';
  dialog.setAttribute('aria-labelledby','account-title');
  dialog.innerHTML=`<div class="account-heading"><h2 id="account-title">Sign in</h2><button type="button" class="account-close" aria-label="Close account">×</button></div>
    <div id="account-guest"><p>Keep your Day Planner across visits and devices. You can also keep exploring as a guest.</p>
      <button type="button" id="account-google" class="account-google" disabled>Continue with Google</button>
      <p class="account-divider">or use your email</p>
      <form id="account-email-form"><label>Email address<input id="account-email" type="email" autocomplete="email" maxlength="254" required disabled></label><button type="submit" id="account-send" disabled>Email me a code</button></form>
      <form id="account-code-form" hidden><label>Code from your email<input id="account-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" minlength="6" maxlength="10" required></label><button type="submit" id="account-verify">Verify and sign in</button></form>
      <p class="account-help">No password needed. Signing in creates an account if you’re new. Your email stays private; chat uses a nickname.</p>
    </div>
    <div id="account-member" hidden><p>Signed in as <strong id="account-address"></strong></p><p>Your plans save privately to your account. Signing out clears them from this browser view.</p><button type="button" id="account-signout">Sign out on this device</button><button type="button" id="account-discard" hidden>Sign out without saving these changes</button></div>
    <p id="account-status" role="status" aria-live="polite"></p><button type="button" id="account-cancel-google" hidden>Cancel Google sign-in</button>`;
  document.body.append(dialog);
  const $=id=>dialog.querySelector('#'+id);
  let capabilities={google:false,email:false},busy=false,sentTo='',pendingOAuth,request=0;
  const message=text=>{$('account-status').textContent=text;};
  function controls() {
    $('account-google').disabled=busy||!capabilities.google;
    $('account-email').disabled=busy||!capabilities.email;
    $('account-send').disabled=busy||!capabilities.email;
    $('account-verify').disabled=busy;
    $('account-signout').disabled=busy;
    $('account-discard').disabled=busy;
  }
  function render() {
    const registered=session.registered;
    button.textContent=registered?'Account':'Sign In';button.disabled=false;
    $('account-title').textContent=registered?'Your account':'Sign in';
    $('account-guest').hidden=registered;$('account-member').hidden=!registered;
    $('account-address').textContent=registered?(session.user.email||'your account'):'';
    if(registered){$('account-email-form').reset();$('account-code-form').reset();$('account-code-form').hidden=true;sentTo='';}
    controls();
  }
  function errorMessage(error) {
    if(['otp_expired','otp_disabled','bad_code_verifier'].includes(error?.code))return 'That code is invalid or expired. Request a new code and try again.';
    if(error?.status===429||/rate_limit/.test(error?.code||''))return 'Please wait a minute before trying again.';
    if(['email_address_not_authorized','email_provider_disabled'].includes(error?.code))return 'Email sign-in is not available yet. Please try Google or continue as a guest.';
    return 'Sign-in could not be completed. Please try again. Your current plan is still open.';
  }
  async function options() {
    const run=++request;
    capabilities={google:false,email:false};controls();message('Loading sign-in options…');
    try {
      const [settings,response]=await Promise.all([session.settings(),fetch('/auth/config.json',{cache:'no-store',signal:AbortSignal.timeout(10000)})]);
      if(!response.ok)throw new Error('Sign-in options unavailable');
      const config=await response.json();if(run!==request||!dialog.open)return;
      capabilities={google:settings.external?.google===true,email:settings.external?.email===true&&config.emailEnabled===true};
      message(capabilities.google||capabilities.email ? (!capabilities.email?'Email sign-in is being set up.':'') : 'Sign-in is being set up. You can keep planning as a guest.');
    }catch(_){if(run===request)message('Sign-in options could not load. Please close this box and try again.');}
    controls();
  }
  button.addEventListener('click',async()=>{
    render();dialog.showModal();button.setAttribute('aria-expanded','true');message('');
    try{await session.peek();render();if(!session.registered)await options();}catch(_){message('Could not connect to sign-in. Please try again.');}
  });
  dialog.querySelector('.account-close').onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{
    request++;cancelGoogle();$('account-email-form').reset();$('account-code-form').reset();$('account-code-form').hidden=true;sentTo='';
    $('account-discard').hidden=true;button.setAttribute('aria-expanded','false');button.focus({preventScroll:true});
  });
  $('account-email').addEventListener('input',()=>{if($('account-email').value.trim()!==sentTo){$('account-code-form').hidden=true;$('account-code-form').reset();sentTo='';}});
  $('account-email-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!capabilities.email)return;
    const email=$('account-email').value.trim(),run=request;
    busy=true;controls();message('Sending your code…');
    try {
      await session.ready();
      const {error}=await session.client().auth.signInWithOtp({email,options:{shouldCreateUser:true}});
      if(error)throw error;if(run!==request||!dialog.open)return;
      sentTo=email;$('account-code-form').hidden=false;$('account-code').focus();
      message('Enter the code from your email. Check spam if it doesn’t arrive.');
    }catch(error){if(run===request)message(errorMessage(error));}
    finally{busy=false;controls();}
  });
  $('account-code-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!sentTo)return;
    busy=true;controls();message('Checking your code…');
    try {
      await window.AustinVisit?.settled();
      const {error}=await session.client().auth.verifyOtp({email:sentTo,token:$('account-code').value.trim(),type:'email'});
      if(error)throw error;
      await finish();
    }catch(error){message(errorMessage(error));}
    finally{busy=false;controls();}
  });
  async function finish() {
    await session.peek();render();
    const store=activeStore();
    if(store){await store.ready();await store.sync();}
    message(store?.unsaved?'You’re signed in. Your current changes are kept in this browser while online saving retries.':'You’re signed in. Your plans can now be saved across visits.');
  }
  function activeStore(){try{return window.PlanStore||document.getElementById('app-window')?.contentWindow.PlanStore;}catch(_){return null;}}
  async function signOut(discard=false) {
    if(busy)return;busy=true;controls();message('Signing out…');
    try {
      const store=activeStore();
      if(store&&!discard){await window.AustinVisit?.settled();await store.sync();if(store.unsaved){$('account-discard').hidden=false;message('Some changes could not be saved online. Try again, or sign out without saving those changes.');return;}}
      await session.signOut();$('account-discard').hidden=true;render();message('Signed out on this device. Your saved account plans are kept.');
      if(dialog.open)await options();
    }catch(_){message('Could not sign out. Please try again.');}
    finally{busy=false;controls();}
  }
  $('account-signout').onclick=()=>signOut();$('account-discard').onclick=()=>signOut(true);

  function cancelGoogle() {
    const pending=pendingOAuth;if(!pending)return;
    pendingOAuth=null;clearTimeout(pending.timeout);pending.channel?.close();
    try{pending.popup.close();}catch(_){}
    session.clearVerifier();$('account-cancel-google').hidden=true;busy=false;controls();
  }
  $('account-cancel-google').onclick=()=>{cancelGoogle();message('Google sign-in canceled. Your guest plan is still open.');};
  async function callback(data,reply) {
    const pending=pendingOAuth;
    if(!pending||pending.received||data?.type!=='austin-oauth-callback'||data.attempt!==pending.attempt)return;
    if(typeof data.code!=='string'||data.code.length>2048||typeof data.error!=='string')return;
    pending.received=true;
    try {
      if(data.error)throw new Error('Provider declined');
      if(!data.code)throw new Error('Code missing');
      await window.AustinVisit?.settled();
      if(pendingOAuth!==pending)return;
      const {error}=await session.client().auth.exchangeCodeForSession(data.code);
      if(error)throw error;
      await finish();reply({type:'austin-oauth-result',attempt:pending.attempt,ok:true});
    }catch(_){message('Google sign-in was canceled or could not finish. Please try again.');reply({type:'austin-oauth-result',attempt:pending.attempt,ok:false});}
    finally{cancelGoogle();}
  }
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==pendingOAuth?.popup)return;
    callback(event.data,data=>event.source?.postMessage(data,location.origin));
  });
  $('account-google').onclick=async()=>{
    if(busy||!capabilities.google)return;
    const attempt=crypto.randomUUID();
    const popup=window.open('about:blank','austin-sign-in-'+attempt,'popup,width=520,height=690');
    if(!popup){message('Allow pop-ups for Austin.chat, then try Google again. Your plan stays open here.');return;}
    const pending={attempt,popup,received:false};pendingOAuth=pending;busy=true;controls();
    $('account-cancel-google').hidden=false;message('Continue in the Google sign-in window. Keep this page open.');
    if(typeof BroadcastChannel!=='undefined'){
      pending.channel=new BroadcastChannel('austin-sign-in:'+attempt);
      pending.channel.onmessage=event=>callback(event.data,data=>pending.channel?.postMessage(data));
    }
    pending.timeout=setTimeout(()=>{if(pendingOAuth===pending){cancelGoogle();message('Google sign-in timed out. Please try again.');}},10*60*1000);
    try {
      await session.ready();
      const redirectTo=location.origin+'/auth/callback/?attempt='+encodeURIComponent(attempt);
      const {data,error}=await session.client().auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:true,queryParams:{prompt:'select_account'}}});
      if(error)throw error;if(pendingOAuth!==pending)return;
      const target=new URL(data.url);
      if(target.origin!=='https://aqbyxpiwugcvoephsvpm.supabase.co'||target.pathname!=='/auth/v1/authorize')throw new Error('Invalid provider URL');
      popup.location.replace(target.href);
    }catch(error){cancelGoogle();message(errorMessage(error));}
  };
  session.subscribe(()=>render());
  session.peek().then(render).catch(()=>{button.disabled=false;});
})();
