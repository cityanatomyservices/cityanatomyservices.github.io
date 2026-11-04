/* Account-scoped, memory-only reads. Account switches cancel pending requests. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports={create:factory};else root.ClassifiedsClient=factory({session:root.AustinSession,track:task=>root.AustinVisit.track(task)});})(globalThis,({session,track=task=>task})=>{
  const listeners=new Set(),pending=new Set();
  const identity=()=>session.registered?session.user?.id:null;
  let owner=identity(),epoch=0,writing=false;
  const changed=()=>Object.assign(new Error('Account changed. Please try again.'),{changed:true});
  function notify(event){listeners.forEach(fn=>fn(event));}
  function sync(){const next=identity();if(next!==owner){owner=next;epoch++;for(const request of pending)request.abort();notify({type:'identity'});}}
  const unsubscribe=session.subscribe(sync);
  async function ready(){await session.peek();sync();return !!identity();}
  async function call(name,args){
    sync();if(!identity())throw new Error('Create an account or sign in to use free classifieds.');
    const version=epoch,id=identity(),controller=new AbortController();pending.add(controller);
    const timer=setTimeout(()=>controller.abort(),15000);
    try{
      const {data,error}=await session.client().rpc(name,args).abortSignal(controller.signal);
      if(version!==epoch||id!==identity())throw changed();
      if(error)throw new Error(error.message||'Classifieds are unavailable. Please try again.');
      return data;
    }catch(error){if(version!==epoch||id!==identity())throw changed();if(controller.signal.aborted)throw new Error('The request timed out. Refresh classifieds and try again.');throw error;}
    finally{clearTimeout(timer);pending.delete(controller);}
  }
  function write(name,args){
    if(writing)return Promise.reject(new Error('Please wait for your current change to finish.'));
    const id=identity();writing=true;
    return track((async()=>{try{const data=await call(name,{p_owner_id:id,...args});notify({type:'saved',message:name==='classifieds_delete'?'Your ad was deleted.':'Your ad was saved.'});return data;}finally{writing=false;}})());
  }
  async function browse(category, current = () => true) {
    // Read the whole chosen category before sorting/filtering: an old ad on
    // page two must still appear. Uses the existing member-only paginated API.
    const version = epoch, id = identity();
    let offset = 0, rows = [], result;
    do {
      if (!current() || version !== epoch || id !== identity()) throw changed();
      result = await call('classifieds_read', { p_category: category, p_offset: offset });
      if (!current() || version !== epoch || id !== identity()) throw changed();
      rows.push(...result.ads); offset += 20;
    } while (result.more && offset <= 10000);
    return { ...result, ads: [...new Map(rows.map(ad => [ad.id, ad])).values()], truncated: result.total > rows.length };
  }
  return {
    ready,get registered(){return !!identity();},
    read:(category=null,offset=0)=>call('classifieds_read',{p_category:category,p_offset:offset}),
    browse,
    save:(category,title,body,revision=0,id=null)=>write('classifieds_save',{p_category:category,p_title:title,p_body:body,p_expected_revision:revision,p_expected_id:id}),
    remove:(revision,id)=>write('classifieds_delete',{p_expected_revision:revision,p_expected_id:id}),
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    destroy(){unsubscribe();epoch++;pending.forEach(request=>request.abort());listeners.clear();}
  };
});
