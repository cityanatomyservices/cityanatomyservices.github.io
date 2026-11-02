/* Only the home map gets a Classifieds button. Other map layouts stay intact. */
(() => {
  const button=document.getElementById('ctrlClassifieds');if(!button)return;
  const panel=document.createElement('section');panel.id='classifieds-panel';panel.className='catalog-panel';panel.hidden=true;panel.setAttribute('aria-labelledby','classifieds-heading');
  panel.innerHTML='<div class="catalog-heading"><h2 id="classifieds-heading">Free classifieds</h2><button class="catalog-close" type="button" aria-label="Close classifieds">×</button></div><div class="classifieds-host"></div>';
  document.querySelector('.page').append(panel);
  const view=window.ClassifiedsUI.mount(panel.querySelector('.classifieds-host'),{active:()=>!panel.hidden});
  const close=panel.querySelector('.catalog-close');
  function show(on,focus=false){
    if(on)for(const name of ['AustinExplore','AustinCityHall','AustinDayPlan','AustinChatCard','AustinApps','AustinMapLayers'])window[name]?.close?.();
    panel.hidden=!on;button.setAttribute('aria-expanded',String(on));button.classList.toggle('is-on',on);
    if(on){close.focus({preventScroll:true});view.refresh();}
    else if(focus||panel.contains(document.activeElement))button.focus({preventScroll:true});
  }
  window.AustinClassifieds={close:()=>show(false)};
  button.onclick=()=>show(panel.hidden);close.onclick=()=>show(false,true);
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();show(false,true);}});
  document.getElementById('stack').addEventListener('click',event=>{const control=event.target.closest('button');if(control&&control!==button)show(false);},true);
})();
