// Walked-distance meter: a plain-JS copy of the app's src/lib/distance-tracker.ts.
//
// Feed it GPS readings; it adds up the distance walked while throwing out the
// noise. Every function returns a NEW session object and never changes the
// one passed in, so the caller just keeps the latest one.
//
// Filters (tuned for walking a city):
// - steps shorter than 3 m are GPS jitter: ignored, the anchor is kept, so
//   slow real movement still counts once it crosses the threshold;
// - readings with accuracy worse than 50 m are dropped entirely;
// - a single step longer than 200 m is a teleport (GPS re-acquired, a tunnel):
//   nothing is added and the anchor resets to the next good reading.
// On any pause, call clearLastReading so pause -> resume never counts as a walk.

import { haversineMeters } from './engine.js';

const FILTERS = { minStepM: 3, maxAccuracyM: 50, maxStepM: 200 };

export function createDistanceSession() {
  return { totalMeters: 0, lastReading: null };
}

// reading = {latitude, longitude, accuracyM}
export function advanceDistance(session, reading) {
  if (reading.accuracyM != null && reading.accuracyM > FILTERS.maxAccuracyM) return session;
  if (session.lastReading === null) return { ...session, lastReading: reading };
  const step = haversineMeters(session.lastReading, reading);
  if (step > FILTERS.maxStepM) return { ...session, lastReading: null };
  if (step < FILTERS.minStepM) return session;
  return { totalMeters: session.totalMeters + step, lastReading: reading };
}

export function resetDistanceSession() {
  return createDistanceSession();
}

export function clearLastReading(session) {
  return session.lastReading === null ? session : { ...session, lastReading: null };
}

const METERS_PER_MILE = 1609.344;

// "0.42 mi": two decimals under ten miles, one from ten up.
export function formatMiles(meters) {
  const miles = meters / METERS_PER_MILE;
  return miles.toFixed(miles < 10 ? 2 : 1) + ' mi';
}
