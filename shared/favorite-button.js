/* Reusable Favorite action. Saving a Favorite does not select a plan day or
   enter a chat room. Source adapters remain owned by the listing modules. */
(() => {
  const M=window.AustinMember,sources=new WeakMap();
  const style=document.createElement('link');style.rel='stylesheet';style.href='/shared/member.css?v=20261030c';document.head.append(style);
  function paint(button){
    const source=sources.get(button);if(!source)return;const saved=M.has(source.key);
    button.textContent=saved?'★ Saved':'☆ Favorite';button.setAttribute('aria-pressed',String(saved));
    button.setAttribute('aria-label',`${saved?'Remove':'Save'} ${source.title} ${saved?'from':'to'} Favorites`);
  }
  function refresh(){document.querySelectorAll('.favorite-select').forEach(paint);}
  function mount(container,source){
    const button=document.createElement('button');button.className='favorite-select';button.type='button';sources.set(button,source);container.append(button);paint(button);let warning;
    button.onclick=async event=>{
      event.preventDefault();event.stopPropagation();button.disabled=true;
      try{
        await window.AustinSession.peek();
        if(!window.AustinSession.registered){const account=window.AustinAccount||window.parent.AustinAccount;await account?.open('favorites');return;}
        await M.ready();await M.favorite(source,!M.has(source.key));button.title='';warning?.remove();warning=null;
      }catch(error){button.title=error.message||'Could not save. Please try again.';if(!warning){warning=document.createElement('p');warning.className='favorite-error';warning.setAttribute('role','alert');container.append(warning);}warning.textContent=button.title;}
      finally{button.disabled=false;refresh();}
    };
    return button;
  }
  window.AustinFavorites={mount};
  window.addEventListener('austin:planner-target',event=>{
    const {container,provider,data}=event.detail;
    const source=provider==='place'?window.PlanSources.place(data):window.PlanSources.feature(data);
    mount(container,source);
  });
  const unsubscribe=M.subscribe(refresh);window.addEventListener('pagehide',unsubscribe);
})();
