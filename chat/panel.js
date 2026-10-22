// panel.js — the chat window: a small panel over the map with the room's
// name, the lines so far, and a box to type in. map.js opens it when you
// and someone else are visible in the same neighborhood, and the Chat button
// in the card opens and closes it by hand. The markup is in index.html.
(function () {
  const COPY = window.MAP_COPY;
  const $ = (id) => document.getElementById(id);
  let onSend = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const time = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  function submit() {
    const box = $('chatText');
    if (onSend && onSend(box.value)) box.value = '';
    box.focus();
  }

  window.ChatPanel = {
    init(sendHandler) {
      onSend = sendHandler;
      $('chatSend').textContent = COPY.chat.send;
      $('chatClose').title = COPY.chat.close;
      $('chatText').placeholder = COPY.chat.placeholder;
      $('chatText').maxLength = window.ChatEngine.maxText;
      $('chatSend').addEventListener('click', submit);
      $('chatText').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      $('chatClose').addEventListener('click', () => this.close());
    },
    open(roomName) {
      $('chatRoom').textContent = roomName;
      $('chatwin').hidden = false;
      $('chatText').focus();
    },
    close() { $('chatwin').hidden = true; },
    isOpen() { return !$('chatwin').hidden; },
    // a new room: empty the lines (nothing is kept between rooms)
    clear() { $('chatLines').innerHTML = ''; },
    // the people line under the room name
    setPeople(list) {
      $('chatPeople').textContent = list.map((p) => p.emoji + ' ' + p.handle).join(' · ');
    },
    addMessage(m) {
      const lines = $('chatLines');
      const li = document.createElement('li');
      if (m.self) li.className = 'is-self';
      li.innerHTML = `<span class="who">${esc(m.emoji)} ${esc(m.handle)}</span> <span class="when">${esc(time(m.t))}</span><br>${esc(m.text)}`;
      lines.appendChild(li);
      lines.scrollTop = lines.scrollHeight;
    }
  };
})();
