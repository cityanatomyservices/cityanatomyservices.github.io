// Two readings of a tower's `status` text, copied from the app's tour-data.ts.

// The short form for the card: everything before the first ";" or "(".
export function statusSummary(status) {
  const short = String(status).split(/[;(]/)[0].trim();
  return short || status;
}

// A status that starts with "removed" means no tower stands there today.
export function isStanding(status) {
  return !/^removed/i.test(String(status).trim());
}
