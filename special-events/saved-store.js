/* Event-only private data. No browser persistence, public comments or plan writes. */
(() => {
  const S=window.AustinSession,C=window.PlanContext,listeners=new Set();
  let owner=null,rows=null,loading=null,epoch=0,loadRun=0,queue=Promise.resolve(),error='';
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('austin-event-saved-stops'):null;
  const identity=()=>S.registered?S.user.id:null;
  const emit=()=>listeners.forEach(fn=>fn());
  function reset(){owner=identity();rows=null;loading=null;error='';epoch++;loadRun++;emit();}
  function assert(id,run){C.assert();if(!id||identity()!==id||owner!==id||epoch!==run)throw Error('Your account changed. Please try again.');}
  async function ready(){
    await S.peek();await C.ready;C.assert();if(owner!==identity())reset();
    if(!owner)return;
    if(rows)return;
    if(loading)return loading;
    const id=owner,run=epoch,request=++loadRun;
    loading=(async()=>{
      try{
        const result=await S.client().rpc('special_event_stops_load',{p_event:C.id,p_owner:id});assert(id,run);
        if(request!==loadRun)return ready();
        if(result.error)throw Error('Could not load saved stops. Please retry.');
        rows=new Map(result.data.map(row=>[row.stop_id,row]));error='';emit();
      }catch(e){if(id===owner&&run===epoch&&request===loadRun){error=e.message;emit();}throw e;}
      finally{if(id===owner&&run===epoch&&request===loadRun)loading=null;}
    })();return loading;
  }
  function row(stop){return structuredClone(rows?.get(String(stop))||{stop_id:String(stop),note:'',favorite:false});}
  function set(stop,field,value,expected){
    const id=identity(),run=epoch;
    const task=queue.catch(()=>{}).then(async()=>{
      if(!id)throw Error('Sign In to save');assert(id,run);await ready();assert(id,run);
      const result=await S.client().rpc('special_event_stop_set',{p_event:C.id,p_owner:id,p_stop:String(stop),p_field:field,p_value:value,p_expected:expected});assert(id,run);
      if(result.error){const e=Error(result.error.code==='PT409'?'This saved stop changed on another device. Reload saved note before editing.':'Could not save. Please try again.');e.code=result.error.code;throw e;}
      rows.set(String(stop),result.data);error='';emit();channel?.postMessage({owner:id,event:C.id});return row(stop);
    });queue=task;return window.AustinVisit?.track(task)||task;
  }
  async function reload(){await queue.catch(()=>{});rows=null;loading=null;loadRun++;return ready();}
  S.subscribe(()=>{if(identity()!==owner){reset();ready().catch(()=>{});}});
  C.subscribe(()=>{rows=null;epoch++;emit();});
  channel?.addEventListener('message',e=>{if(e.data?.owner===owner&&e.data?.event===C.id)reload().catch(()=>{});});
  window.addEventListener('pagehide',()=>{rows=null;listeners.clear();channel?.close();});
  window.SpecialEventSavedStore={ready,reload,row,set,get owner(){return owner;},get loaded(){return !!rows;},get error(){return error;},subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
  ready().catch(()=>{});
})();
