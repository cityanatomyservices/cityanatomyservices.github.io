/* Shared by card controls and the server. Opening hours and all-day listings
   are deliberately not event start times. Never accept card text from a client. */
export const HOUR = 3600000;
export const FEEDS = ['free-cheap','movies','live-music','live-comedy','pop-up-markets','events-festivals'];
export const instant = value => typeof value === 'string' && /T.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const text = (value, max = 2000) => String(value || '').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').slice(0,max).trim();
const url = value => { try { const u=new URL(value); return ['https:','http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
export const eventKey = (provider,id,start) => `${provider}:${id}:${instant(start)}`;
export function occurrences(provider, data) {
  const p=provider==='explore' ? data?.properties : data;
  if (!p || !['explore','city-hall'].includes(provider) || !p.id || p.cancelled) return [];
  if (provider==='explore' && (!['event','listing','movie'].includes(p.kind) || p.allDay || p.dateOnly)) return [];
  if (provider==='city-hall' && (p.category!=='meetings' || p.dateOnly)) return [];
  const shows=p.kind==='movie' ? p.showtimes || [] : [{start:provider==='city-hall'?p.date:p.start,url:p.url}];
  const unique=new Map();
  for (const show of shows) {
    const start=instant(show.start), href=url(show.url || p.url);
    if (!start || !href || !p.title) continue;
    const event={provider,id:text(p.id,200),start,key:eventKey(provider,p.id,start),title:text(p.title,300),
      venue:text(p.venue || p.board,300),address:text(p.address || p.location,500),url:href,
      description:text(p.description),conditions:text(p.conditions),priceLabel:text(p.priceLabel,200),
      format:text(show.format,100)};
    unique.set(event.key,event);
  }
  return [...unique.values()].sort((a,b)=>a.start.localeCompare(b.start));
}
export function leadHours(start, now=Date.now()) {
  const time=Date.parse(start);
  return [24,2].filter(hours=>time-hours*HOUR>now);
}
export function dateLabel(start) {
  return new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',dateStyle:'medium',timeStyle:'short'}).format(new Date(start))+' Austin time';
}
export function message(event, hours, unsubscribe) {
  return {
    subject:`Reminder: ${text(event.title,180).replace(/[\r\n]/g,' ')} — ${hours} hours to go`,
    text:[`Austin.chat event reminder`,event.title,dateLabel(event.start),
      [event.venue,event.address].filter(Boolean).join(' · '),event.format,event.priceLabel,
      event.description,event.conditions,event.url,
      'Check the organizer’s listing for changes before you go.',
      'You selected this email reminder on Austin.chat.',
      'Manage reminders: https://austin.chat/?account=reminders',
      `Cancel reminders for this event: ${unsubscribe}`].filter(Boolean).join('\n\n')
  };
}
export function catalog(provider, feeds, now=Date.now()) {
  const result=new Map();
  for (const feed of feeds) {
    if (!instant(feed.generated) || now-Date.parse(feed.generated)>24*HOUR) throw new Error('Event listings are temporarily out of date. Please try again later.');
    const rows=provider==='explore'?feed.features:feed.records;
    if (!Array.isArray(rows)) throw new Error('Event listings are unavailable. Please try again later.');
    for (const row of rows) {
      const p=provider==='explore'?row.properties:row;
      if (!(Date.parse(p?.expires)>now)) continue;
      if (provider==='city-hall') {
        const source=feed.sources?.find(s=>s.id===p.source);
        if (!source?.ok || !(now-Date.parse(source.checked)<12*HOUR)) continue;
      }
      for (const event of occurrences(provider,row)) if (Date.parse(event.start)>now) result.set(event.key,event);
    }
  }
  return result;
}
