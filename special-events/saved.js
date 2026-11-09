/* The same private stop notebook in browsing and planned-marker popups. */
(() => {
  const S=window.AustinSession,T=window.SpecialEventSavedStore,C=window.PlanContext,views=new Set(),drafts=new Map();
  let owner=T.owner;
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
  function mount(container,source){
    const id=String(source.sourceId),root=node('section',undefined,'event-stop-save');
    const favorite=node('button','☆ Favorite','event-stop-favorite'),label=node('label','My private notes'),note=node('textarea'),save=node('button','Save note','event-note-save'),reload=node('button','Reload saved note','event-note-reload'),hint=node('p','','event-save-hint'),status=node('p','','event-save-status');
    const noteId='event-note-'+crypto.randomUUID();note.id=noteId;note.maxLength=2000;note.rows=3;label.htmlFor=noteId;note.placeholder='What would you like to remember about this stop?';
    for(const b of [favorite,save,reload])b.type='button';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    hint.id=noteId+'-hint';for(const el of [favorite,note,save])el.setAttribute('aria-describedby',hint.id);
    root.append(favorite,hint,label,note,save,reload,status);container.append(root);
    let busy=false,message='',seenOwner=owner,conflict=false;
    function paint(){
      if(seenOwner!==owner){seenOwner=owner;busy=false;message='';conflict=false;note.value='';}
      const signed=S.registered&&!C.expired,enabled=signed&&T.loaded&&!busy,saved=T.row(id),draft=drafts.get(id);
      favorite.disabled=note.disabled=save.disabled=!enabled;reload.disabled=!signed||busy;
      favorite.textContent=signed&&saved.favorite?'★ Favorited':'☆ Favorite';favorite.setAttribute('aria-pressed',String(signed&&saved.favorite));
      favorite.setAttribute('aria-label',`${saved.favorite?'Remove':'Save'} ${source.title} ${saved.favorite?'from':'to'} event Favorites`);
      const text=signed?(draft?.value??saved.note):'';if(note.value!==text)note.value=text;
      save.disabled=!enabled||!draft||draft.value===saved.note;
      hint.textContent=!signed?'Sign In to save':'Private to you. Saved for this event across all tour dates.';
      root.classList.toggle('is-guest',!signed);
      reload.hidden=!signed||(!conflict&&!T.error);reload.textContent=conflict?'Reload saved note':'Retry';
      status.textContent=!signed?'':busy?'Saving…':message||T.error||(!T.loaded?'Loading saved stops…':draft?'Unsaved changes':'');
    }
    note.oninput=()=>{const saved=T.row(id),previous=drafts.get(id);if(note.value===saved.note)drafts.delete(id);else drafts.set(id,{value:note.value,expected:previous?.expected??saved.note});message='';paint();};
    async function write(field,value,expected){
      const account=owner;busy=true;message='';paint();
      try{await T.set(id,field,value,expected);if(account!==owner)return;if(field==='note')drafts.delete(id);message=field==='note'?'Note saved.':value?'Added to event Favorites.':'Removed from event Favorites.';conflict=false;}
      catch(e){if(account!==owner)return;message=e.message;conflict=e.code==='PT409';}
      finally{if(account===owner){busy=false;paint();}}
    }
    favorite.onclick=()=>{const saved=T.row(id);write('favorite',!saved.favorite,saved.favorite);};
    save.onclick=()=>{const draft=drafts.get(id);if(draft)write('note',draft.value,draft.expected);};
    reload.onclick=async()=>{const account=owner;busy=true;paint();try{await T.reload();if(account!==owner)return;drafts.delete(id);conflict=false;message='Saved note reloaded.';}catch(e){if(account===owner)message=e.message;}finally{if(account===owner){busy=false;paint();}}};
    views.add(paint);paint();T.ready().catch(()=>{});
    return ()=>{views.delete(paint);root.remove();};
  }
  function bind(popup,source){
    if(source.eventId!==C.id||source.sourceId===undefined)return;
    let dispose;const open=()=>{dispose?.();const body=popup.getElement().querySelector('.event-stop-detail,.planner-popup-body');if(body.classList.contains('planner-popup-body'))window.PlanPanel.close();dispose=mount(body,source);};
    popup.on('open',open);popup.on('close',()=>{dispose?.();dispose=null;});if(popup.isOpen())open();
  }
  T.subscribe(()=>{if(owner!==T.owner||C.expired){owner=T.owner;drafts.clear();}views.forEach(fn=>fn());});
  window.addEventListener('pagehide',()=>{drafts.clear();views.clear();});
  window.SpecialEventSaved={bind};
})();
