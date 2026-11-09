// panel.js — the chat window: a small panel over the map with the room's
// name, the lines so far, and a box to type in. map.js opens it when you
// and someone else are visible in the same neighborhood, and the Chat button
// in the card opens and closes it by hand. The markup is in index.html.
(function () {
  const COPY = window.MAP_COPY;
  const $ = (id) => document.getElementById(id);
  let onSend = null;
  let sending = false, generation = 0;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const time = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  async function submit() {
    const box = $('chatText');
    if (!onSend || sending || !box.value.trim()) return;
    const text = box.value, attempt = generation;
    sending = true; $('chatSend').disabled = true; box.setCustomValidity('');
    let sent = false;
    try { sent = await onSend(text); } catch (_) {}
    if (attempt !== generation) return;
    sending = false; $('chatSend').disabled = false;
    if (sent && box.value === text) box.value = '';
    if (!sent) box.setCustomValidity('Message not sent. Please try again when chat is available.');
    if (!$('chatwin').hidden) { box.focus(); if (!sent) box.reportValidity(); }
  }

  window.ChatPanel = {
    init(sendHandler) {
      onSend = sendHandler;
      $('chatSend').textContent = COPY.chat.send;
      $('chatClose').title = COPY.chat.close;
      $('chatText').placeholder = COPY.chat.placeholder;
      $('chatText').maxLength = window.ChatEngine.maxText;
      $('chatText').addEventListener('input', () => $('chatText').setCustomValidity(''));
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
    clear() {
      generation++; sending = false; $('chatSend').disabled = false;
      $('chatLines').innerHTML = ''; $('chatText').value = ''; $('chatText').setCustomValidity('');
    },
    // the people line under the room name
    setPeople(list) {
      const line=$('chatPeople');line.replaceChildren();
      list.forEach((p,i)=>{if(i)line.append(' · ');const person=document.createElement('span');line.append(person);window.AustinMember.paintIdentity(person,p);});
    },
    addMessage(m) {
      const lines = $('chatLines');
      const li = document.createElement('li');
      if (m.self) li.className = 'is-self';
      li.innerHTML = `<span class="who">${esc(m.emoji)} ${esc(m.handle)}</span> <span class="when">${esc(time(m.t))}</span><br>${esc(m.text)}`;
      lines.appendChild(li);
      window.AustinMember.paintIdentity(li.querySelector('.who'),m);
      lines.scrollTop = lines.scrollHeight;
    }
  };
})();
