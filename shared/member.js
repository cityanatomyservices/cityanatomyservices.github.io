/* Account data shared across same-origin apps. No guest persistence, chat
   presence, location tracking, or itinerary scheduling belongs in this module. */
(() => {
  try { if(window.parent!==window && window.parent.AustinVisit===window.AustinVisit && window.parent.AustinMember) {
    window.AustinMember=window.parent.AustinMember;return;
  }} catch(_) {}
  const S=window.AustinSession,V=window.AustinVisit,listeners=new Set(),avatars=new Map();
  const emojis=['🙂','🦊','🦉','🦄','🐙','🦀','🐢','🐬','🦋','🌻','🌈','🌵','🍄','🍋','🍉','🍑','🫐','🪐','⭐','🎈','🎨','🎸','🧁','☕','🌙'];
  const adjectives=['Sparky','Breezy','Mellow','Sunny','Jazzy','Plucky','Dreamy','Zesty','Peachy','Frosty','Cosmic','Glowy','Cheery','Snazzy','Bouncy','Mossy','Giddy','Nimble','Fuzzy','Lucky'];
  const nouns=['Otter','Robin','Comet','Peach','Maple','Pebble','Lantern','Moth','Biscuit','Thistle','Fern','Waffle','Sparrow','Cactus','Cloud','Pine','River','Marble','Daisy','Fox','Gecko'];
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  const generate=()=>({handle:pick(adjectives)+pick(nouns)+Math.floor(Math.random()*90+10),emoji:pick(emojis)});
  const currentOwner=()=>S.registered?S.user.id:null;
  const client=()=>S.client();
  let owner=null,data=null,pending=null,generation=0,queue=Promise.resolve(),lastError='';
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('austin-member-updates'):null;
  const emit=section=>listeners.forEach(fn=>fn(section));
  function clearAvatars(){for(const value of avatars.values())value.then(url=>{if(url)URL.revokeObjectURL(url);}).catch(()=>{});avatars.clear();}
  function changed(section){if(section==='profile')clearAvatars();emit(section);channel?.postMessage({owner,section});}
  function assertOwner(id){if(!id||currentOwner()!==id)throw new Error('Your account changed. Please try again.');}
  function reset(){owner=currentOwner();data=null;pending=null;generation++;lastError='';clearAvatars();emit('account');}
  async function ready() {
    await S.peek();
    if(currentOwner()!==owner)reset();
    if(!owner)return null;
    if(data)return data;
    if(pending)return pending;
    const id=owner,run=generation;
    const task=(async()=>{
      const result=await client().rpc('member_load');if(result.error)throw result.error;
      assertOwner(id);if(run!==generation)return ready();
      data=structuredClone(result.data);lastError='';emit('loaded');return data;
    })();pending=task;
    try{return await task;}catch(error){lastError='Account details could not load. Please try again.';throw error;}
    finally{if(pending===task)pending=null;}
  }
  function write(fn) {
    const id=currentOwner();
    if(!id)return Promise.reject(new Error('Sign in to save this to your account.'));
    const task=queue.catch(()=>{}).then(async()=>{assertOwner(id);await ready();assertOwner(id);return fn(id);});
    queue=task;return V.track(task);
  }
  async function check(result){if(result.error)throw result.error;return result.data;}
  async function afterWrite(id){assertOwner(id);if(!data)await ready();assertOwner(id);}
  async function saveProfile(patch) {
    return write(async id=>{
      const row=await check(await client().from('profiles').upsert({id,...patch}).select('handle,emoji,avatar_path,show_avatar').single());
      await afterWrite(id);data.profile=structuredClone(row);changed('profile');return data.profile;
    });
  }
  async function profile() {
    await ready();if(!owner)return null;
    if(data.profile?.handle)return data.profile;
    let name;try{name=JSON.parse(V.get('chat:identity'));}catch(_){}
    for(let attempt=0;attempt<5;attempt++) {
      try {return await saveProfile(name?.handle?{handle:name.handle,emoji:name.emoji}:generate());}
      catch(error){if(error.code!=='23505')throw error;name=null;}
    }
    throw new Error('Could not create a nickname. Please try again.');
  }
  async function saveIdentity({handle,emoji,show_avatar}) {
    handle=String(handle||'').trim();
    if(!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{2,29}$/u.test(handle))throw new Error('Use 3–30 letters, numbers, spaces, dots, dashes or underscores.');
    if(!emojis.includes(emoji))throw new Error('Choose an emoji from the list.');
    try{return await saveProfile({handle,emoji,show_avatar:!!show_avatar});}
    catch(error){if(error.code==='23505')throw new Error('That nickname is already taken. Please choose another.');throw error;}
  }
  async function imageBlob(file) {
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('Choose a JPG, PNG or WebP picture under 10 MB.');
    const url=URL.createObjectURL(file),image=new Image();
    try {
      image.src=url;await image.decode();
      if(!image.naturalWidth||image.naturalWidth*image.naturalHeight>40000000)throw new Error('Please choose a smaller picture.');
      const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
      const size=Math.min(image.naturalWidth,image.naturalHeight);
      canvas.getContext('2d').drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,256,256);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.82));
      if(!blob||blob.type!=='image/webp'||blob.size>131072)throw new Error('This picture could not be resized. Please choose another.');
      return blob;
    } finally {URL.revokeObjectURL(url);}
  }
  async function uploadAvatar(file) {
    const id=currentOwner();assertOwner(id);const blob=await imageBlob(file);assertOwner(id);
    return write(async owner=>{
      const path=owner+'/avatar.webp';
      await check(await client().storage.from('avatars').upload(path,blob,{contentType:'image/webp',upsert:true,cacheControl:'0'}));
      assertOwner(owner);
      // New uploads stay hidden until the person explicitly enables the photo.
      const row=await check(await client().from('profiles').update({avatar_path:path}).eq('id',owner).select('handle,emoji,avatar_path,show_avatar').single());
      await afterWrite(owner);data.profile=structuredClone(row);changed('profile');return data.profile;
    });
  }
  async function removeAvatar() {
    return write(async id=>{
      await check(await client().storage.from('avatars').remove([id+'/avatar.webp']));assertOwner(id);
      const row=await check(await client().from('profiles').update({avatar_path:null,show_avatar:false}).eq('id',id).select('handle,emoji,avatar_path,show_avatar').single());
      await afterWrite(id);data.profile=structuredClone(row);changed('profile');return data.profile;
    });
  }
  function avatar(handle,own=false) {
    const key=(own?'own:':'public:')+handle;
    if(!avatars.has(key))avatars.set(key,(async()=>{
      let p;
      if(own){p=await profile();}else {
        await S.ready();const result=await client().rpc('profile_display',{p_handle:handle});if(result.error)return null;p=result.data;
      }
      if(!p?.avatar_path)return null;
      // A new URL prevents an overwritten avatar from reusing an older CDN
      // response. The short-lived URL is fetched into memory, never published
      // in a chat message or stored in the account profile.
      const {data:signed,error}=await client().storage.from('avatars').createSignedUrl(p.avatar_path,60,{download:crypto.randomUUID()+'.webp'});
      if(error)return null;
      const response=await fetch(signed.signedUrl,{cache:'no-store',signal:AbortSignal.timeout(10000)});
      return response.ok?URL.createObjectURL(await response.blob()):null;
    })().catch(()=>null));
    return avatars.get(key);
  }
  // Plain text and a locally created blob URL only; no sender-supplied image URL.
  function paintIdentity(element,identity,{own=false,photo=true}={}) {
    const doc=element.ownerDocument,mark=doc.createElement('span');mark.className='member-avatar';mark.textContent=identity.emoji||'🙂';
    element.replaceChildren(mark,doc.createTextNode(' '+(identity.handle||'')));
    const stamp=crypto.randomUUID();element.dataset.identityStamp=stamp;
    if(photo&&identity.handle)avatar(identity.handle,own).then(url=>{
      if(!url||!element.isConnected||element.dataset.identityStamp!==stamp)return;
      const img=doc.createElement('img');img.src=url;img.alt='';img.width=28;img.height=28;img.onerror=()=>{mark.textContent=identity.emoji||'🙂';};mark.replaceChildren(img);
    });
  }
  function cleanSource(source) {
    if(!source||typeof source.key!=='string'||!source.key||source.key.length>500||typeof source.title!=='string'||!source.title.trim()||source.title.length>300)throw new Error('This item cannot be saved.');
    const copy=JSON.parse(JSON.stringify(source));
    if(JSON.stringify(copy).length>22000)throw new Error('This listing is too large to save. Open its details instead.');
    return copy;
  }
  function favorite(source,on) {
    source=cleanSource(source);
    return write(async id=>{
      const result=on?await client().from('member_favorites').upsert({owner_id:id,source_key:source.key,source}, {onConflict:'owner_id,source_key'}):
        await client().from('member_favorites').delete().eq('owner_id',id).eq('source_key',source.key);
      await check(result);await afterWrite(id);
      data.favorites=data.favorites.filter(f=>f.key!==source.key);if(on)data.favorites.unshift(source);changed('favorites');
    });
  }
  function preference(key,value) {
    if(!currentOwner())return Promise.resolve();
    return write(async id=>{
      await check(await client().rpc('member_preference_set',{p_key:key,p_value:value}));await afterWrite(id);
      data.preferences[key]=structuredClone(value);changed('preferences');
    });
  }
  function progress(tour,stop,on) {
    if(!currentOwner())return Promise.resolve();
    return write(async id=>{
      const result=on?await client().from('tour_progress').upsert({user_id:id,tour,stop_id:stop}):
        await client().from('tour_progress').delete().eq('user_id',id).eq('tour',tour).eq('stop_id',stop);
      await check(result);await afterWrite(id);data.progress=data.progress.filter(p=>p.tour!==tour||p.stop_id!==stop);
      if(on)data.progress.push({tour,stop_id:stop});changed('progress');
    });
  }
  channel?.addEventListener('message',event=>{
    if(!owner||event.data?.owner!==owner)return;
    data=null;generation++;pending=null;clearAvatars();ready().catch(()=>emit('error'));
  });
  S.subscribe(()=>{if(currentOwner()!==owner){reset();if(owner)ready().catch(()=>emit('error'));}});
  window.addEventListener('pagehide',()=>{channel?.close();clearAvatars();listeners.clear();});
  window.AustinMember={ready,profile,saveIdentity,uploadAvatar,removeAvatar,avatar,paintIdentity,generate,emojis,
    favorite,preference,progress,cleanSource,
    get state(){return data;},get error(){return lastError;},get owner(){return owner;},
    has:key=>!!data?.favorites.some(f=>f.key===key),
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    async reload(){data=null;pending=null;generation++;return ready();}
  };
  ready().catch(()=>{});
})();
