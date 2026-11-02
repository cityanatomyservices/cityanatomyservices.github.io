(() => {
  const category=document.documentElement.dataset.classifiedsCategory||null;
  window.ClassifiedsUI.mount(document.getElementById('classifieds-host'),{category});
})();
