// identity.js — ephemeral random handle + emoji avatar for pubchat.
// Cached in sessionStorage so it persists across page refreshes but is wiped
// when the tab closes. Nothing is ever written to localStorage or cookies.

(function () {
  const STORAGE_KEY = 'pubchat:identity';

  const ADJECTIVES = [
    'Sparky', 'Breezy', 'Mellow', 'Sunny', 'Jazzy', 'Plucky', 'Dreamy', 'Zesty',
    'Peachy', 'Frosty', 'Cosmic', 'Glowy', 'Cheery', 'Snazzy', 'Bouncy', 'Twinkly',
    'Mossy', 'Giddy', 'Nimble', 'Wonky', 'Fuzzy', 'Velvet', 'Salty', 'Lucky',
    'Nifty', 'Crispy', 'Drifty', 'Lively', 'Jolly', 'Zippy',
  ];

  const NOUNS = [
    'Otter', 'Robin', 'Comet', 'Peach', 'Maple', 'Pebble', 'Lantern', 'Moth',
    'Biscuit', 'Harbor', 'Thistle', 'Fern', 'Waffle', 'Sparrow', 'Cactus', 'Cloud',
    'Pine', 'Puddle', 'River', 'Marble', 'Teacup', 'Piano', 'Daisy', 'Fox',
    'Gecko', 'Mango', 'Lark', 'Kite', 'Honey', 'Bean',
  ];

  const EMOJIS = [
    '🦊', '🦉', '🦄', '🐙', '🦀', '🐢', '🐬', '🦋',
    '🌻', '🌈', '🌵', '🍄', '🍋', '🍉', '🍑', '🫐',
    '🧃', '🪐', '⭐', '🎈', '🎨', '🎸', '🧁', '☕',
  ];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generate() {
    const handle = `${pick(ADJECTIVES)}${pick(NOUNS)}${Math.floor(Math.random() * 90 + 10)}`;
    const emoji = pick(EMOJIS);
    return { handle, emoji };
  }

  function load() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.handle && parsed?.emoji) return parsed;
    } catch (e) { /* ignore */ }
    return null;
  }

  function save(ident) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(ident));
    } catch (e) { /* ignore */ }
  }

  function getIdentity() {
    let ident = load();
    if (!ident) {
      ident = generate();
      save(ident);
    }
    return ident;
  }

  function regenerate() {
    const ident = generate();
    save(ident);
    window.dispatchEvent(new CustomEvent('pubchat:identity-changed', { detail: ident }));
    return ident;
  }

  window.PubchatIdentity = { getIdentity, regenerate };
})();
