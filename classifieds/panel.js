/* The home map hosts Classifieds inside Explore; standalone pages still work. */
window.AustinClassifieds = {
  init() {
    Object.assign(window.AustinClassifieds, window.AustinExplore.addSection({
      id: 'classifieds', buttonId: 'ctrlClassifieds', title: 'Classifieds',
      icon: '<path d="M4 3h16v18H4Z M8 7h8 M8 11h8 M8 15h5 M8 18h3"/>',
      mount(panel, { time, active }) {
        panel.setAttribute('aria-labelledby', 'classifieds-heading');
        panel.innerHTML = '<h3 id="classifieds-heading">Free classifieds</h3><div class="classifieds-host"></div>';
        const view = window.ClassifiedsUI.mount(panel.querySelector('.classifieds-host'), { active, browse: true, time });
        const timer = setInterval(() => { if (active()) view.refresh(); }, 60000);
        window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
        return { refresh: view.refresh, setTime: view.setTime };
      }
    }));
  }
};
