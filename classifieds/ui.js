/* Self-managed text notes. Account email is never read or automatically shown. */
(() => {
  const C=window.ClassifiedsClient,M=window.ClassifiedsModel;
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;};
  const button=text=>{const el=node('button',text);el.type='button';return el;};
  const categoryTitle=id=>M.categories.find(c=>c.id===id)?.title||'';
  const link=(text,category)=>{const a=node('a',text);a.href='/classifieds/'+(category?category+'/':'');a.target='_top';return a;};
  const signIn=()=> (window.AustinAccount||window.parent.AustinAccount)?.open();
  const date=value=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric'}).format(new Date(value));
  const dialog=node('dialog',null,'classifieds-dialog');dialog.setAttribute('aria-label','Your free classified');
  document.body.append(dialog);
  dialog.addEventListener('close',()=>dialog.replaceChildren());
  function form(ad,category,done=()=>{}){
    const root=node('section',null,'classifieds-editor'),heading=node('h3',ad?'Your ad · edit anytime':'Your free ad');
    const context=node('div',null,'classifieds-actions'),categoryLabel=node('span',categoryTitle(category)),change=button('Change category');
    context.append(categoryLabel,change);
    const choices=node('div',null,'classifieds-choices');choices.hidden=true;choices.setAttribute('role','group');choices.setAttribute('aria-label','Choose your ad category');
    M.categories.forEach(c=>{const b=button(c.title);b.onclick=()=>{category=c.id;categoryLabel.textContent=c.title;choices.hidden=true;change.setAttribute('aria-expanded','false');change.focus();};choices.append(b);});
    change.setAttribute('aria-expanded','false');change.onclick=()=>{choices.hidden=!choices.hidden;change.setAttribute('aria-expanded',String(!choices.hidden));};
    const fields=node('form'),fieldset=node('fieldset'),titleLabel=node('label','Title'),title=node('input'),bodyLabel=node('label','Paragraph'),body=node('textarea');
    title.name='title';title.required=true;title.maxLength=100;title.value=ad?.title||'';
    body.name='body';body.required=true;body.maxLength=1000;body.rows=5;body.value=ad?.body||'';
    titleLabel.append(title);bodyLabel.append(body);
    const help=node('p','Up to 100 characters for the title and 1,000 for the paragraph. Include contact details only if you want people to see them.','classifieds-help');
    const actions=node('div',null,'classifieds-actions'),save=button(ad?'Save changes':'Post free ad');save.type='submit';save.className='classifieds-primary';actions.append(save);
    const status=node('p',null,'classifieds-status');status.setAttribute('role','status');
    if(ad){const remove=button('Delete your ad');remove.onclick=async()=>{
      if(!confirm('Delete your classified ad?'))return;
      fieldset.disabled=true;change.disabled=true;status.textContent='Deleting…';
      try{await C.remove(ad.revision,ad.id);done();}catch(e){if(!e.changed)status.textContent=e.message;}
      finally{fieldset.disabled=false;change.disabled=false;}
    };actions.append(remove);}
    fieldset.append(titleLabel,bodyLabel,help,actions);fields.append(fieldset,status);
    fields.onsubmit=async event=>{
      event.preventDefault();if(!fields.reportValidity())return;
      const error=M.validate(category,title.value,body.value);if(error){status.textContent=error;return;}
      fieldset.disabled=true;change.disabled=true;choices.hidden=true;status.textContent='Saving…';
      try{await C.save(category,M.clean(title.value),M.clean(body.value),ad?.revision||0,ad?.id||null);done();}
      catch(e){if(!e.changed)status.textContent=e.message;}
      finally{fieldset.disabled=false;change.disabled=false;}
    };
    root.append(heading,context,choices,fields);return root;
  }
  function compose(category){
    if(!C.registered){signIn();return;}
    dialog.replaceChildren();const head=node('div',null,'classifieds-heading'),title=node('h2','Post your free ad'),close=button('×');close.setAttribute('aria-label','Close ad form');close.onclick=()=>dialog.close();head.append(title,close);dialog.append(head);
    const content=node('div');dialog.append(content);
    const show=id=>{content.replaceChildren(form(null,id,()=>dialog.close()));content.querySelector('input').focus();};
    if(category)show(category);
    else {content.append(node('p','Choose a category for your ad.'));const choices=node('div',null,'classifieds-choices');for(const c of M.categories){const b=button(c.title);b.onclick=()=>show(c.id);choices.append(b);}content.append(choices);}
    dialog.showModal();
  }
  function mount(root,{category=null,active=()=>true}={}){
    root.classList.add('classifieds-content');
    const guest=node('div',null,'classifieds-guest'),note=node('p','Create an account or sign in to use free classifieds.');
    const login=button('Create an account / sign in');login.onclick=signIn;guest.append(note,login);
    const member=node('div');member.hidden=true;
    const intro=node('p','One free ad per account. Other signed-in members see what you write.','classifieds-help');
    const actions=node('div',null,'classifieds-actions'),post=button('Post your free ad'),refresh=button('Refresh ads');post.className='classifieds-primary';actions.append(post,refresh);
    const status=node('p',null,'classifieds-status');status.setAttribute('role','status');
    const directory=node('div',null,'classifieds-categories'),mine=node('div'),ads=node('div',null,'classifieds-ads'),more=button('Show more ads');more.hidden=true;
    member.append(intro,actions,status,directory,mine,ads,more);root.append(guest,member);
    let data=null,offset=0,request=0,rows=[],loading=false,notice='';
    function auth(){guest.hidden=C.registered;member.hidden=!C.registered;}
    function clear(){request++;data=null;rows=[];offset=0;loading=false;directory.replaceChildren();mine.replaceChildren();ads.replaceChildren();more.hidden=true;status.textContent='';post.hidden=true;if(dialog.open)dialog.close();auth();}
    function render(){
      auth();directory.replaceChildren();mine.replaceChildren();ads.replaceChildren();
      post.hidden=!!data.mine;
      if(data.mine){
        if(!category||data.mine.category===category)mine.append(form(data.mine,data.mine.category));
        else mine.append(link('Edit your ad in '+categoryTitle(data.mine.category),data.mine.category));
      }
      if(!category){
        directory.append(node('h3','Browse categories'));
        const list=node('ul');for(const c of data.categories){const item=node('li'),a=link(c.title,c.id);a.append(node('span',`${c.count} ${c.count===1?'ad':'ads'}`));item.append(a);list.append(item);}directory.append(list);
      }else{
        const shown=rows.filter(ad=>!ad.mine);
        if(!rows.length)ads.append(node('p','No ads in this category yet.'));
        for(const ad of shown){const article=node('article',null,'classifieds-ad');article.append(node('h2',ad.title),node('p',ad.body),node('time',date(ad.created_at)));ads.append(article);}
      }
      more.hidden=!category||!data.more;
    }
    async function load(append=false){
      const run=++request;if(!C.registered){clear();return;}auth();loading=true;refresh.disabled=true;more.disabled=true;post.disabled=true;status.textContent='Loading classifieds…';
      try{
        const nextOffset=append?offset+20:0,result=await C.read(category,nextOffset);
        if(run!==request||!C.registered)return;
        data=result;offset=nextOffset;rows=append?[...rows,...result.ads.filter(a=>!rows.some(r=>r.id===a.id))]:result.ads;render();
        status.textContent=notice||(category?`${result.total} ${result.total===1?'ad':'ads'} in ${categoryTitle(category)}`:'');notice='';
      }catch(e){if(run===request&&!e.changed)status.textContent=e.message;}
      finally{if(run===request){loading=false;refresh.disabled=false;more.disabled=false;post.disabled=!data;}}
    }
    post.onclick=()=>compose(category);refresh.onclick=()=>load();more.onclick=()=>{if(!loading)load(true);};
    const unsub=C.subscribe(event=>{if(event.type==='identity'){clear();if(active()&&C.registered)load();}else if(active()){notice=event.message||'';load();}else clear();});
    const ready=C.ready().then(()=>{auth();if(active()&&C.registered)load();}).catch(()=>{status.textContent='Account unavailable. Try signing in again.';});
    window.addEventListener('pagehide',()=>{unsub();clear();},{once:true});
    return {refresh:async()=>{await ready;if(C.registered)load();else auth();},clear};
  }
  C.subscribe(event=>{if(event.type==='identity'&&dialog.open)dialog.close();});
  window.addEventListener('pagehide',()=>C.destroy(),{once:true});
  window.ClassifiedsUI={mount};
})();
