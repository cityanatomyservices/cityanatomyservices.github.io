import fs from 'node:fs/promises';
import { loadSports } from '../../ticker/sports.js';

// A published snapshot lets browsers that ESPN rejects still show dated scores.
let successful = 0;
const items = await loadSports(async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  successful++;
  return data;
});
if (!successful) throw new Error('All scoreboards failed; keeping previous snapshot');
const generated = new Date().toISOString();
const stamp = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).format(new Date());
for (const item of items) {
  // Never describe a scheduled snapshot as a continuously live score.
  item.title = item.title.replace('LIVE · ', `In progress as of ${stamp} CT · `);
  item.expires = new Date(Date.now() + 30 * 60e3).toISOString();
}
await fs.writeFile(new URL('../../ticker/scores.json', import.meta.url), JSON.stringify({ generated, items }, null, 2) + '\n');
console.log(`${items.length} Texas games from ${successful} responding scoreboards`);
