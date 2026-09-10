// Display name with the owner's case number in front: "3. Irene Cross",
// "5 & 6. Gracie Vance & Orange Washington". A stop with no number (the
// memorial) shows its plain name, or the fallback when it has no victim.
// Same rule as stopDisplayName in the app's tour-data.ts.
export function stopDisplayName(p, fallback) {
  const base = p.victim || fallback || p.title;
  const no = p.victim_no;
  if (no == null) return base;
  const label = Array.isArray(no) ? no.join(' & ') : String(no);
  return label + '. ' + base;
}
