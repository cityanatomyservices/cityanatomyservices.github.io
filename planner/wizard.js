/* Inline guidance for the main planner. Scheduling and persistence stay in their existing modules. */
(() => {
  const S=window.PlanStore,M=window.PlanModel,$=id=>document.getElementById(id);
  if(!$('plan-start'))return;
  const steps=['date','places','times','travel','review'];
  let stage='start',current=null,all=false,lastDay,bookId,returnStage='start';
  const label=date=>new Intl.DateTimeFormat('en-US',{timeZone:M.zone,weekday:'short',month:'short',day:'numeric',year:'numeric'}).format(new Date(M.instant(date+'T12:00')));
  const itemNode=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
  function focus(){
    const target=stage==='start'?($('plan-upcoming-label').hidden?$('add-day'):$('plan-upcoming')):$('plan-step-'+stage).querySelector('h2');
    target?.focus({preventScroll:true});$('plan-panel').scrollTop=0;
  }
  function go(next,moveFocus=true){
    if(!steps.includes(next)&&next!=='start')return;
    if(['times','travel','review'].includes(next)&&!S.plan.items.length)next='places';
    stage=next;update();if(moveFocus)focus();
  }
  function create(){returnStage=stage;$('new-day-date').value=M.planDay();go('date');$('new-day-date').focus({preventScroll:true});}
  function openDay(){current=null;all=false;go(S.plan.items.length?'times':'places');}
  function update(){
    const plan=S.plan;
    if(bookId&&bookId!==S.book.id){stage='start';current=null;all=false;}
    bookId=S.book.id;
    if(lastDay!==plan.date){current=null;lastDay=plan.date;}
    if(['times','travel','review'].includes(stage)&&!plan.items.length)stage='places';
    const upcoming=S.days.filter(d=>d.date>=M.planDay()&&d.count>0);
    const pick=$('plan-upcoming');pick.replaceChildren(itemNode('option','Choose a day plan…'));pick.firstChild.value='';
    for(const day of upcoming){const option=itemNode('option',`${label(day.date)} · ${day.count} stop${day.count===1?'':'s'}`);option.value=day.date;pick.append(option);}
    $('plan-upcoming-label').hidden=!upcoming.length;
    $('plan-start').hidden=stage!=='start';$('plan-workspace').hidden=stage==='start';
    $('plan-day-picker').hidden=stage==='date';
    for(const step of steps)$('plan-step-'+step).hidden=stage!==step;
    for(const button of document.querySelectorAll('[data-plan-step]')){
      const step=button.dataset.planStep;button.disabled=['times','travel','review'].includes(step)&&!plan.items.length;
      if(step===stage)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
    }
    for(const button of document.querySelectorAll('[data-plan-go="times"]'))button.disabled=!plan.items.length;
    $('plan-chosen-stops').replaceChildren(...plan.items.map(item=>itemNode('li',item.source.title)));
    const cards=[...$('plan-items').querySelectorAll('.plan-item')];
    if(!cards.some(card=>card.dataset.itemId===current))current=(plan.items.find(i=>!i.schedule.start)||plan.items[0])?.id;
    const at=cards.findIndex(card=>card.dataset.itemId===current);
    cards.forEach(card=>card.hidden=!all&&card.dataset.itemId!==current);
    $('plan-items').querySelectorAll('.travel-leg').forEach(leg=>leg.hidden=!all);
    $('plan-stop-count').textContent=all?`${cards.length} stops`:`Stop ${at+1} of ${cards.length}`;
    $('plan-show-all').textContent=all?'Guide me one stop at a time':'See all stops';
    $('plan-stop-paging').hidden=all||cards.length<2;
    $('plan-previous-stop').disabled=at<=0;$('plan-next-stop').disabled=at<0||at>=cards.length-1;
    const result=M.check(plan,window.PlanRouting),untimed=plan.items.filter(i=>!i.schedule.start).length;
    const conflicts=plan.items.filter(i=>result.issues.get(i.id).some(x=>x.severity==='error'&&x.code!=='unscheduled')).length;
    const warnings=[];
    if(untimed)warnings.push(`${untimed} stop${untimed===1?' needs':'s need'} an arrival time. Only scheduled stops are included in driving estimates.`);
    if(conflicts)warnings.push(`${conflicts} stop${conflicts===1?' has a time conflict':'s have time conflicts'}. Check the warnings beside each stop before going.`);
    $('plan-time-warning').textContent=warnings.join(' ');$('plan-time-warning').hidden=!warnings.length;
    $('plan-review-warning').textContent=warnings.join(' ')||'Review opening hours and visit lengths before heading out.';
    $('plan-review-stops').replaceChildren(...[...plan.items].sort((a,b)=>(Date.parse(a.schedule.start)||Infinity)-(Date.parse(b.schedule.start)||Infinity)).map(item=>{
      const time=item.schedule.start?new Intl.DateTimeFormat('en-US',{timeZone:M.zone,hour:'numeric',minute:'2-digit'}).format(new Date(item.schedule.start))+(M.day(item.schedule.start)!==plan.date?' next morning':''):'Time needed';
      return itemNode('li',`${time} · ${item.source.title} · ${item.schedule.duration} min`);
    }));
  }
  function move(delta){
    const cards=[...$('plan-items').querySelectorAll('.plan-item')],at=cards.findIndex(card=>card.dataset.itemId===current),next=cards[at+delta];
    if(next){current=next.dataset.itemId;update();next.querySelector('[data-field="showtime"],[data-field="start"]')?.focus();}
  }
  $('plan-upcoming').onchange=async event=>{const date=event.target.value;if(!date)return;try{await S.chooseDay(date);openDay();}catch(error){$('plan-message').textContent=error.message;go('date');}};
  $('plan-start-over').onclick=()=>go('start');$('plan-change-date').onclick=create;
  for(const button of document.querySelectorAll('[data-plan-step],[data-plan-go]'))button.onclick=()=>{
    const step=button.dataset.planStep||button.dataset.planGo;
    if(step==='date'){$('new-day-date').value=S.plan.date;returnStage=stage;}
    go(step);
  };
  $('plan-show-all').onclick=()=>{all=!all;update();};
  for(const id of ['view-timeline','view-order'])$(id).addEventListener('click',()=>{all=true;update();});
  $('plan-previous-stop').onclick=()=>move(-1);$('plan-next-stop').onclick=()=>move(1);
  $('plan-finish-stops').onclick=()=>{go('travel');if(!$('plan-route').disabled)$('plan-route').click();};
  for(const button of document.querySelectorAll('[data-plan-restore]'))button.onclick=()=>{
    $('export-plan').click();$('export-dialog').querySelector('.export-backup').open=true;$('import-plan').focus();
  };
  // Restore focus to visible guidance when Export was opened from an early step.
  $('export-dialog').addEventListener('close',()=>{if(stage!=='review')focus();});
  window.PlanWizard={update,create,openDay,focus,showStop:id=>{current=id;all=false;go('times');},start:()=>go('start',false),cancel:()=>go(returnStage),get stage(){return stage;}};
})();
