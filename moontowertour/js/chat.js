// chat.js — this tour is also a door into the austin.chat neighborhood chat
// (owner 2026-10-22: use one app, show up in the others). The engine files
// in /chat/ are loaded by app.html before this one; all this does is point
// the shared wiring (room.js) at the two buttons in the stack. Nothing is
// drawn on the tour map: the 👁 button makes you visible in the neighborhood
// your phone is in, the 💬 button opens its chat when someone else is there.
window.ChatRoom.load().then((geofences) => {
  window.ChatRoom.start(geofences, { ids: { visibleBtn: 'btn-visible', chatBtn: 'btn-chat' } });
});
