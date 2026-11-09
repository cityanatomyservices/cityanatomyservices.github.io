window.AustinSpecialEvents={init(){
  window.AustinExplore.addSection({id:'special-events',buttonId:'ctrlSpecialEvents',title:'Special Events',icon:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',mount(host){
    let loaded=false;
    async function refresh(){
      host.textContent='Loading special event maps…';
      try{const response=await fetch('/home.json?v=20261109d');if(!response.ok)throw Error();const home=await response.json();
        const cards=home.chips.flatMap(c=>c.cards||[]).filter(c=>c.category==='Special Events'&&(!c.expiresAt||Date.parse(c.expiresAt)>Date.now()));window.AustinVisit?.set('special-events:pages',cards.map(c=>({id:c.eventId,title:c.title,page:`/maps/${c.slug}/`,expiresAt:c.expiresAt})));host.replaceChildren();
        const heading=document.createElement('h3');heading.textContent='Special Events';host.append(heading);if(!cards.length){const empty=document.createElement('p');empty.textContent='No upcoming Special Events maps right now.';host.append(empty);}
        for(const card of cards){const link=document.createElement('a');link.className='special-event-link';link.href=`/maps/${card.slug}/`;link.target='_top';const title=document.createElement('strong');title.textContent=card.title+' →';const description=document.createElement('span');description.textContent=card.blurb;link.append(title,description);host.append(link);}loaded=true;
      }catch(_){host.textContent='Could not load event maps. Close and reopen this card to retry.';}
    }
    return {refresh};
  }});
}};
