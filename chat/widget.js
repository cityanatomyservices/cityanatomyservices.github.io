/* Optional, reusable chat entry point for applications that do not own a chat
   map. Lazy loading keeps itinerary/storage entirely independent. It uses the
   same existing ChatRoom / ChatEngine / ChatPanel and physical neighborhood.
   No selected itinerary stop is ever used as the visitor's location. */
(() => {
  let loading;
  async function script(path) {
    await new Promise((resolve,reject) => { const s = document.createElement('script'); s.src=path; s.onload=resolve; s.onerror=reject; document.head.append(s); });
  }
  async function mount(host) {
    host.innerHTML = `<section class="planner-chat-card" aria-label="Neighborhood chat">
      <button type="button" id="widgetClose" style="float:right" aria-label="Close neighborhood chat">×</button>
      <h2 style="font-size:16px;margin-bottom:10px">Neighborhood chat</h2><p id="youHandle"></p><button id="newName" type="button">New name</button>
      <p id="roomLine"></p><p id="peopleLine"></p><div class="chat-btns"><button id="visibleBtn" type="button"></button><button id="chatBtn" type="button" disabled>Chat</button></div>
      <p>Your current neighborhood is shared with the other Austin.chat apps. Planning a visit doesn’t move your chat location.</p>
      <section class="chatwin" id="chatwin" hidden aria-label="Chat"><div class="chat-head"><h2 id="chatRoom"></h2><button id="chatClose" type="button" aria-label="Close">×</button></div>
      <div class="chat-people" id="chatPeople"></div><ul class="chat-lines" id="chatLines"></ul><div class="chat-form"><input id="chatText" autocomplete="off" type="text"><button id="chatSend" type="button"></button></div></section>
    </section>`;
    host.querySelector('#widgetClose').onclick = () => window.AustinChatCard.close();
    for (const [file,version] of [['copy','20261028i'],['config','20261029a'],['auth','20261030c'],['locate','20261028i'],['chat','20261029u'],['panel','20261030c'],['room','20261030c']]) await script(`/chat/${file}.js?v=${version}`);
    // Absolute data URL: the widget can be embedded at any depth in the site.
    const response = await fetch('/chat/data/geofences.geojson'); if (!response.ok) throw new Error('Neighborhoods unavailable');
    await window.ChatRoom.start(await response.json());
  }
  window.AustinChatWidget = { mount };
  const button = document.getElementById('ctrlChat') || document.getElementById('chat-launch'), host = document.getElementById('planner-chat-host');
  if (button && host) {
    function close(){host.hidden=true;window.ChatPanel?.close();button.setAttribute('aria-expanded','false');button.classList.remove('is-on');if(host.contains(document.activeElement))button.focus({preventScroll:true});}
    window.AustinChatCard={close};
    host.addEventListener('keydown',event=>{if(event.key==='Escape')close();});
    button.addEventListener('click', async () => {
      if(!host.hidden){close();return;}
      for(const menu of ['AustinApps','AustinMedia','AustinDayPlan','AustinExplore'])window[menu]?.close?.();
      host.hidden = false;button.setAttribute('aria-expanded','true');button.classList.add('is-on');
      if (!loading) loading = mount(host).catch(() => { loading = null; host.replaceChildren(); const p=document.createElement('p'); p.className='planner-chat-card'; p.textContent='Chat is unavailable. Your itinerary still works. Try opening chat again.'; host.append(p); });
      await loading;
    });
  }
})();
