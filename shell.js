// shell.js — THE FRAME AROUND EVERY PAGE (owner, 2026-10-22: "keep it looking
// exactly the same as the homepage except what is in the center").
//
// A page is a small HTML file holding only its centre (<main>). This script,
// loaded at the end of <body>, draws the same header above it and the same
// social footer below it, so the frame lives in ONE place and every page
// stays identical. It also mounts account controls and runs the day/night
// button. Nothing here is page-specific; the home page adds home.js for its
// map window.
//
// All map pages use the same Apps and Media menus (chat/catalog-menu.js).
// The account flow lives separately in shared/account.js.
(function () {
  // ── day / night, before anything paints ──────────────────────────────────
  // Day is the default (owner, 2026-09-10); night is remembered once chosen.
  const stored = localStorage.getItem('theme');
  document.documentElement.dataset.theme = stored === 'dark' ? 'dark' : 'light';

  // ── the header ───────────────────────────────────────────────────────────
  document.body.insertAdjacentHTML('afterbegin', `
  <header id="top" class="topbar topbar-home">
    <div class="topbar-left">
      <button class="sign-in-button" type="button" aria-haspopup="dialog" aria-controls="account-dialog" aria-expanded="false" disabled>Sign In</button>
    </div>
    <a class="brand brand-center" href="/">Austin.Chat</a>
    <div class="topbar-right">
      <button class="theme-toggle" type="button" aria-label="Toggle color scheme">
        <span class="toggle-icon">☀️</span>
        <span class="toggle-label">Light</span>
      </button>
    </div>
  </header>`);

  // ── the footer ───────────────────────────────────────────────────────────
  document.body.insertAdjacentHTML('beforeend', `
  <footer class="page-footer home-footer">
    <div class="social-icons">
      <a href="https://www.youtube.com/@AustinLive1885" aria-label="YouTube" rel="me noopener" target="_blank"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg></a>
      <a href="https://www.tiktok.com/@anatomy.city" aria-label="TikTok" rel="me noopener" target="_blank"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 2h3.1c.2 1.9 1.4 3.5 3.1 4.2.7.3 1.5.5 2.3.5v3.1c-1.9 0-3.7-.6-5.2-1.6v7.3c0 3.6-2.9 6.5-6.5 6.5S2.8 19.1 2.8 15.5 5.7 9 9.3 9c.4 0 .7 0 1.1.1v3.3c-.3-.1-.7-.2-1.1-.2-1.8 0-3.3 1.5-3.3 3.3s1.5 3.3 3.3 3.3 3.3-1.5 3.3-3.3L12.5 2z"/></svg></a>
      <a href="https://x.com/anatomycity" aria-label="X" rel="me noopener" target="_blank"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2.25h3.5l-7.7 8.8L23 21.75h-7.1l-5.5-7.2-6.3 7.2H.6l8.2-9.4L.4 2.25H7.7l5 6.6 5.5-6.6zm-1.2 17.5h2L7.1 4.3H5L17 19.75z"/></svg></a>
      <a href="https://cityanatomy.substack.com" aria-label="Substack" rel="me noopener" target="_blank"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 3H2v2.4h20V3zm0 4.6H2V10h20V7.6zM2 12.2V21l10-5.6L22 21v-8.8H2z"/></svg></a>
      <a href="https://www.patreon.com/cityanatomy" aria-label="Patreon" rel="me noopener" target="_blank"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.4.5a8.1 8.1 0 1 0 0 16.2 8.1 8.1 0 0 0 0-16.2zM.5.5h3.8v23H.5z"/></svg></a>
    </div>
  </footer>`);

  // Compact Austin updates live in the shared frame, above the social footer.
  const tickerStyle = document.createElement('link');
  tickerStyle.rel = 'stylesheet';
  tickerStyle.href = '/ticker/ticker.css?v=20261028f';
  document.head.append(tickerStyle);
  const ticker = document.createElement('aside');
  ticker.id = 'austin-ticker';
  ticker.className = 'austin-ticker';
  ticker.setAttribute('aria-label', 'Austin news, weather and events');
  document.querySelector('.home-footer').before(ticker);
  const tickerScript = document.createElement('script');
  tickerScript.src = '/ticker/ticker.js?v=20261030c';
  document.body.append(tickerScript);

  // ── the day / night button ───────────────────────────────────────────────
  // It says WHERE A CLICK TAKES YOU, not where you are (owner, 2026-09-10).
  const themeToggle = document.querySelector('.theme-toggle');
  const toggleIcon = themeToggle.querySelector('.toggle-icon');
  const toggleLabel = themeToggle.querySelector('.toggle-label');
  function showOffer(theme) {
    const offering = theme === 'dark' ? 'light' : 'dark';
    toggleIcon.textContent = offering === 'dark' ? '🌙' : '☀️';
    toggleLabel.textContent = offering === 'dark' ? 'Dark' : 'Light';
  }
  showOffer(document.documentElement.dataset.theme);
  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    window.AustinPreferences?.set('theme',next);
    showOffer(next);
  });
  window.addEventListener('storage',event=>{if(event.key==='theme'){const theme=event.newValue==='dark'?'dark':'light';document.documentElement.dataset.theme=theme;showOffer(theme);}});

  const accountStyle=document.createElement('link');accountStyle.rel='stylesheet';accountStyle.href='/shared/account.css?v=20261030c';document.head.append(accountStyle);
  const memberScript=document.createElement('script');memberScript.src='/shared/member-ui.js?v=20261030d';
  memberScript.onload=()=>{const accountScript=document.createElement('script');accountScript.src='/shared/account.js?v=20261030c';document.body.append(accountScript);};
  document.body.append(memberScript);

}());
