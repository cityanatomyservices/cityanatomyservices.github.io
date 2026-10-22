// shell.js — THE FRAME AROUND EVERY PAGE (owner, 2026-10-22: "keep it looking
// exactly the same as the homepage except what is in the center").
//
// A page is a small HTML file holding only its centre (<main>). This script,
// loaded at the end of <body>, draws the same header above it and the same
// social footer below it, so the frame lives in ONE place and every page
// stays identical. It also builds the hamburger menu and runs the day/night
// button. Nothing here is page-specific; the home page adds home.js for its
// map window.
//
// THE MENU IS FOUR LINKS (owner, 2026-10-22, replacing the fold-out
// sections): Apps goes to the directory page at /apps/, Maps to /maps/,
// Content to /content/, Contact to /contact/. The directory pages list
// everything in their folder (list.js); every app and map has its own
// framed page at /apps/<slug>/ or /maps/<slug>/ (view.js), a shareable,
// QR-code friendly address. Nothing here reads home.json any more.
(function () {
  // ── day / night, before anything paints ──────────────────────────────────
  // Day is the default (owner, 2026-09-10); night is remembered once chosen.
  const stored = localStorage.getItem('theme');
  document.documentElement.dataset.theme = stored === 'dark' ? 'dark' : 'light';

  // ── the header ───────────────────────────────────────────────────────────
  document.body.insertAdjacentHTML('afterbegin', `
  <header id="top" class="topbar topbar-home">
    <div class="topbar-left">
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="Open menu">
        <span class="nav-toggle-bar"></span>
      </button>
    </div>
    <a class="brand brand-center" href="/">Austin.Chat</a>
    <div class="topbar-right">
      <button class="theme-toggle" type="button" aria-label="Toggle color scheme">
        <span class="toggle-icon">☀️</span>
        <span class="toggle-label">Light</span>
      </button>
    </div>

    <nav id="site-menu" class="site-menu" hidden aria-label="Site menu">
      <a class="menu-link" href="/apps/">Apps</a>
      <a class="menu-link" href="/maps/">Maps</a>
      <a class="menu-link" href="/content/">Content</a>
      <a class="menu-link" href="/contact/">Contact</a>
    </nav>
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
    showOffer(next);
  });

  // ── open / close the menu ────────────────────────────────────────────────
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.getElementById('site-menu');
  function setOpen(open) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }
  toggle.addEventListener('click', () => setOpen(menu.hidden));
  // A click anywhere outside the menu, or Escape, closes it.
  document.addEventListener('click', (e) => {
    if (menu.hidden) return;
    if (menu.contains(e.target) || toggle.contains(e.target)) return;
    setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) setOpen(false);
  });
}());
