/* Public text discussions only. Private notes stay in PlanStore. Drafts and
   loaded threads stay in this frame's memory; no additional realtime channel. */
(() => {
  const S=window.AustinSession,M=window.AustinMember,threads=new WeakMap();
  let owner=S.registered?S.user?.id:null,epoch=0;
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
  const button=text=>{const el=node('button',text);el.type='button';return el;};
  const account=()=> (window.AustinAccount||window.parent.AustinAccount)?.open('profile');
  const check=result=>{if(result.error)throw result.error;return result.data;};
  function each(fn){document.querySelectorAll('.place-comments').forEach(el=>{const thread=threads.get(el);if(thread)fn(thread);});}
  function mount(container,source,existing) {
    if(!/^(place|explore):.+/.test(source?.key))return null;
    if(existing?.dataset.sourceKey===source.key&&threads.has(existing)){container.append(existing);return threads.get(existing);}
    const root=node('details',null,'place-comments'),summary=node('summary','Public comments');root.dataset.sourceKey=source.key;
    const privacy=node('p','Shared with everyone under your profile nickname. Keep personal plans and contact details in private notes.','comment-privacy');
    const refresh=button('Refresh comments'),list=node('ul',null,'comment-list'),more=button('Older comments');more.hidden=true;
    const status=node('p',null,'comment-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const form=node('form'),label=node('label','Add a public comment'),input=node('textarea');input.maxLength=2000;input.required=true;input.setAttribute('aria-label','Public comment for '+source.title);label.append(input);
    const identity=node('p',null,'comment-privacy'),post=button('Post comment'),cancel=button('Cancel edit'),signIn=button('Sign in to comment'),actions=node('div',null,'comment-actions');
    post.type='submit';cancel.hidden=true;actions.append(post,cancel);form.append(identity,label,actions);
    root.append(summary,privacy,refresh,list,more,form,signIn,status);container.append(root);
    let rows=[],loaded=false,busy=false,request=0,editing=null,threadEpoch=epoch;
    function auth(){form.hidden=!S.registered;signIn.hidden=S.registered;const p=M.state?.profile;identity.textContent=`Posting as ${p?.emoji||'🙂'} ${p?.handle||'your Austin.chat nickname'}`;}
    function stopEdit(){editing=null;input.value='';cancel.hidden=true;post.textContent='Post comment';}
    function render(){
      list.replaceChildren();
      if(!rows.length)list.append(node('li','No comments yet. Share a helpful tip about this place or event.'));
      for(const row of rows){
        const li=node('li'),who=node('span',`${row.emoji} ${row.handle}`,'comment-author'),time=node('time');
        time.dateTime=row.created_at;time.textContent=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(row.created_at))+' CT'+(row.updated_at!==row.created_at?' · edited':'');
        li.append(who,time,node('p',row.body,'comment-body'));
        if(row.mine&&S.registered){
          const tools=node('div',null,'comment-actions'),edit=button('Edit'),remove=button('Delete');
          edit.onclick=()=>{editing=row.id;input.value=row.body;cancel.hidden=false;post.textContent='Save comment';input.focus();};
          remove.onclick=()=>{if(confirm('Delete your public comment?'))window.AustinVisit.track(write(()=>S.client().from('place_comments').delete().eq('id',row.id).select('id'),'Comment deleted.'));};
          tools.append(edit,remove);li.append(tools);
        }
        list.append(li);
      }
    }
    async function load(append=false){
      const run=++request,version=epoch;status.textContent='Loading comments…';refresh.disabled=true;more.disabled=true;
      try{
        await S.peek();
        const data=check(await S.client().rpc('place_comments_list',{p_source_key:source.key,p_offset:append?rows.length:0}));
        if(run!==request||version!==epoch)return;
        rows=append?[...rows,...data.filter(r=>!rows.some(old=>old.id===r.id))]:data;loaded=true;more.hidden=data.length<30||rows.length>=10000;render();auth();status.textContent='';
      }catch(error){if(run===request&&version===epoch)status.textContent='Could not load comments. '+(error.message||'Try Refresh comments.');}
      finally{if(run===request){refresh.disabled=false;more.disabled=false;}}
    }
    async function write(operation,message){
      if(busy)return;const version=epoch,author=S.user?.id;
      if(!S.registered){account();return;}
      busy=true;post.disabled=true;status.textContent='Saving comment…';
      try{
        await M.profile();
        if(version!==epoch||author!==S.user?.id)throw new Error('Account changed. Please try again.');
        const result=check(await operation());
        if(version!==epoch)return;
        if(!result?.length)throw new Error('This comment is no longer available to edit. Refresh comments.');
        stopEdit();await load();
        if(version===epoch){status.textContent=message;each(t=>{if(t!==api&&t.key===source.key)t.invalidate();});}
      }catch(error){if(version===epoch)status.textContent=error.message||'Could not save. Please try again.';}
      finally{busy=false;post.disabled=false;}
    }
    const api={key:source.key,
      invalidate(){loaded=false;if(root.open)load();},
      reset(){threadEpoch=epoch;request++;rows=[];list.replaceChildren();loaded=false;stopEdit();status.textContent='';auth();if(root.open)load();},
      reconnect(){if(threadEpoch!==epoch)this.reset();else auth();},
      auth,
      draft(text){if(!S.registered){account();return;}root.open=true;input.value=text||'';input.focus();status.textContent='Review this public comment, then choose Post comment to share it.';}
    };
    threads.set(root,api);auth();
    root.addEventListener('toggle',()=>{if(root.open&&!loaded)load();});
    refresh.onclick=()=>load();more.onclick=()=>load(true);signIn.onclick=account;cancel.onclick=stopEdit;
    form.onsubmit=event=>{event.preventDefault();const body=input.value.trim(),id=editing;if(!body||!form.reportValidity())return;
      window.AustinVisit.track(write(()=>id?S.client().from('place_comments').update({body}).eq('id',id).select('id'):S.client().from('place_comments').insert({source_key:source.key,body}).select('id'),id?'Comment updated.':'Comment posted.'));};
    return api;
  }
  const unsub=S.subscribe(()=>{const next=S.registered?S.user?.id:null;if(next!==owner){owner=next;epoch++;each(t=>t.reset());}});
  const unmember=M.subscribe(()=>each(t=>t.auth()));
  // MapLibre keeps closed popup DOM detached. Recheck identity when a popup
  // re-enters the document, including sign-out while that popup was closed.
  const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes){
    if(node.nodeType!==1)continue;
    if(node.matches('.place-comments'))threads.get(node)?.reconnect();
    node.querySelectorAll('.place-comments').forEach(el=>threads.get(el)?.reconnect());
  }});
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener('pagehide',()=>{unsub();unmember();observer.disconnect();epoch++;});
  function followPopup(popup){
    const resize=new ResizeObserver(()=>{if(popup.isOpen())popup.setLngLat(popup.getLngLat());});
    const watch=()=>resize.observe(popup.getElement());
    popup.on('open',watch);popup.on('close',()=>resize.disconnect());
    if(popup.isOpen())watch();
    return popup;
  }
  window.AustinComments={mount,followPopup};
})();
