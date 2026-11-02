/* Email-only reminders. Private selections live in memory and Supabase, never
   in guest storage. Same-origin frames share one account-bound store. */
(() => {
  const S=window.AustinSession,model=import('/shared/reminder-model.mjs?v=20261102f');
  const style=document.createElement('link');style.rel='stylesheet';style.href='/shared/reminders.css?v=20261102f';document.head.append(style);
  function createStore(){
    let owner=null,state=null,pending=null,loaded=0,run=0,epoch=0,writing=0,queue=Promise.resolve(),error='';const listeners=new Set();
    const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('austin-email-reminders'):null;
    const current=()=>S.registered?S.user.id:null;
    const emit=()=>listeners.forEach(fn=>fn());
    function reset(){owner=current();state=null;pending=null;loaded=0;run++;epoch++;error='';emit();}
    function assert(id){if(current()!==id)throw new Error('Your account changed. Please try again.');}
    async function request(body,id){
      assert(id);let token;
      if(id){const session=await S.peek();assert(id);token=session?.access_token;}
      const response=await fetch('https://aqbyxpiwugcvoephsvpm.supabase.co/functions/v1/reminders',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
      const data=await response.json();assert(id);if(!response.ok)throw new Error(data.error||'Reminders could not update. Please try again.');return data;
    }
    async function load(force=false){
      await S.peek();if(owner!==current())reset();
      if(writing)return queue.catch(()=>{}).then(()=>load(force));
      if(pending)return pending;
      if(!force&&state&&Date.now()-loaded<30000)return state;
      const id=owner,stamp=run;
      const task=(async()=>{try{const data=await request({action:id?'status':'availability'},id);if(stamp!==run)return;state=data;loaded=Date.now();error='';emit();return state;}catch(e){if(stamp===run){error=e.message;emit();}throw e;}})();
      pending=task;try{return await task;}finally{if(pending===task)pending=null;}
    }
    function write(body){
      const id=current(),generation=epoch;if(!id)return Promise.reject(new Error('Sign in to select email reminders.'));
      writing++;run++;pending=null;
      const task=queue.catch(()=>{}).then(async()=>{assert(id);if(generation!==epoch)throw new Error('Your account changed. Please try again.');const data=await request(body,id);assert(id);if(generation!==epoch)throw new Error('Your account changed. Please try again.');run++;pending=null;state=data;loaded=Date.now();error='';emit();channel?.postMessage({owner:id});}).finally(()=>{writing--;});
      queue=task;return window.AustinVisit?.track(task)||task;
    }
    S.subscribe(()=>{if(owner!==current()){reset();load().catch(()=>{});}});
    channel?.addEventListener('message',event=>{if(event.data?.owner===current()){loaded=0;load(true).catch(()=>{});}});
    window.addEventListener('focus',()=>{load().catch(()=>{});});
    window.addEventListener('pagehide',()=>{channel?.close();listeners.clear();});
    return {load,get state(){return state;},get error(){return error;},get owner(){return owner;},
      subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
      select:event=>write({action:'subscribe',provider:event.provider,id:event.id,start:event.start}),
      cancel:id=>write({action:'cancel',id})};
  }
  let R;try{if(window.parent!==window&&window.parent.AustinVisit===window.AustinVisit)R=window.parent.AustinReminderStore;}catch{}
  R=R||createStore();window.AustinReminderStore=R;
  const nodes=new Set(),node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const account=()=> (window.AustinAccount||window.parent.AustinAccount)?.open('reminders');
  function refresh(){for(const item of nodes){if(!item.host.isConnected){nodes.delete(item);continue;}item.paint();}}
  async function mount(container,provider,data){
    const M=await model,events=M.occurrences(provider,data);
    if(!container.isConnected||!events.length)return;
    const host=node('div');host.className='email-reminder';container.append(host);
    const select=node('select');select.setAttribute('aria-label','Reminder showtime for '+events[0].title);
    const available=events.filter(e=>Date.parse(e.start)>Date.now());
    if(!available.length){host.remove();return;}
    for(const event of available){const o=node('option',M.dateLabel(event.start)+(event.format?' · '+event.format:''));o.value=event.key;select.append(o);}
    if(available.length>1){const label=node('label','Reminder showtime ');label.append(select);host.append(label);}
    const label=node('label'),check=node('input');check.type='checkbox';label.append(check,node('span','Email reminders'));host.append(label);
    const note=node('small');note.setAttribute('role','status');host.append(note);let busy=false,desired=false,localError='';
    const chosen=()=>available.find(e=>e.key===select.value)||available[0];
    function paint(){
      const event=chosen(),saved=R.state?.reminders?.find(r=>r.event_key===event.key),leads=M.leadHours(event.start);
      check.checked=busy?desired:!!saved;check.disabled=busy||(!saved&&(!R.state?.enabled||(!leads.length&&S.registered)));select.disabled=busy;
      check.setAttribute('aria-label','Email reminders for '+event.title+' at '+M.dateLabel(event.start));
      note.replaceChildren();
      if(localError||R.error)note.textContent=localError||R.error;
      else if(busy)note.textContent='Saving…';
      else if(!R.state)note.textContent='Checking reminders…';
      else if(!R.state.enabled)note.textContent='Email reminders are being set up.';
      else if(!S.registered){const b=node('button','Sign in for email reminders');b.type='button';b.onclick=account;note.append(b);}
      else if(saved){
        const jobs=saved.event_reminder_jobs||[];
        note.textContent=jobs.some(j=>['failed','skipped'].includes(j.state))?'A reminder could not be sent. Check Account → Reminders.':
          'Selected · '+(jobs.filter(j=>['pending','processing'].includes(j.state)).map(j=>j.lead_hours+' hours before').join(' and ')||'Reminders sent');
      }
      else if(!leads.length)note.textContent='Too late for a reminder: starts within two hours.';
      else note.textContent=(leads.length===2?'24 hours and 2 hours before.':'2 hours before only.')+' Sent to your account email.';
    }
    select.onchange=()=>{localError='';paint();};
    check.onchange=async()=>{
      const event=chosen(),saved=R.state?.reminders?.find(r=>r.event_key===event.key);
      if(!S.registered){check.checked=false;await account();return;}
      desired=check.checked;busy=true;localError='';paint();
      try{await(saved?R.cancel(saved.id):R.select(event));}catch(e){localError=e.message;}finally{busy=false;paint();}
    };
    host.addEventListener('click',e=>e.stopPropagation());nodes.add({host,paint});paint();R.load().catch(()=>{});
  }
  window.addEventListener('austin:planner-target',e=>{if(e.detail.provider==='explore')mount(e.detail.container,'explore',e.detail.data);});
  window.addEventListener('austin:reminder-target',e=>mount(e.detail.container,e.detail.provider,e.detail.data));
  function mountAccount(host){
    const intro=node('p','Choose Email reminders beside a timed Explore event or City Hall meeting. We email your signed-in address 24 hours and 2 hours before the start. When less than 24 hours remain, only the 2-hour reminder is available.');
    const status=node('p'),list=node('div'),stop=node('button','Cancel all reminders'),retry=node('button','Refresh reminders');
    status.setAttribute('role','status');stop.type=retry.type='button';host.append(intro,status,list,stop,retry);let busy=false,notice='';
    async function cancel(id){busy=true;notice='';paint();try{await R.cancel(id);notice='Reminders cancelled.';}catch(e){notice=e.message;}finally{busy=false;paint();}}
    function paint(){
      if(!S.registered){status.textContent='Sign in to manage your email reminders.';list.replaceChildren();stop.hidden=true;return;}
      status.textContent=notice||R.error||(!R.state?'Loading reminders…':!R.state.enabled?'Email reminders are being set up.':`Email reminders go to ${R.state.email}. Times are in Austin time.`);
      list.replaceChildren();const rows=R.state?.reminders||[];stop.hidden=!rows.length;stop.disabled=busy;
      if(R.state&&!rows.length)list.append(node('p','No upcoming email reminders selected.'));
      for(const row of rows){
        const card=node('article');card.className='reminder-account-item';card.append(node('strong',row.event.title));
        model.then(M=>{if(card.isConnected)time.textContent=M.dateLabel(row.starts_at);});const time=node('p');card.append(time);
        const states={pending:'scheduled',processing:'sending',sent:'sent',skipped:'not sent — event changed or delivery window passed',failed:'delivery failed',cancelled:'cancelled'};
        card.append(node('p',(row.event_reminder_jobs||[]).map(j=>`${j.lead_hours}-hour reminder: ${states[j.state]||j.state}`).join(' · ')));
        const remove=node('button','Cancel reminders');remove.type='button';remove.disabled=busy;remove.onclick=()=>cancel(row.id);card.append(remove);list.append(card);
      }
    }
    stop.onclick=()=>cancel(null);retry.onclick=()=>{notice='';R.load(true).catch(()=>{});};
    R.subscribe(paint);paint();return {open(){paint();return R.load(true).catch(()=>{});}};
  }
  const unsubscribe=R.subscribe(refresh);window.addEventListener('pagehide',unsubscribe);
  window.AustinReminders={mount,mountAccount};
})();
