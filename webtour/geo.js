// The browser's GPS: one running watch, one-shot fixes, and the screen
// wake lock. Everything that talks to navigator.geolocation lives here so
// the rest of the page only ever sees {latitude, longitude, accuracyM}.
//
// Browser rules worth knowing:
// - Geolocation only works on https (and on localhost while testing).
// - The permission prompt appears on the first request; if the visitor says
//   no, every later call fails with code 1 (PERMISSION_DENIED).
// - enableHighAccuracy is what makes a phone switch on real GPS instead of
//   guessing from wifi; a walking tour needs it.

const WATCH_OPTIONS = { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 };
const FIX_OPTIONS = { enableHighAccuracy: true, maximumAge: 15000, timeout: 15000 };

export const PERMISSION_DENIED = 1;

export function geolocationAvailable() {
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

function toReading(position) {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyM: position.coords.accuracy,
  };
}

// One position now. Resolves to a reading, rejects with the browser's
// GeolocationPositionError (its .code says why).
export function getFix() {
  return new Promise((resolve, reject) => {
    if (!geolocationAvailable()) {
      reject(new Error('no geolocation'));
      return;
    }
    navigator.geolocation.getCurrentPosition((pos) => resolve(toReading(pos)), reject, FIX_OPTIONS);
  });
}

// A continuous watch. onReading gets every fix; onError gets the first error
// after each start (the browser can repeat a timeout error every few seconds,
// which would otherwise flood the banner).
export function createWatch({ onReading, onError }) {
  let id = null;
  let reported = false;
  return {
    get running() { return id !== null; },
    start() {
      if (id !== null || !geolocationAvailable()) return;
      reported = false;
      id = navigator.geolocation.watchPosition(
        (pos) => onReading(toReading(pos)),
        (err) => {
          if (reported) return;
          reported = true;
          onError(err);
        },
        WATCH_OPTIONS
      );
    },
    stop() {
      if (id === null) return;
      navigator.geolocation.clearWatch(id);
      id = null;
    },
  };
}

// Keep the screen on while a tour is running, like the app does. Browsers
// release the lock whenever the tab is hidden, so the caller re-requests it
// on visibilitychange. Silently does nothing where the API is missing.
export function createWakeLock() {
  let lock = null;
  return {
    async acquire() {
      if (lock || !navigator.wakeLock) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } catch {
        lock = null; // low battery, or the tab is not visible
      }
    },
    async release() {
      if (!lock) return;
      try { await lock.release(); } catch { /* already released */ }
      lock = null;
    },
  };
}
