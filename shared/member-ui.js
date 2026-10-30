/* Profile and Favorites UI. Account storage lives in member.js; adding a
   favorite to a day uses the planner's existing public selection API. */
(() => {
  const M=window.AustinMember;
  const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
  const action=(text,fn)=>{const b=node('button',text);b.type='button';b.onclick=fn;return b;};
  function safeLink(url){if(typeof url!=='string'||!url.trim())return null;try{const u=new URL(url,location.origin);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch(_){return null;}}
  const store=()=>{try{return window.PlanStore||document.getElementById('app-window')?.contentWindow.PlanStore;}catch(_){return null;}};
  window.AustinMemberUI={mount(host){
    const root=node('section',undefined,'member-controls');
    root.innerHTML=`<div class="member-tabs" role="group" aria-label="Account sections"><button type="button" data-member-tab="profile" aria-pressed="true">Profile & privacy</button><button type="button" data-member-tab="favorites" aria-pressed="false">Favorites</button><button type="button" data-member-tab="settings" aria-pressed="false">Preferences</button></div>
      <section data-member-panel="profile"><p class="account-help">Use any nickname. Your email and Google identity stay private. A nickname is still linked to your account so your things can be saved.</p>
        <form id="member-profile-form"><fieldset id="member-profile-fields" disabled>
          <label>Profile name<input id="member-handle" autocomplete="nickname" minlength="3" maxlength="30" required></label>
          <button type="button" id="member-random">Use a random nickname</button>
          <label>Emoji<select id="member-emoji" aria-label="Profile emoji"></select></label>
          <div class="member-preview"><span id="member-preview"></span><small>What other visitors see</small></div>
          <label class="member-file">Optional picture<input id="member-photo" type="file" accept="image/jpeg,image/png,image/webp"></label>
          <p class="account-help">JPG, PNG or WebP, up to 10 MB. We keep a small square picture and remove embedded location data.</p>
          <label class="member-check"><input id="member-show-photo" type="checkbox">Show my picture beside my nickname in chat</label>
          <button type="button" id="member-remove-photo" hidden>Delete my picture</button>
          <p class="account-help">Using a nickname and emoji is fine. A displayed picture can be copied by viewers. Map visibility is controlled separately in Chat.</p>
          <button type="submit" id="member-save-profile">Save profile</button>
        </fieldset></form><p id="member-profile-status" role="status"></p></section>
      <section data-member-panel="favorites" hidden><p>Keep places, events and apps for later. Your Favorites are private and do not reserve a place or add it to your day.</p><p id="member-favorites-count"></p><div id="member-favorites-list"></div><p id="member-favorites-status" role="status"></p></section>
      <section data-member-panel="settings" hidden><p>Your Explore categories, ticker choices, appearance and navigation app save to your account when you change them.</p><label>Appearance<select id="member-theme"><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Navigation app<select id="member-navigation"><option value="google">Google Maps</option><option value="apple">Apple Maps</option><option value="waze">Waze</option></select></label><p class="account-help">Choose Explore categories on the map and ticker topics with the ticker’s settings button.</p><div id="member-progress"></div><p id="member-preferences-status" role="status"></p></section>
      <button type="button" id="member-retry" hidden>Retry loading account details</button>`;
    host.append(root);
    const $=id=>root.querySelector('#'+id);let busy=false,dirty=false,seenOwner=null,opened=false,tab='profile',viewRun=0;
    M.emojis.forEach(emoji=>{const o=node('option',emoji);o.value=emoji;$('member-emoji').append(o);});
    const status=(section,text)=>{$('member-'+section+'-status').textContent=text;};
    function showTab(value){tab=value;root.querySelectorAll('[data-member-panel]').forEach(n=>{n.hidden=n.dataset.memberPanel!==tab;});root.querySelectorAll('[data-member-tab]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.memberTab===tab)));if(tab==='favorites')favorites();}
    root.querySelectorAll('[data-member-tab]').forEach(b=>b.onclick=()=>showTab(b.dataset.memberTab));
    function preview(){const p=M.state?.profile;M.paintIdentity($('member-preview'),{handle:$('member-handle').value||'Your nickname',emoji:$('member-emoji').value},{own:true,photo:!!p?.avatar_path&&$('member-show-photo').checked});}
    function profile(fill=false){
      const p=M.state?.profile;if(!p)return;
      if(fill&&!dirty){$('member-handle').value=p.handle||'';$('member-emoji').value=p.emoji||'🙂';$('member-show-photo').checked=!!p.show_avatar;}
      $('member-show-photo').disabled=!p.avatar_path;$('member-remove-photo').hidden=!p.avatar_path;preview();
    }
    function favorites(){
      const list=$('member-favorites-list');list.replaceChildren();const items=M.state?.favorites||[];
      $('member-favorites-count').textContent=items.length?`${items.length} of 200 Favorites`:'No Favorites yet. Look for ☆ Favorite beside an Explore listing, a neighborhood business or an app.';
      for(const source of items){
        const card=node('article',undefined,'member-favorite'),title=node('strong',source.title);card.append(title);
        if(source.venue&&source.venue!==source.title)card.append(node('p',source.venue));
        const date=source.start||source.validUntil;
        if(date&&Number.isFinite(Date.parse(date))){const past=Date.parse(source.end||source.validUntil||date)<Date.now();card.append(node('p',(past?'Past listing · ':'')+new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',dateStyle:'medium'}).format(new Date(date))+(past?' · check for new dates':''),'account-help'));}
        const actions=node('div',undefined,'member-favorite-actions'),href=safeLink(source.url);
        if(href){const link=node('a',source.kind==='app'?'Open app ↗':'Details ↗');link.href=href;link.target=source.kind==='app'?'_top':'_blank';link.rel='noopener noreferrer';actions.append(link);}
        if(Array.isArray(source.coordinates)&&source.kind!=='app')actions.append(action('Add to Day Planner',async event=>{
          const s=store();if(!s){status('favorites','Open Day Planner, then return to Account → Favorites to add this stop.');const link=node('a','Open Day Planner');link.href='/myplanmap/';$('member-favorites-status').append(' ',link);return;}
          const b=event.currentTarget;b.disabled=true;
          try{const day=await s.select(source,true);status('favorites',`Added to your plan for ${day}. Dated events keep their published day.`);}catch(e){status('favorites',e.message);}finally{b.disabled=false;}
        }));
        actions.append(action('Remove',async event=>{const b=event.currentTarget;b.disabled=true;try{await M.favorite(source,false);status('favorites','Favorite removed.');}catch(_){status('favorites','Could not remove that Favorite. Try again.');b.disabled=false;}}));
        card.append(actions);list.append(card);
      }
    }
    function settings(){
      try{$('member-theme').value=localStorage.getItem('theme')||'light';$('member-navigation').value=localStorage.getItem('austin:navigation-app')||'google';}catch(_){}
      const progress=M.state?.progress||[],box=$('member-progress');box.replaceChildren(node('p','Tour progress','member-section-title'));
      for(const [id,label,url] of [['moontower','Moontower tour','/apps/moontower/'],['1885','Murder tour','/apps/1885/']]){const link=node('a',`${label} · ${progress.filter(p=>p.tour===id).length} completed stops`);link.href=url;box.append(link);}
      status('preferences',window.AustinPreferences?.error||'');
    }
    async function load(){
      const run=++viewRun;$('member-profile-fields').disabled=true;$('member-retry').hidden=true;
      try{await M.profile();if(run!==viewRun||!window.AustinSession.registered)return;profile(true);favorites();settings();$('member-profile-fields').disabled=false;}
      catch(_){if(run===viewRun){status('profile','Your profile could not load. Your saved plans are unchanged.');$('member-retry').hidden=false;}}
    }
    async function operation(fn,success){if(busy)return;busy=true;$('member-profile-fields').disabled=true;status('profile','Saving…');try{await fn();status('profile',success);profile(false);}catch(e){status('profile',e.message||'Could not save. Please try again.');}finally{busy=false;$('member-profile-fields').disabled=false;}}
    $('member-profile-form').addEventListener('input',()=>{dirty=true;preview();});
    $('member-random').onclick=()=>{const p=M.generate();$('member-handle').value=p.handle;$('member-emoji').value=p.emoji;$('member-show-photo').checked=false;dirty=true;preview();};
    $('member-profile-form').onsubmit=event=>{event.preventDefault();operation(async()=>{await M.saveIdentity({handle:$('member-handle').value,emoji:$('member-emoji').value,show_avatar:$('member-show-photo').checked});dirty=false;profile(true);},'Profile saved.');};
    $('member-photo').onchange=()=>{const file=$('member-photo').files[0];if(file)operation(()=>M.uploadAvatar(file),'Picture uploaded. Choose whether to show it, then save your profile.').finally(()=>{$('member-photo').value='';});};
    $('member-remove-photo').onclick=()=>operation(async()=>{await M.removeAvatar();$('member-show-photo').checked=false;},'Picture deleted. Your emoji is shown instead.');
    $('member-retry').onclick=()=>{M.reload().then(load).catch(()=>status('profile','Still unable to connect. Please try again later.'));};
    $('member-theme').onchange=()=>window.AustinPreferences.set('theme',$('member-theme').value);
    $('member-navigation').onchange=()=>window.AustinPreferences.set('navigation',$('member-navigation').value);
    M.subscribe(section=>{
      if(M.owner!==seenOwner){
        seenOwner=M.owner;dirty=false;viewRun++;$('member-favorites-list').replaceChildren();$('member-profile-form').reset();
        $('member-preview').dataset.identityStamp='';$('member-preview').replaceChildren();$('member-progress').replaceChildren();
        $('member-favorites-count').textContent='';$('member-profile-fields').disabled=true;status('profile','');status('favorites','');
      }
      if(!opened)return;
      if(['favorites','loaded'].includes(section))favorites();
      if(['profile','loaded'].includes(section))profile(true);
      if(['preferences','progress','loaded'].includes(section))settings();
    });
    window.AustinPreferences?.subscribe(settings);
    return {open(section){opened=true;if(section)showTab(section);return load();},close(){opened=false;viewRun++;dirty=false;},root};
  }};
})();
