"""Dated live performances from venues' own public calendars and widgets.

No generated schedules, paid services, browser automation, or owner credentials.
Each adapter fails independently; build_layers retains only unexpired old rows.
"""
from datetime import datetime, timedelta, timezone
from functools import lru_cache
import json
import re
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen

from build import ZONE, clean, date, fetch
from culture_sources import Node, first, fixed_row, local, page

# These are non-performance entries that share the venues' music calendars.
NON_SHOW = re.compile(r'\b(private (?:event|party)|closed|cancelled|canceled|postponed|sold out|'
                      r'rehearsal|workshop|lessons?|trivia|karaoke|watch party|football|'
                      r'book signing|taco tuesday|all evening happy hour|rave)\b', re.I)


def is_show(title):
    return bool(clean(title)) and not NON_SHOW.search(clean(title))


def upcoming(start, end, now):
    return start and start < now + timedelta(days=14) and (end or start) > now


def row(title, start, end, url, venue, address, **extra):
    return fixed_row(title, 'live-music', start, end, url, venue, address, **extra)


def utc(value):
    return datetime.fromisoformat(value).replace(tzinfo=timezone.utc).astimezone(ZONE)


def saxon(now):
    base = 'https://thesaxonpub.com/wp-json/tribe/events/v1/events?'
    query = dict(start_date=(now.astimezone(ZONE)-timedelta(days=1)).date(),
                 end_date=(now.astimezone(ZONE)+timedelta(days=14)).date(), per_page=100)
    data = json.loads(fetch(base+urlencode(query)))
    total = int(data['total_pages'])
    if total > 5:
        raise ValueError('Unexpected Saxon Pub pagination')
    batches = [data] + [json.loads(fetch(base+urlencode(dict(query, page=n)))) for n in range(2, total+1)]
    rows = []
    for batch in batches:
        for e in batch['events']:
            if e.get('status') != 'publish' or e.get('hide_from_listings') or e.get('all_day') or not is_show(e['title']):
                continue
            venue = e.get('venue') or {}
            if venue and (venue.get('city') != 'Austin' or not re.search(r'1320\s+S', venue.get('address', ''), re.I)):
                raise ValueError('Saxon calendar includes an unexpected venue')
            start, end = utc(e['utc_start_date']), utc(e['utc_end_date'])
            if upcoming(start, end, now):
                rows.append(row(e['title'], start, end, e['url'], 'Saxon Pub', '1320 S Lamar Blvd Austin TX'))
    return rows


@lru_cache(maxsize=1)
def timely_widget():
    """Use the public widget's distributed read API configuration.

    Timely requires its own public frontend app key even for anonymous reads.
    Read it from the published widget bundle; never store a private account key.
    """
    root = page('https://events.timely.fun/74avt53i/')
    scripts = [urljoin('https://events.timely.fun/', n.attrs.get('src', '')) for n in root.find('script')]
    bundle = next((u for u in scripts if re.fullmatch(r'https://events\.timely\.fun/[\d.]+/main\.js', u)), None)
    if not bundle:
        raise ValueError('Timely public widget bundle missing')
    code = fetch(bundle).decode('utf-8')
    match = re.search(r'apiUrl:"https://timelyapp\.time\.ly/api",apiInternalUrl:"[^"]+",apiKey:"([A-Za-z0-9]+)"', code)
    if not match:
        raise ValueError('Timely public widget configuration changed')
    return match[1]


def timely_data(url):
    request = Request(url, headers={'X-Api-Key': timely_widget(),
                                   'User-Agent': 'AustinChatExplore/1.0 (+https://austin.chat/contact/)'})
    with urlopen(request, timeout=20) as response:
        body = response.read(5_000_001)
    if len(body) > 5_000_000:
        raise ValueError('Timely response exceeds import limit')
    return json.loads(body)['data']


def timely_rows(data, now, venues):
    if data['has_next']:
        raise ValueError('Timely calendar truncated; refusing a partial import')
    rows = []
    for items in data['items'].values():
        for e in items:
            if e.get('event_status') != 'confirmed' or e.get('allday') or e.get('is_example_event') or not is_show(e['title']):
                continue
            places = e.get('taxonomies', {}).get('taxonomy_venue', [])
            if len(places) != 1 or places[0]['id'] not in venues:
                raise ValueError('Unexpected Timely music venue')
            name, address = venues[places[0]['id']]
            start = utc(e['start_utc_datetime'])
            # Timely fills in 23:59:59 when the organizer supplies no end time.
            end = None if e.get('instant_event') else utc(e['end_utc_datetime'])
            if upcoming(start, end, now):
                rows.append(row(e['title'], start, end, e['url'], name, address))
    return rows


def timely(now, calendar, venues):
    query = dict(group_by_date=1, timezone='America/Chicago', view='month',
                 start_date_utc=int((now-timedelta(days=1)).timestamp()),
                 end_date_utc=int((now+timedelta(days=14)).timestamp()), per_page=1000, page=1)
    return timely_rows(timely_data(f'https://events.timely.fun/api/calendars/{calendar}/events?'+urlencode(query)), now, venues)


def continental(now):
    return timely(now, 54714987, {678194628: ('The Continental Club', '1315 S Congress Ave Austin TX'),
                                 678194627: ('Continental Gallery', '1313 S Congress Ave Austin TX')})


def cboys(now):
    return timely(now, 54714969, {678194631: ('C-Boy’s Heart & Soul', '2008 S Congress Ave Austin TX')})


def month_day(value, clock, now):
    # Bandzoogle's upcoming list omits the year. Choose the adjacent year nearest
    # today, then enforce the 14-day window (including December/January).
    day = value.split(', ', 1)[-1]
    year = now.astimezone(ZONE).year
    candidates = []
    for y in (year-1, year, year+1):
        try:
            candidates.append(local(f'{day}, {y}', clock))
        except ValueError:
            pass
    if not candidates:
        raise ValueError('Unrecognized Bandzoogle date')
    return min(candidates, key=lambda d: abs((d-now).total_seconds()))


def bandzoogle(now, url, venue, address):
    rows, seen_pages, visited = [], set(), set()
    next_url = url
    for _ in range(8):
        if next_url in visited:
            raise ValueError('Bandzoogle pagination loop')
        visited.add(next_url)
        root = page(next_url)
        cards = root.find(cls='event-detail') or [n for n in root.find('tr') if n.find(cls='event-name')]
        if not cards:
            raise ValueError('Bandzoogle upcoming calendar missing')
        starts = []
        page_ids = []
        for card in cards:
            title_node = first(card, cls='event-title') if card.find(cls='event-title') else first(card, cls='event-name')
            link = first(title_node, 'a')
            title = link.text()
            clock = first(first(card, cls='date-long'), 'time', 'from')
            start = month_day(first(clock, cls='date').text(), first(clock, cls='time').text(), now)
            # Sam's sometimes puts doors in the time field and the actual show
            # start in the event title. Honor that explicit correction.
            actual = re.search(r'\bshow (?:at\s*)?(\d{1,2}(?::\d\d)?\s*[ap]m)', title, re.I)
            if actual:
                start = local(start.strftime('%B %d, %Y'), actual[1])
            starts.append(start)
            href = urljoin(url, link.attrs['href']).replace('&popup=1', '').replace('?popup=1', '')
            page_ids.append((href, start.isoformat()))
            if is_show(title) and upcoming(start, None, now):
                rows.append(row(title, start, None, href, venue, address))
        signature = tuple(page_ids)
        if signature in seen_pages:
            raise ValueError('Bandzoogle returned a repeated page')
        seen_pages.add(signature)
        links = root.find('a', attr=('rel', 'next'))
        if max(starts) >= now+timedelta(days=14) or not links:
            return rows
        next_url = urljoin(url, links[0].attrs['href'])
        if not next_url.startswith(url.split('/calendar')[0]+'/'):
            raise ValueError('Unexpected Bandzoogle pagination host')
    raise ValueError('Bandzoogle pagination limit; refusing a partial import')


def elephant(now):
    return bandzoogle(now, 'https://elephantroom.com/calendar', 'Elephant Room', '315 Congress Ave Austin TX')


def sams(now):
    return bandzoogle(now, 'https://www.samstownpointatx.com/calendar', 'Sam’s Town Point', '2115 Allred Dr Austin TX')


def mohawk(now):
    # JSONP supplied by the venue's public Prekindle widget. No evaluation.
    raw = fetch('https://www.prekindle.com/api/events/organizer/531433527670566235').decode('utf-8').strip()
    match = re.fullmatch(r'(?:callback|widgetCallback)\((.*)\);?', raw, re.S)
    if not match:
        raise ValueError('Mohawk public event widget changed')
    rows = []
    for e in json.loads(match[1])['events']:
        if e.get('city') != 'Austin' or e.get('venue') not in ('Mohawk Indoor', 'Mohawk Outdoor'):
            raise ValueError('Mohawk widget includes an unexpected venue')
        if e.get('availability') != 'AVAILABLE' or not e.get('lineup') or not is_show(e['title']):
            continue
        day = datetime.strptime(e['date'], '%m/%d/%Y').strftime('%B %d, %Y')
        start = local(day, e['time'])  # Separate doorsTime is not a showtime.
        if upcoming(start, None, now):
            url = e.get('thirdPartyLink') or e['dtfLinks'][0]
            rows.append(row(e['title'], start, None, url, 'Mohawk', '912 Red River St Austin TX', description=e['venue']))
    return rows


BANGERS = 'https://www.bangersaustin.com/pages/event-calendar'


def bangers_rows(data, now):
    if data.get('result') is not True or not isinstance(data.get('value'), list):
        raise ValueError('Banger’s calendar unavailable')
    rows = []
    for e in data['value']:
        if clean(e.get('title')).casefold() != 'live music' or e.get('allday') or e.get('dateonly'):
            continue
        title = clean(e.get('description'))
        if not is_show(title):
            continue
        # Widget's epoch fields encode dates only; the separate local clock
        # fields are authoritative. ZoneInfo applies Austin daylight saving.
        start = datetime.fromisoformat(e['startDate']).replace(hour=int(e['startHour']), minute=int(e['startMinutes']), tzinfo=ZONE)
        end = datetime.fromisoformat(e['endDate']).replace(hour=int(e['endHour']), minute=int(e['endMinutes']), tzinfo=ZONE)
        if end <= start:
            raise ValueError('Banger’s performance has an invalid end time')
        if upcoming(start, end, now):
            rows.append(row(title, start, end, BANGERS, 'Banger’s Sausage House & Beer Garden', '79 Rainey St Austin TX'))
    return rows


def bangers(now):
    url = 'https://inffuse.eventscalendar.co/api/v0.1/projects/proj_Cj6GP8xY15cempiIb4Evi/data/public/events?user=user_aRy7LRxpBR8yTDQ0VZ8iz&app=calendar'
    return bangers_rows(json.loads(fetch(url)), now)


def whitehorse_rows(data, now):
    if data.get('result') is not True or not isinstance(data.get('events'), list):
        raise ValueError('White Horse calendar unavailable')
    rows = []
    for e in data['events']:
        title = clean(e.get('title'))
        if e.get('allday') or not is_show(title) or re.search(r'^\$?\d+\s*cover$|^no cover$|\bDJ\b', title, re.I):
            continue
        start, end = date(e.get('start_time')), date(e.get('end_time'))
        if upcoming(start, end, now):
            rows.append(row(title, start, end, 'https://www.thewhitehorseaustin.com/', 'The White Horse', '500 Comal St Austin TX'))
    return rows


def whitehorse(now):
    # Public, anonymous feed used by the venue's embedded calendar. The provider
    # expands Google recurrences, exceptions and DST into dated occurrences.
    query = dict(user='user_VrArD1iWlMibcVpvljMTt', project='proj_945OpCDVf4GE0sVN6favP',
                 calendar='c6bl5p36vpushauid2vvf88muc@group.calendar.google.com',
                 **{'from': int((now-timedelta(days=1)).timestamp()*1000), 'to': int((now+timedelta(days=14)).timestamp()*1000)})
    return whitehorse_rows(json.loads(fetch('https://broker.eventscalendar.co/api/google/events?'+urlencode(query))), now)


def abgb(now):
    url = 'https://theabgb.com/events/'
    root = page(url)
    days = root.find(cls='day-card')
    if not days:
        raise ValueError('ABGB dated calendar missing')
    rows = []
    for day in days:
        day_date = date(day.attrs['data-date'])
        if not now.astimezone(ZONE).date()-timedelta(days=1) <= day_date.date() <= (now+timedelta(days=14)).astimezone(ZONE).date():
            continue
        for e in day.find(cls='calendar-day-event'):
            title = first(e, cls='ev-title').text()
            # Mixed calendar: require music evidence in the organizer's detail
            # card or a named band set; skip food/sports/private functions.
            if not is_show(title):
                continue
            detail = first(root, attr=('id', e.attrs['data-event-id'])).text()
            if re.search(r'\b(showing part|screening|movie|film|doors)\b', detail, re.I):
                continue  # Mixed-use listings or ticket events with doors-only times.
            if re.search(r'\b(benefitting|benefiting|fundraiser)\b', title, re.I) and not re.search(r'\b(music|musical|band|live)\b', detail, re.I):
                continue
            times = first(e, cls='ev-time').text()
            match = re.fullmatch(r'(\d{1,2}(?::\d\d)?[ap]m)\s*[-–]\s*(\d{1,2}(?::\d\d)?[ap]m)', times, re.I)
            if not match:
                continue  # All-day cards do not specify a performance time.
            start, end = [local(day_date.strftime('%B %d, %Y'), t) for t in match.groups()]
            if end <= start:
                end += timedelta(days=1)
            if upcoming(start, end, now):
                rows.append(row(title, start, end, url+'#'+e.attrs['data-event-id'], 'The ABGB', '1305 W Oltorf St Austin TX'))
    return rows


def lines(node):
    """Preserve published band-per-line schedules rather than joining <br>s."""
    text = ''
    for c in node.children:
        text += ('\n' if c.tag == 'br' else lines(c)) if isinstance(c, Node) else c
    return text


def sahara_rows(root, now):
    cards = root.find(cls='CalEvent')
    if not cards:
        raise ValueError('Sahara dated calendar missing')
    rows = []
    for card in cards:
        a = first(first(card, cls='EventLink'), 'a')
        match = re.search(r"PopupWindow\s*\('sahara',\s*'(\d{4}[/-]\d{2}[/-]\d{2})", a.attrs.get('href', ''))
        if not match:
            continue
        day = datetime.strptime(match[1].replace('/', '-'), '%Y-%m-%d')
        if not now.astimezone(ZONE).date()-timedelta(days=1) <= day.date() <= (now+timedelta(days=14)).astimezone(ZONE).date():
            continue
        for line in lines(a).splitlines():
            # The calendar's generic TimeLabel is sometimes unrelated to the
            # band's written set time. Use only explicit am/pm in the lineup;
            # omit ambiguous/missing times and generic buffet/opening entries.
            m = re.fullmatch(r'\s*(\d{1,2}(?::\d\d)?\s*[ap])m?\s+(.+?)\s*', line, re.I)
            if not m:
                continue
            title = clean(m[2])
            if not is_show(title) or re.search(r'\b(DJ|doors?|buffet|Africa Night|Psych Night)\b', title, re.I):
                continue
            start = local(day.strftime('%B %d, %Y'), m[1]+'m')
            # Sets at midnight/1am belong to the following day of a night lineup.
            if start.hour < 5:
                start += timedelta(days=1)
            if upcoming(start, None, now):
                url = 'https://www.brownbearsw.com/cal/sahara?'+urlencode(dict(Op='ShowDay', Date=day.date()))
                rows.append(row(title, start, None, url, 'Sahara Lounge', '1413 Webberville Rd Austin TX'))
    return rows


def sahara(now):
    months = {now.astimezone(ZONE).date().replace(day=1),
              (now+timedelta(days=14)).astimezone(ZONE).date().replace(day=1)}
    return [row for month in sorted(months) for row in sahara_rows(page('https://www.brownbearsw.com/cal/sahara?Date='+str(month)), now)]


SOURCES = [
    ('Saxon Pub', 'https://thesaxonpub.com/events/', saxon),
    ('Continental Club & Gallery', 'https://continentalclub.com/austin', continental),
    ('C-Boy’s Heart & Soul', 'https://www.cboys.com/calendar', cboys),
    ('Elephant Room', 'https://elephantroom.com/calendar', elephant),
    ('Sam’s Town Point', 'https://www.samstownpointatx.com/calendar', sams),
    ('Mohawk', 'https://mohawkaustin.com/', mohawk),
    ('Banger’s', BANGERS, bangers),
    ('The White Horse', 'https://www.thewhitehorseaustin.com/', whitehorse),
    ('The ABGB', 'https://theabgb.com/events/', abgb),
    ('Sahara Lounge', 'https://www.saharalounge.com/shows/', sahara),
]
