// A saved list of stop ids: which stops are done (visited, lit, ...).
//
// Saved in the browser's localStorage under the key the app gives it, so
// progress survives a reload and a closed tab on the same phone (the phone
// app does the same with AsyncStorage). Only the list is saved; the open
// card and the location permission are per session, exactly as in the app.
//
// Each tour passes its own key so two tours can never share progress.

export function createStore(key) {
  const listeners = [];
  let ids = load();

  function load() {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed && parsed.ids) ? parsed.ids : [];
    } catch {
      return []; // private mode, blocked storage, or a corrupt value
    }
  }

  function save() {
    try {
      localStorage.setItem(key, JSON.stringify({ ids }));
    } catch {
      // Storage refused (private mode): progress still works for this visit.
    }
  }

  function notify() {
    for (const fn of listeners) fn();
  }

  return {
    // The ids, in the order they were added.
    get doneIds() { return ids; },
    isDone(id) { return ids.includes(id); },
    // Done is terminal: an id is added once and never fires again.
    markDone(id) {
      if (ids.includes(id)) return;
      ids = [...ids, id];
      save();
      notify();
    },
    reset() {
      ids = [];
      save();
      notify();
    },
    // Called after every change; the page re-draws the map and chip from it.
    onChange(fn) { listeners.push(fn); },
  };
}
