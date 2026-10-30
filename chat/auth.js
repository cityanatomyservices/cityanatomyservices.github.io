// auth.js — who you are, on every page under austin.chat (replaces the
// browser-only identity.js on 2026-10-22, docs/CHAT-PLAN.md §2).
//
// Guest accounts and names last for the current page visit. Only a
// registered account reads/writes a saved chat profile. The main map and
// planner share the temporary identity while switching within their frame.
//
// If Supabase cannot be reached, the page still works: the name falls back
// to a random one kept in visit memory, and the chat runs live-only.
//
// window.ChatIdentity: ready() -> { handle, emoji }  (once, at load)
//                      regenerate() -> { handle, emoji }  ("New name")
//                      client()  the shared Supabase client (chat.js uses it)
//                      userId()  the auth user id, or null when offline
(function () {
  const ADJECTIVES = ['Sparky', 'Breezy', 'Mellow', 'Sunny', 'Jazzy', 'Plucky', 'Dreamy', 'Zesty', 'Peachy', 'Frosty',
    'Cosmic', 'Glowy', 'Cheery', 'Snazzy', 'Bouncy', 'Mossy', 'Giddy', 'Nimble', 'Fuzzy', 'Lucky', 'Nifty', 'Lively', 'Jolly', 'Zippy'];
  const NOUNS = ['Otter', 'Robin', 'Comet', 'Peach', 'Maple', 'Pebble', 'Lantern', 'Moth', 'Biscuit', 'Thistle', 'Fern',
    'Waffle', 'Sparrow', 'Cactus', 'Cloud', 'Pine', 'River', 'Marble', 'Teacup', 'Daisy', 'Fox', 'Gecko', 'Mango', 'Lark', 'Kite', 'Bean'];
  const EMOJIS = ['🦊', '🦉', '🦄', '🐙', '🦀', '🐢', '🐬', '🦋', '🌻', '🌈', '🌵', '🍄', '🍋', '🍉', '🍑', '🫐', '🪐', '⭐', '🎈', '🎨', '🎸', '🧁', '☕', '🌙'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const generate = () => ({ handle: pick(ADJECTIVES) + pick(NOUNS) + Math.floor(Math.random() * 90 + 10), emoji: pick(EMOJIS) });

  // Guest names stay in the page visit; registered names use their profile.
  const remember = i => window.AustinVisit.set('chat:identity', JSON.stringify(i));
  const remembered = () => { try { return JSON.parse(window.AustinVisit.get('chat:identity')); } catch (_) { return null; } };

  let uid = null;
  let me = null;
  let pending, generation=0, account, closed=false;

  function getClient() {
    return window.AustinSession.client();
  }

  // The session is temporary for guests and persistent for registered users.
  async function signIn() {
    return (await window.AustinSession.ready()).user.id;
  }

  // write a name to the profile; a taken handle gets a new try (handles are unique)
  async function saveName(ident,owner=uid) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await getClient().from('profiles').upsert({ id: owner, handle: ident.handle, emoji: ident.emoji });
      if (!error) return ident;
      if (error.code !== '23505') throw error;          // 23505 = unique violation: handle taken
      ident = generate();
    }
    throw new Error('no free handle');
  }

  async function load(run) {
      let owner,identity;
      try {
        owner = await signIn();
        if(run!==generation)return ready();
        if (!window.AustinSession.registered) identity = remembered() || generate();
        else {
          const { data, error } = await getClient().from('profiles').select('handle, emoji').eq('id', owner).maybeSingle();
          if(run!==generation)return ready();
          if (error) throw error;
          identity = data && data.handle ? { handle: data.handle, emoji: data.emoji || '🙂' } : await saveName(remembered() || generate(),owner);
        }
      } catch (e) {
        console.warn('austin.chat: signed-in name unavailable, using a browser-only one', e.message || e);
        owner = null;
        identity = remembered() || generate();
      }
      if(run!==generation)return ready();
      uid=owner;me=identity;
      const user=window.AustinSession.user;
      if(user)account=`${user.id}:${user.is_anonymous}`;
      remember(me);
      return me;
  }
  function ready() {
    if(me)return Promise.resolve(me);
    if(!pending){const run=generation;pending=load(run).finally(()=>{if(run===generation)pending=null;});}
    return pending;
  }
  const unsubscribe=window.AustinSession.subscribe?.((_event,session)=>{
    const next=session ? `${session.user.id}:${session.user.is_anonymous}` : '';
    if(next===account)return;
    const previous=account;account=next;
    if(previous===undefined)return;
    generation++;pending=null;uid=null;me=null;
    window.dispatchEvent(new CustomEvent('austin:identity-changing'));
    const run=generation;
    ready().then(identity=>{if(!closed&&run===generation)window.dispatchEvent(new CustomEvent('austin:identity-changed',{detail:identity}));});
  });
  window.addEventListener('pagehide',()=>{closed=true;unsubscribe?.();});
  window.ChatIdentity = {
    client: getClient,
    userId: () => uid,
    ready,

    async regenerate() {
      const run=generation;
      const fresh = generate();
      let identity;
      try { identity = uid && window.AustinSession.registered ? await saveName(fresh) : fresh; }
      catch (e) { console.warn('austin.chat: could not save the new name', e.message || e); identity = fresh; }
      if(run!==generation)return ready();
      me=identity;
      remember(me);
      return me;
    }
  };
})();
