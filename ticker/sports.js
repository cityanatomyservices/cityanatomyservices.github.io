// ESPN's public scoreboard endpoints are keyless, but not a contracted API.
// Keep attribution, link each game, and expire unrefreshed live scores quickly.
const COLLEGES = new Set([
  'Texas', 'Texas A&M', 'Texas Tech', 'Baylor', 'TCU', 'Houston', 'SMU', 'Rice',
  'UTSA', 'Texas State', 'North Texas', 'UTEP', 'Sam Houston', 'Sam Houston State',
  'Stephen F. Austin', 'Abilene Christian', 'Lamar', 'Tarleton State',
  'Incarnate Word', 'Houston Christian', 'Houston Baptist', 'Texas Southern',
  'Prairie View A&M', 'Texas A&M-Corpus Christi', 'Texas A&M-CC',
  'UT Arlington', 'UT Rio Grande Valley', 'UTRGV', 'East Texas A&M', 'Texas A&M-Commerce',
]);
const LEAGUES = [
  { name: 'NFL', path: 'football/nfl' },
  { name: 'NBA', path: 'basketball/nba' },
  { name: 'WNBA', path: 'basketball/wnba' },
  { name: 'MLB', path: 'baseball/mlb' },
  { name: 'NHL', path: 'hockey/nhl' },
  { name: 'MLS', path: 'soccer/usa.1' },
  { name: 'NWSL', path: 'soccer/usa.nwsl' },
  { name: 'College football', path: 'football/college-football', group: '80', college: true },
  { name: 'FCS football', path: 'football/college-football', group: '81', college: true },
  { name: 'College men’s basketball', path: 'basketball/mens-college-basketball', group: '50', college: true },
  { name: 'College women’s basketball', path: 'basketball/womens-college-basketball', group: '50', college: true },
  { name: 'College baseball', path: 'baseball/college-baseball', group: '50', college: true },
];
export function texasTeam(team, college = false) {
  if (college) return COLLEGES.has(team?.location);
  return /\b(Dallas|Houston|San Antonio|Austin FC|Texas Rangers)\b/.test(team?.displayName || '');
}
export function parseScoreboard(data, league, now = Date.now()) {
  const result = [];
  for (const event of data.events || []) {
    const competition = event.competitions?.[0];
    const teams = competition?.competitors || [];
    if (teams.length !== 2 || !teams.some(c => texasTeam(c.team, league.college))) continue;
    const gameTime = Date.parse(event.date);
    if (!Number.isFinite(gameTime) || gameTime < now - 3 * 86400e3 || gameTime > now + 7 * 86400e3) continue;
    const status = competition.status?.type || event.status?.type;
    if (!status) continue;
    const away = teams.find(c => c.homeAway === 'away') || teams[0];
    const home = teams.find(c => c.homeAway === 'home') || teams[1];
    const name = c => c.team.shortDisplayName || c.team.displayName;
    const score = c => c.score == null ? '—' : String(c.score);
    const isLive = status.state === 'in';
    const isFinal = status.completed === true;
    const description = status.shortDetail || status.description || '';
    const gameDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(gameTime);
    const specialStatus = status.description && status.description !== 'Scheduled' ? status.description + ' · ' : '';
    const label = isLive ? `LIVE · ${description}` : isFinal ? `Final · ${gameDate} CT` : `${specialStatus}${gameDate} CT`;
    const matchup = isLive || isFinal ? `${name(away)} ${score(away)} – ${name(home)} ${score(home)}` : `${name(away)} at ${name(home)}`;
    const url = event.links?.find(link => link.rel?.includes('event'))?.href || event.links?.[0]?.href;
    if (!url || !/^https:\/\//.test(url)) continue;
    const checked = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit' }).format(now);
    result.push({ category: 'sports', title: `${matchup} · ${label}`, source: `ESPN · ${league.name} · checked ${checked} CT`,
      url, expires: new Date(now + (isLive ? 3 * 60e3 : 20 * 60e3)).toISOString(),
      gameId: event.id, gameTime, checkedAt: new Date(now).toISOString(), priority: isLive ? 0 : isFinal ? 1 : 2 });
  }
  return result;
}
let yesterdayItems = [], yesterdayChecked = 0;
export async function loadSports(getJSON, previous = []) {
  const now = Date.now();
  const jobs = LEAGUES.map(league => ({ league, url: `https://site.api.espn.com/apis/site/v2/sports/${league.path}/scoreboard?limit=1000${league.group ? '&groups=' + league.group : ''}` }));
  // The default boards show today's games (or this week's football). Include
  // yesterday's finals, but don't refetch completed boards every minute.
  const updateYesterday = now - yesterdayChecked > 15 * 60e3;
  if (updateYesterday) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now - 86400e3);
    const day = ['year', 'month', 'day'].map(type => parts.find(p => p.type === type).value).join('');
    for (const league of LEAGUES) jobs.push({ league, yesterday: true, url: `https://site.api.espn.com/apis/site/v2/sports/${league.path}/scoreboard?dates=${day}&limit=1000${league.group ? '&groups=' + league.group : ''}` });
  }
  const results = await Promise.allSettled(jobs.map(async job => ({ job, items: parseScoreboard(await getJSON(job.url), job.league, now) })));
  const current = [], past = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i], job = jobs[i];
    const destination = job.yesterday ? past : current;
    if (result.status === 'fulfilled') destination.push(...result.value.items);
    else destination.push(...previous.filter(item => item.source.includes(`· ${job.league.name} ·`) && Date.parse(item.expires) > now));
  }
  if (updateYesterday) { yesterdayItems = past; yesterdayChecked = past.some(item => item.priority === 0) ? 0 : now; }
  // Prefer today's newly fetched status over yesterday's cached in-progress game.
  const unique = new Map();
  for (const item of [...yesterdayItems, ...current]) if (Date.parse(item.expires) > now) unique.set(item.gameId, item);
  return [...unique.values()].sort((a, b) => a.priority - b.priority || (a.priority === 1 ? b.gameTime - a.gameTime : a.gameTime - b.gameTime)).slice(0, 24);
}
