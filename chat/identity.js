// identity.js — who you are on the chat map: a random handle and an emoji,
// made once and remembered in this browser (localStorage) until the visitor
// asks for a new one or clears the browser. Nothing is sent anywhere until
// they are visible in a neighborhood. docs/CHAT-PLAN.md §2: a Supabase
// account (anonymous sign-in, upgradable to email) replaces this later and
// keeps the same shape, { handle, emoji }.
(function () {
  const KEY = 'austinchat:identity';
  const ADJECTIVES = ['Sparky', 'Breezy', 'Mellow', 'Sunny', 'Jazzy', 'Plucky', 'Dreamy', 'Zesty', 'Peachy', 'Frosty',
    'Cosmic', 'Glowy', 'Cheery', 'Snazzy', 'Bouncy', 'Mossy', 'Giddy', 'Nimble', 'Fuzzy', 'Lucky', 'Nifty', 'Lively', 'Jolly', 'Zippy'];
  const NOUNS = ['Otter', 'Robin', 'Comet', 'Peach', 'Maple', 'Pebble', 'Lantern', 'Moth', 'Biscuit', 'Thistle', 'Fern',
    'Waffle', 'Sparrow', 'Cactus', 'Cloud', 'Pine', 'River', 'Marble', 'Teacup', 'Daisy', 'Fox', 'Gecko', 'Mango', 'Lark', 'Kite', 'Bean'];
  const EMOJIS = ['🦊', '🦉', '🦄', '🐙', '🦀', '🐢', '🐬', '🦋', '🌻', '🌈', '🌵', '🍄', '🍋', '🍉', '🍑', '🫐', '🪐', '⭐', '🎈', '🎨', '🎸', '🧁', '☕', '🌙'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function generate() {
    return { handle: pick(ADJECTIVES) + pick(NOUNS) + Math.floor(Math.random() * 90 + 10), emoji: pick(EMOJIS) };
  }
  function save(ident) { try { localStorage.setItem(KEY, JSON.stringify(ident)); } catch (e) { /* private mode: lives for the page only */ } }
  function load() {
    try { const i = JSON.parse(localStorage.getItem(KEY)); if (i && i.handle && i.emoji) return i; } catch (e) { /* fall through */ }
    return null;
  }

  window.ChatIdentity = {
    get() { let i = load(); if (!i) { i = generate(); save(i); } return i; },
    regenerate() { const i = generate(); save(i); return i; }
  };
})();
