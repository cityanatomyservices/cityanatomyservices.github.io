// Small text helpers shared by the tour web apps.

// The stop text is prose, not markup. Escape it so an ampersand or an angle
// bracket in the owner's writing can never break the page.
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// "1885-12-24" -> "December 24, 1885".
//
// Deliberately does NOT use Date: parsing a bare YYYY-MM-DD gives UTC midnight,
// which shows as the PREVIOUS day anywhere west of Greenwich, Austin included.
// These are the dates people were killed; a day out is not acceptable, so the
// string is split by hand. Anything unparseable comes back as-is.
export function formatDate(iso) {
  const [year, month, day] = String(iso).split('-').map(Number);
  const name = MONTHS[(month || 1) - 1];
  if (!year || !name || !day) return iso;
  return name + ' ' + day + ', ' + year;
}
