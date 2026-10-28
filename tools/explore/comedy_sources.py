"""Austin comedy venues' public calendars and organizer ticket-provider feeds."""
from concurrent.futures import ThreadPoolExecutor
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from functools import partial
import json
import re
from urllib.parse import urlencode, urljoin, urlparse

from build import ZONE, clean, date, fetch, web_url
from culture_sources import Page, first, fixed_row, geocode, local

DAYS = 14


def get_page(url):
    return Page(fetch(url).decode('utf-8')).root


def ld_nodes(root):
    def walk(value):
        if isinstance(value, dict):
            if '@type' in value:
                yield value
            for child in value.values():
                yield from walk(child)
        elif isinstance(value, list):
            for child in value:
                yield from walk(child)
    nodes = []
    for script in root.find('script', attr=('type', 'application/ld+json')):
        nodes.extend(walk(json.loads(''.join(script.children))))
    return nodes


def soon(start, end, now):
    return start and start < now+timedelta(days=DAYS) and (end or start) > now


def structured_events(root, now, venue, address, coordinates=None):
    """Read actual occurrences, including separate showtimes, from JSON-LD."""
    nodes = ld_nodes(root)
    events = [e for e in nodes if e.get('@type') in ('Event', 'ComedyEvent')]
    if not events:
        raise ValueError('Structured calendar events missing')
    rows = []
    for event in events:
        start, end = date(event.get('startDate')), date(event.get('endDate'))
        if not soon(start, end, now):
            continue
        if event.get('eventStatus', '').rsplit('/', 1)[-1] in ('EventCancelled', 'EventPostponed'):
            continue
        offers = event.get('offers') or []
        if isinstance(offers, dict): offers = [offers]
        if offers and all(o.get('availability', '').rsplit('/', 1)[-1] in ('SoldOut', 'Discontinued', 'OutOfStock') for o in offers):
            continue
        url = event.get('url')
        if not web_url(url): raise ValueError('Event details URL missing')
        location = event.get('location') or {}
        city = (location.get('address') or {}).get('addressLocality', 'Austin')
        if city.casefold() != 'austin': continue
        rows.append(dict(title=event['name'], theme='live-comedy', start=start, end=end, url=url,
                         venue=venue, address=address, coordinates=coordinates or geocode(address)))
    return rows


def seatengine(now, url, venue, address):
    months = {(now+timedelta(days=d)).astimezone(ZONE).strftime('%Y-%m') for d in (0,DAYS)}
    roots = []
    for month in sorted(months):
        year, number = month.split('-')
        roots.append(get_page(f'{url}?month={int(number)}&year={year}'))
    # The calendar's JSON-LD has dates; its per-performance links flag sold-out
    # or inactive sessions. A weekend engagement is never expanded by guessing.
    available = set()
    rows = {}
    for root in roots:
        for a in root.find('a'):
            href = urljoin(url, a.attrs.get('href', ''))
            if '/shows/' not in href: continue
            if 'inactive' in a.attrs.get('class', '').split() or re.search(r'sold\s*out|cancelled|canceled', a.text(), re.I):
                continue
            available.add(href)
        for row in structured_events(root, now, venue, address):
            rows[(row['url'], row['start'])] = row
    return [row for row in rows.values() if row['url'] in available]


def east_austin(now):
    root = get_page('https://eastaustincomedy.com/')
    club = next(n for n in ld_nodes(root) if n.get('@type') == 'ComedyClub')
    if club['address']['addressLocality'].casefold() != 'austin':
        raise ValueError('East Austin calendar location changed')
    coords = [float(club['geo']['longitude']), float(club['geo']['latitude'])]
    return structured_events(root, now, 'East Austin Comedy Club',
                             clean(club['address']['streetAddress'])+' Austin TX', coords)


def creek(now):
    url = 'https://creekandcave.com/calendar'
    root = get_page(url)
    dialogs = [d for d in root.find('div', 'modal-root') if d.attrs.get('data-modal-id', '').startswith('show-calendar-day-')]
    if not dialogs: raise ValueError('Creek calendar dates missing')
    links = set()
    first_day, last_day = now.astimezone(ZONE).date(), (now+timedelta(days=DAYS)).astimezone(ZONE).date()
    for dialog in dialogs:
        day = datetime.strptime(first(dialog, 'time').attrs['datetime'], '%Y-%m-%d').date()
        if not first_day <= day <= last_day: continue
        for item in dialog.find('li', 'show-calendar-day__dialog-show'):
            link = urljoin(url, first(item, 'a').attrs['href']).split('?', 1)[0]
            if not link.startswith('https://creekandcave.com/shows/'):
                raise ValueError('Unexpected Creek event URL')
            links.add(link)
    if len(links) > 80: raise ValueError('Unexpectedly large Creek calendar')
    # Public show pages publish exact dates for each session and ticket status.
    # Any failed detail page fails this venue update, preserving its last-good
    # listings until their original expiry rather than publishing a partial set.
    with ThreadPoolExecutor(max_workers=3) as pool:
        pages = list(pool.map(get_page, sorted(links)))
    rows = []
    for page in pages:
        rows.extend(structured_events(page, now, 'The Creek and The Cave', '611 E 7th St Austin TX', [-97.7363033,30.2671014]))
    return rows


def coldtowne(now):
    # This read-only, unauthenticated action is the calendar's own public feed.
    query = urlencode(dict(action='tcec_get_events', start=now.astimezone(ZONE).date().isoformat(),
                           end=(now+timedelta(days=DAYS)).astimezone(ZONE).date().isoformat(),
                           show_past_events='yes', event_terms=''))
    payload = json.loads(fetch('https://coldtownetheater.com/wp-admin/admin-ajax.php?'+query))
    if not isinstance(payload, list): raise ValueError('ColdTowne calendar is not an event list')
    rows = []
    for event in payload:
        start, end = date(event.get('start')), date(event.get('end'))
        if not start: raise ValueError('ColdTowne event date missing')
        if not soon(start, end, now): continue
        if not event['url'].startswith('https://coldtownetheater.com/show/'):
            continue  # No class enrollment or non-show products.
        rows.append(fixed_row(event['title'], 'live-comedy', start, end, event['url'],
                              'ColdTowne Theater', '1700 E 2nd St Austin TX'))
    return rows


def squadup(now, host, venue):
    # Public organizer feed used by SquadUP's embedded calendars, no auth or
    # ticket purchase. 'private' means unlisted in SquadUP's general directory;
    # these venue embeds deliberately publish those shows in their own calendar.
    query = urlencode(dict(user_ids=host, page_size=500, additional_attr='sold_out', include='custom_fields'))
    payload = json.loads(fetch('https://www.squadup.com/api/v3/events?'+query))
    if int(payload['meta']['paging']['total_pages']) > 1:
        raise ValueError('Organizer feed exceeds page limit; refusing a partial import')
    rows = []
    for event in payload['events']:
        if str(event['host']['id']) != str(host): raise ValueError('Organizer feed returned another host')
        if event.get('sold_out') is True or event.get('privacy') not in ('public', 'private'):
            continue
        if event.get('location_type') != 'In-Person' or not event.get('show_start_date'):
            continue
        start, end = date(event.get('start_at')), date(event.get('end_at'))
        if not start: raise ValueError('Ticket-provider show date missing')
        if not soon(start, end, now): continue
        location = event['location']
        address = clean(location.get('address_line_1'))
        if not re.search(r'\bAustin\b', address, re.I): continue
        coords = [float(location['longitude']),float(location['latitude'])]
        url = event['url']
        if urlparse(url).hostname not in ('squadup.com','www.squadup.com'):
            raise ValueError('Unexpected ticket-provider URL')
        room = clean(event.get('name_line_2'))
        description = 'Room: '+room.title() if venue == 'Comedy Mothership' and room in ('FAT MAN','LITTLE BOY') else ''
        rows.append(dict(title=event['name'], theme='live-comedy', start=start, end=end, url=url,
                         venue=venue, address=address, coordinates=coords, description=description))
    # The same street address sometimes has slightly different Google pins on
    # individual ticket pages. Consolidate that address using its most common
    # published coordinate; separate addresses still remain separate locations.
    points = defaultdict(Counter)
    for row in rows:
        points[row['address']][tuple(row['coordinates'])] += 1
    for row in rows:
        row['coordinates'] = list(points[row['address']].most_common(1)[0][0])
    return rows


def hideout(now):
    months = {(now+timedelta(days=d)).astimezone(ZONE).strftime('%Y-%m') for d in (0,DAYS)}
    rows = []
    for month in sorted(months):
        year, number = month.split('-')
        root = get_page(f'https://hideouttheatre.com/calendar/?mo={int(number)}&yr={year}')
        if not root.find(cls='em-calendar'): raise ValueError('Hideout calendar missing')
        for card in root.find('div', 'em-event'):
            times = card.find(cls='em-event-time')
            if not times: continue  # Ignore date-only popup previews of old shows.
            if not card.find('a', attr=('href', 'https://hideouttheatre.com/events/categories/shows/')): continue
            place = first(card, cls='em-event-location')
            if not place.find('a', attr=('href', 'https://hideouttheatre.com/locations/hideout-annex/')):
                raise ValueError('Hideout show has a different venue; verify its address')
            day = first(card, cls='em-event-date').text()
            day = re.sub(r'(\d)(st|nd|rd|th)\b', r'\1', day)
            day = datetime.strptime(day, '%a. %b %d, %Y').strftime('%B %d, %Y')
            clock = re.sub(r'\s*\(C[DS]T\)', '', times[0].text())
            start_time, end_time = re.split(r'\s*[-–]\s*', clock)
            start, end = local(day, start_time), local(day, end_time)
            if end <= start: end += timedelta(days=1)
            if not soon(start, end, now): continue
            title = first(card, 'img').attrs['alt']
            url = first(card, 'a', 'em-item-read-more').attrs['href']
            rows.append(fixed_row(title, 'live-comedy', start, end, url, 'The Hideout Theatre — Annex', '5555 N Lamar Blvd Austin TX',
                                  description='Hideout Annex · Suite B103. '+place.text()))
    return rows


SOURCES = [
    ('Comedy Mothership', 'https://comedymothership.com/shows', partial(squadup, host=9165465, venue='Comedy Mothership')),
    ('Cap City Comedy Club', 'https://www.capcitycomedy.com/calendar', partial(seatengine, url='https://www.capcitycomedy.com/calendar', venue='Cap City Comedy Club', address='11506 Century Oaks Terrace Austin TX')),
    ('The Creek and The Cave', 'https://creekandcave.com/calendar', creek),
    ('ColdTowne Theater', 'https://coldtownetheater.com/live-shows/', coldtowne),
    ('East Austin Comedy Club', 'https://eastaustincomedy.com/', east_austin),
    ('Sunset Strip Comedy Club', 'https://www.sunsetstripatx.com/', partial(squadup, host=9086799, venue='Sunset Strip Comedy Club')),
    ('The Velveeta Room', 'https://www.thevelveetaroom.com/', partial(seatengine, url='https://the-velveeta-room-the-velveeta-room.seatengine.com/calendar', venue='The Velveeta Room', address='521 E 6th St Austin TX')),
    ('The Hideout Theatre', 'https://hideouttheatre.com/calendar/', hideout),
]
