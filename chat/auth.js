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

  function getClient() {
    return window.AustinSession.client();
  }

  // The session is temporary for guests and persistent for registered users.
  async function signIn() {
    return (await window.AustinSession.ready()).user.id;
  }

  // write a name to the profile; a taken handle gets a new try (handles are unique)
  async function saveName(ident) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await getClient().from('profiles').upsert({ id: uid, handle: ident.handle, emoji: ident.emoji });
      if (!error) return ident;
      if (error.code !== '23505') throw error;          // 23505 = unique violation: handle taken
      ident = generate();
    }
    throw new Error('no free handle');
  }

  window.ChatIdentity = {
    client: getClient,
    userId: () => uid,

    async ready() {
      if (me) return me;
      try {
        uid = await signIn();
        if (!window.AustinSession.registered) { me = remembered() || generate(); remember(me); return me; }
        const { data, error } = await getClient().from('profiles').select('handle, emoji').eq('id', uid).maybeSingle();
        if (error) throw error;
        me = data && data.handle ? { handle: data.handle, emoji: data.emoji || '🙂' } : await saveName(remembered() || generate());
      } catch (e) {
        console.warn('austin.chat: signed-in name unavailable, using a browser-only one', e.message || e);
        uid = null;
        me = remembered() || generate();
      }
      remember(me);
      return me;
    },

    async regenerate() {
      const fresh = generate();
      try { me = uid && window.AustinSession.registered ? await saveName(fresh) : fresh; }
      catch (e) { console.warn('austin.chat: could not save the new name', e.message || e); me = fresh; }
      remember(me);
      return me;
    }
  };
})();
