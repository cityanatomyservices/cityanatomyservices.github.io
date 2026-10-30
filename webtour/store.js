// Tour completion belongs to the signed-in account. Guests use visit memory.
// Lighting a Moontower and physically visiting it remain separate records.
export function createStore(key) {
  const M=window.AustinMember,V=window.AustinVisit,S=window.AustinSession;
  const tour=key.includes('1885')?'1885':key.includes('visits')?'moontower-visits':'moontower';
  const listeners=[],pending=new Map();let owner=S.registered?S.user.id:null,ids=V.get('tour:'+key)||[],saving=false;
  // Previous unscoped guest data cannot safely be assigned to an account.
  try{localStorage.removeItem(key);}catch(_){}
  const notify=()=>listeners.forEach(fn=>fn());
  function remember(){if(!owner)V.set('tour:'+key,ids);notify();}
  function sync(){
    const next=S.registered?S.user.id:null;
    if(next!==owner){const guest=owner===null?ids:[];owner=next;pending.clear();ids=[];V.remove('tour:'+key);if(next)guest.forEach(id=>pending.set(id,true));}
    if(owner&&M.state){ids=M.state.progress.filter(p=>p.tour===tour).map(p=>p.stop_id);for(const [id,on] of pending){ids=ids.filter(x=>x!==id);if(on)ids.push(id);}}
    remember();flush();
  }
  async function flush(){
    if(saving||!owner||!pending.size)return;saving=true;const account=owner;
    let failed=false;
    try{
      for(const [id,on] of [...pending]){
        if(owner!==account)break;
        await M.progress(tour,id,on);
        if(owner===account&&pending.get(id)===on)pending.delete(id);
      }
    }catch(_){failed=true;window.dispatchEvent(new CustomEvent('austin:tour-save-error',{detail:'Tour progress has not saved online. Keep this page open; saving retries when the connection returns.'}));}
    finally{saving=false;if(!failed&&owner&&pending.size)queueMicrotask(flush);}
  }
  const off=M.subscribe(section=>{if(['loaded','account','progress'].includes(section))sync();});
  M.ready().then(sync).catch(()=>{});window.addEventListener('online',flush);window.addEventListener('pagehide',off);
  return {
    get doneIds(){return ids;},isDone:id=>ids.includes(id),
    markDone(id){if(ids.includes(id))return;ids=[...ids,id];if(owner)pending.set(id,true);remember();flush();},
    reset(){if(owner)ids.forEach(id=>pending.set(id,false));ids=[];remember();flush();},
    onChange(fn){listeners.push(fn);}
  };
}
