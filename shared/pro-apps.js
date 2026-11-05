/* Pro frames retain their normal URLs; a worker delivers authorized private bytes. */
(() => {
  const S=window.AustinSession,M=window.AustinMembership,frames=new WeakMap();let worker;
  if(!S||!M)return;
  async function authorization(target){
    await S.peek();const id=S.registered?S.user.id:null;
    const {data}=id?await S.client().auth.getSession():{data:null};
    const token=S.registered&&S.user.id===id&&data?.session?.user?.id===id?data.session.access_token:null;
    if(!target)return;
    await new Promise((resolve,reject)=>{
      const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(new Error('App connection timed out. Please reload.'));},5000);
      channel.port1.onmessage=()=>{clearTimeout(timer);channel.port1.close();resolve();};
      target.postMessage({type:'austin-pro-auth',token},[channel.port2]);
    });
  }
  async function ready(){
    if(!('serviceWorker' in navigator))throw new Error('This browser cannot open Pro apps. Try a current version of Chrome, Edge, Safari or Firefox.');
    if(!worker)worker=(async()=>{
      const registration=await navigator.serviceWorker.register('/pro-worker.js?v=20261104e',{scope:'/',updateViaCache:'none'});
      const installing=registration.installing||registration.waiting;
      if(installing&&installing.state!=='activated')await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('The app connection timed out. Reload to retry.')),15000);
        installing.addEventListener('statechange',()=>{if(installing.state==='activated'){clearTimeout(timer);resolve();}else if(installing.state==='redundant'){clearTimeout(timer);reject(new Error('App connection could not start.'));}});
      });
      await navigator.serviceWorker.ready;
      if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
      return navigator.serviceWorker.controller;
    })().catch(error=>{worker=null;throw error;});
    return worker;
  }
  function mount(frame,src){
    if(frames.has(frame))return;
    const target=new URL(src,location.origin);
    if(target.origin!==location.origin)throw new Error('Expected a site app');
    frame.removeAttribute('src');frame.hidden=true;
    const gate=document.createElement('section');gate.className='pro-app-gate';
    gate.innerHTML='<div><h2>Pro App</h2><p role="status">Checking membership…</p><button type="button">Membership</button></div>';
    frame.after(gate);const message=gate.querySelector('p'),button=gate.querySelector('button');let generation=0,loadedOwner=null;
    frames.set(frame,true);
    button.onclick=()=>window.AustinAccount?.open('membership');
    function hide(){if(frame.getAttribute('src'))frame.src='about:blank';frame.hidden=true;gate.hidden=false;loadedOwner=null;}
    async function render(){
      const run=++generation,id=S.registered?S.user.id:null,state=M.state;
      if(!id){hide();message.textContent='Sign in, then choose Pro to open this app.';button.textContent='Sign in';button.disabled=false;return;}
      if(!state){hide();message.textContent='Checking membership…';button.disabled=true;return;}
      if(state.plan!=='pro'||!(Date.parse(state.paidThrough)>Date.now())){hide();message.textContent='This app is included with Pro for $8 per month.';button.textContent='View membership';button.disabled=false;return;}
      if(loadedOwner===id)return;
      message.textContent='Opening your Pro app…';button.disabled=true;
      try{
        const active=await ready();await authorization(active);
        if(run!==generation||!S.registered||S.user.id!==id)return;
        loadedOwner=id;gate.hidden=true;frame.hidden=false;frame.src=target.href;
      }catch(error){if(run===generation){hide();message.textContent=error.message;button.textContent='Try again';button.disabled=false;button.onclick=()=>{button.onclick=()=>window.AustinAccount?.open('membership');render();};}}
    }
    S.subscribe(()=>{render();if(S.registered)M.load().catch(()=>{});});M.subscribe(render);
    render();S.peek().then(()=>M.load()).catch(()=>{hide();message.textContent='Membership could not connect. Open Account and try again.';button.disabled=false;});
  }
  navigator.serviceWorker?.addEventListener('message',event=>{
    if(event.data?.type==='austin-pro-need-auth')authorization(event.source).catch(()=>{});
    if(event.data?.type==='austin-pro-access-changed')M.load().catch(()=>{});
  });
  S.subscribe(()=>{if(navigator.serviceWorker?.controller)authorization(navigator.serviceWorker.controller).catch(()=>{});});
  window.AustinProApps={mount};document.querySelectorAll('iframe[data-pro-src]').forEach(frame=>mount(frame,frame.dataset.proSrc));
  window.dispatchEvent(new Event('austin-pro-apps-ready'));
})();
