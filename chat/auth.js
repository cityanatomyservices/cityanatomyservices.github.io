// auth.js — who you are, on every page under austin.chat (replaces the
// browser-only identity.js on 2026-10-22, docs/CHAT-PLAN.md §2).
//
// Every visitor gets a Supabase ANONYMOUS account the first time a page
// loads: one tap-free sign-in, a session the browser keeps and shares with
// every app on austin.chat. Their name (handle) and emoji live in their
// `profiles` row, so the same name follows them into every app, and an
// account can later be upgraded to an email login without losing anything.
// Nobody has to register; registration only unlocks the history functions.
//
// If Supabase cannot be reached, the page still works: the name falls back
// to a random one kept in this browser, and the chat runs live-only.
//
// window.ChatIdentity: ready() -> { handle, emoji }  (once, at load)
//                      regenerate() -> { handle, emoji }  ("New name")
//                      client()  the shared Supabase client (chat.js uses it)
//                      userId()  the auth user id, or null when offline
(function () {
  const CFG = window.MAP_CONFIG;
  const KEY = 'austinchat:identity';
  const ADJECTIVES = ['Sparky', 'Breezy', 'Mellow', 'Sunny', 'Jazzy', 'Plucky', 'Dreamy', 'Zesty', 'Peachy', 'Frosty',
    'Cosmic', 'Glowy', 'Cheery', 'Snazzy', 'Bouncy', 'Mossy', 'Giddy', 'Nimble', 'Fuzzy', 'Lucky', 'Nifty', 'Lively', 'Jolly', 'Zippy'];
  const NOUNS = ['Otter', 'Robin', 'Comet', 'Peach', 'Maple', 'Pebble', 'Lantern', 'Moth', 'Biscuit', 'Thistle', 'Fern',
    'Waffle', 'Sparrow', 'Cactus', 'Cloud', 'Pine', 'River', 'Marble', 'Teacup', 'Daisy', 'Fox', 'Gecko', 'Mango', 'Lark', 'Kite', 'Bean'];
  const EMOJIS = ['🦊', '🦉', '🦄', '🐙', '🦀', '🐢', '🐬', '🦋', '🌻', '🌈', '🌵', '🍄', '🍋', '🍉', '🍑', '🫐', '🪐', '⭐', '🎈', '🎨', '🎸', '🧁', '☕', '🌙'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const generate = () => ({ handle: pick(ADJECTIVES) + pick(NOUNS) + Math.floor(Math.random() * 90 + 10), emoji: pick(EMOJIS) });

  // the browser copy: shown at once on the next load, and the fallback when offline
  const remember = (i) => { try { localStorage.setItem(KEY, JSON.stringify(i)); } catch (e) { /* private mode */ } };
  const remembered = () => { try { const i = JSON.parse(localStorage.getItem(KEY)); return i && i.handle && i.emoji ? i : null; } catch (e) { return null; } };

  let client = null;
  let uid = null;
  let me = null;

  function getClient() {
    if (!client) client = window.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey, { realtime: { params: { eventsPerSecond: 5 } } });
    return client;
  }

  // the session: the one the browser kept, or a new anonymous account
  async function signIn() {
    const c = getClient();
    const { data } = await c.auth.getSession();
    if (data.session) return data.session.user.id;
    const { data: fresh, error } = await c.auth.signInAnonymously();
    if (error) throw error;
    return fresh.user.id;
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
      try { me = uid ? await saveName(fresh) : fresh; }
      catch (e) { console.warn('austin.chat: could not save the new name', e.message || e); me = fresh; }
      remember(me);
      return me;
    }
  };
})();
