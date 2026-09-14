// timelines.js — one timeline per topic in the dropdown (owner 2026-09-14:
// "a separate timeline for each of the topics").
//
// Each entry is a function that returns the step list for that topic. The
// player (../topicmap/player.js) explains the step keys at its top; the keys
// this page adds, read by app.js:
//   camera   'austin' fits the whole city; 'downtown' zooms to the centre
//   pitch    0 or 55, the 3D tilt
//   months   true plays the permits month slider through the step
//   show / hide  the Layers box keys: 'zip', 'council'
//
// SKELETON (Claude, 2026-09-14): every topic gets its explanation from
// explain.js as two text cards (what the map shows, how it is calculated)
// so the mechanism can be seen working. The owner decides what each topic's
// story should actually walk through; the cards' words are the About text,
// not new copy.
window.BUDGET_TIMELINES = (function () {
  const common = (key, copy, explain) => {
    const words = copy.player;
    const t = explain.themes[key] || {};
    return [
      { title: words.ready },
      { title: copy.themes[key].name, text: t.what || '', camera: 'austin', cards: { legend: false } },
      { title: words.how, text: t.how || '' }
    ];
  };
  const done = (copy) => ({ title: copy.player.done, done: true });
  return {
    value:     (copy, explain) => [...common('value', copy, explain), { title: copy.player.closeUp, text: copy.player.closeUpText, camera: 'downtown' }, done(copy)],
    bill:      (copy, explain) => [...common('bill', copy, explain), { title: copy.player.closeUp, text: copy.player.closeUpText, camera: 'downtown' }, done(copy)],
    drainage:  (copy, explain) => [...common('drainage', copy, explain), { title: copy.player.closeUp, text: copy.player.closeUpText, camera: 'downtown' }, done(copy)],
    permits:   (copy, explain) => [...common('permits', copy, explain), { title: copy.player.byMonth, text: copy.player.byMonthText, months: true, hold: 20000 }, done(copy)],
    cip:       (copy, explain) => [...common('cip', copy, explain), { title: copy.player.byDistrict, text: copy.player.byDistrictText, show: ['council'] }, done(copy)],
    flood:     (copy, explain) => [...common('flood', copy, explain), done(copy)],
    landmarks: (copy, explain) => [...common('landmarks', copy, explain), { title: copy.player.closeUp, text: copy.player.closeUpText, camera: 'downtown' }, done(copy)]
  };
})();
