/* Old QR codes stay understandable after Pages omits the expired event files. */
if(/^\/maps\/austin-studio-tour(?:\/|$)/.test(location.pathname)&&Date.now()>=Date.parse('2026-11-24T22:00:00-06:00')){
  document.title='Studio Tour ended · Austin.Chat';
  document.getElementById('title').textContent='This Studio Tour has ended';
  document.getElementById('message').textContent='Its temporary studio chat pages are now closed. You can still explore Austin.Chat.';
}
