/**
 * The tour drives itself. Like the sibling site's lantern, nothing here waits
 * for the visitor: the camera flies tower to tower, striking each alight as it
 * arrives, and the city fills with light as it goes. Reaching the end, it goes
 * dark and begins again.
 *
 * The mouse cannot steer it, and on THIS page it cannot touch it at all: the
 * demo has no click handler, so nothing ever calls pin() or release() below.
 * They are left in place because this file is shared with the interactive web
 * app at /moontowertour/, where clicking a tower does pin it.
 */

const FLY_MS = 3000;      // flight time between towers - FIXED, see note below
const DWELL_MS = 7000;    // time parked on a tower before moving on
const PITCH = 50;         // degrees the camera leans in while parked on a tower
const TILT_MS = 1400;     // how long the lean-in takes once we have landed
const FLY_TIMEOUT_MS = FLY_MS + 4000; // safety net if 'moveend' never arrives
const RESET_MS = 3000;    // darkness at the end before the next round
const RELEASE_MS = 45000; // a pinned tower releases itself after this long

export function createTour({ map, features, lit, onArrive, onRedraw }) {
  // Follow the data's own chain: each stop names its next_stop_id. The head is
  // the stop nobody points to. If the chain is broken or short, whatever is
  // left is appended in leg/order so no tower is ever silently dropped.
  function sequence() {
    const byId = new Map(features.map((f) => [f.properties.id, f]));
    const pointedAt = new Set(features.map((f) => f.properties.next_stop_id).filter(Boolean));
    const head = features.find((f) => !pointedAt.has(f.properties.id)) || features[0];

    const chain = [];
    const seen = new Set();
    let cur = head;
    while (cur && !seen.has(cur.properties.id)) {
      seen.add(cur.properties.id);
      chain.push(cur);
      cur = byId.get(cur.properties.next_stop_id);
    }
    const rest = features
      .filter((f) => !seen.has(f.properties.id))
      .sort((a, b) =>
        a.properties.leg === b.properties.leg
          ? a.properties.order - b.properties.order
          : String(a.properties.leg).localeCompare(String(b.properties.leg))
      );
    return chain.concat(rest);
  }

  const order = sequence();
  let i = 0;
  let timer = null;
  let pinned = null;
  let releaseTimer = null;

  function step() {
    const f = order[i % order.length];

    // A full round finished: go dark, pause, start again.
    if (i > 0 && i % order.length === 0) {
      lit.clear();
      onRedraw();
      timer = setTimeout(step, RESET_MS);
      i++;
      return;
    }

    // Give the flight an explicit duration rather than a `speed`. With `speed`,
    // MapLibre scales flight time to distance, so hops across town crawled -
    // the whole 17-tower round took ~10 minutes. A fixed duration keeps every
    // tower to the same beat regardless of how far apart they are.
    //
    // Travel flat, arrive tilted: pitch 0 on the way OUT stands the camera back
    // up over the flight, so the lean belongs to the tower we are visiting and
    // never to the empty city in between.
    map.flyTo({
      center: f.geometry.coordinates,
      zoom: 15.4,
      pitch: 0,
      duration: FLY_MS,
      curve: 1.4,
      essential: true,
    });

    // Strike it alight ON ARRIVAL. Listen for the map's own 'moveend' rather
    // than guessing a duration — flight length varies with distance, and a
    // fixed timer lit towers while the camera was still travelling.
    let landed = false;
    const arrive = () => {
      if (landed || pinned) return;
      landed = true;
      clearTimeout(safety);
      // Lean in as the lamp is struck. The tilt runs longer than the strike is
      // instant, so the light comes up while the camera is still settling —
      // the tower rises out of the map instead of sitting flat on it.
      map.easeTo({ pitch: PITCH, duration: TILT_MS, essential: true });
      lit.add(f.properties.id);
      onRedraw();
      onArrive(f);
      timer = setTimeout(step, DWELL_MS);   // dwell starts once we are actually there
    };
    const safety = setTimeout(arrive, FLY_TIMEOUT_MS);
    map.once('moveend', arrive);

    i++;
  }

  return {
    start() {
      step();
    },
    stop() {
      clearTimeout(timer);
      clearTimeout(releaseTimer);
    },
    isPinned() {
      return Boolean(pinned);
    },
    /** Click a tower: hold here until released. */
    pin(feature) {
      clearTimeout(timer);
      clearTimeout(releaseTimer);
      pinned = feature;
      lit.add(feature.properties.id);
      onRedraw();
      onArrive(feature);
      map.flyTo({
        center: feature.geometry.coordinates,
        zoom: 15.8,
        pitch: PITCH,          // held towers stay leaned in, same as visited ones
        duration: FLY_MS,
        essential: true,
      });
      releaseTimer = setTimeout(() => this.release(), RELEASE_MS);
    },
    /** Click empty map (or time out): the tour resumes its rounds. */
    release() {
      if (!pinned) return;
      pinned = null;
      clearTimeout(releaseTimer);
      timer = setTimeout(step, 400);
    },
  };
}
