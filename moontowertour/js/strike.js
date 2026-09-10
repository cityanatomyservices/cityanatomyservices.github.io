// Moontower's signature effects, as plain data + timers: the pools of light
// around each tower, the carbon-arc strike when one is lit, and the gentle
// pulse on a tower you are approaching. Copied from the app's
// illumination.ts and strike-choreography.ts.

import { ringCoordinates } from '../../webtour/engine.js';

// Each tower cast light over a historic 1,500 ft (457.2 m) radius. The map
// draws that as three stacked geodesic rings per tower; the style's
// illumination-* layers pick the dim or glowing treatment from `lit`.
export const RING_RADII_M = [457.2, 304.8, 152.4];

export function buildIllumination(towers, isLit) {
  return {
    type: 'FeatureCollection',
    features: towers.flatMap((t) =>
      RING_RADII_M.map((radiusM, ring) => ({
        type: 'Feature',
        properties: { tower_id: t.properties.id, lit: isLit(t.properties.id), ring },
        geometry: { type: 'Polygon', coordinates: [ringCoordinates(t.geometry.coordinates, radiusM)] },
      }))
    ),
  };
}

// The strike. A carbon-arc lamp does not snap on: the rods touch (a hard
// spark), the arc sputters and dies back, catches, steadies, then warms to
// full output. Each frame: `at` ms after the strike starts, `core` 0..1 is
// the white-violet spark at the tower, `bloom` 0..1 the opacity of the
// growing pool, `radius` 0..1 the fraction of the full 1,500 ft it has
// reached. `haptic` is a buzz cue.
export const STRIKE_FRAMES = [
  { at: 0, core: 1.0, bloom: 0.0, radius: 0.0, haptic: 'strike' },
  { at: 90, core: 0.2, bloom: 0.05, radius: 0.1 },
  { at: 180, core: 0.9, bloom: 0.15, radius: 0.2, haptic: 'tick' },
  { at: 300, core: 0.35, bloom: 0.1, radius: 0.25 },
  { at: 430, core: 1.0, bloom: 0.3, radius: 0.4, haptic: 'tick' },
  { at: 600, core: 0.75, bloom: 0.5, radius: 0.6 },
  { at: 850, core: 0.9, bloom: 0.7, radius: 0.8 },
  { at: 1150, core: 1.0, bloom: 0.9, radius: 0.95 },
  { at: 1500, core: 1.0, bloom: 1.0, radius: 1.0, haptic: 'settle' },
];

// Hold the full-bloom frame briefly so the payoff lands before the style's
// permanent lit state takes over.
const STRIKE_HOLD_MS = 400;
export const STRIKE_TOTAL_MS = STRIKE_FRAMES[STRIKE_FRAMES.length - 1].at + STRIKE_HOLD_MS;

// Runs the whole strike on plain timers. Returns a cancel function that
// clears every pending timer (onComplete will not fire after cancel).
export function scheduleStrike({ onFrame, onHaptic, onComplete }) {
  const timers = STRIKE_FRAMES.map((frame) =>
    setTimeout(() => {
      if (onFrame) onFrame(frame);
      if (frame.haptic && onHaptic) onHaptic(frame.haptic);
    }, frame.at)
  );
  timers.push(setTimeout(onComplete, STRIKE_TOTAL_MS));
  return () => timers.forEach(clearTimeout);
}

// The phone's vibration, where the browser allows it (Android Chrome does,
// iOS Safari does not). Mirrors the app's expo-haptics cues.
export function buzz(cue) {
  if (!navigator.vibrate) return;
  const pattern = { strike: [40], tick: [12], settle: [20, 40, 20] }[cue];
  if (pattern) navigator.vibrate(pattern);
}

// The gentle pulse on a tower you are approaching (or standing at, before it
// lights): a slow breathe, nothing like the strike. Stepped through in a
// loop every NEARBY_PULSE_STEP_MS while any tower is nearby.
export const NEARBY_PULSE_FRAMES = [
  { glow: 0.12, radius: 10 },
  { glow: 0.22, radius: 13 },
  { glow: 0.38, radius: 16 },
  { glow: 0.3, radius: 17 },
  { glow: 0.18, radius: 13 },
];
export const NEARBY_PULSE_STEP_MS = 340;
