"""Build the Free & cheap map without AI or API keys. Python 3.12+, stdlib only."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
import hashlib
import json
from pathlib import Path
import re
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'chat/data/explore/free-cheap.geojson'
ZONE = ZoneInfo('America/Chicago')
LIBRARY = 'https://library.austintexas.gov/events-feed.xml'
BRANCHES = 'https://data.austintexas.gov/resource/tc36-hn4j.json'
UT = 'https://calendar.utexas.edu/api/2/events'
MAX_DAYS = 14


def clean(value):
    return re.sub(r'\s+', ' ', unescape(re.sub(r'<[^>]+>', ' ', str(value or '')))).strip()


def date(value):
    if not value:
        return None
    try:
        d = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        try:
            d = parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None
    return d.replace(tzinfo=ZONE) if d.tzinfo is None else d


def fetch(url):
    request = Request(url, headers={'User-Agent': 'AustinChatExplore/1.0 (+https://austin.chat/contact/)'})
    with urlopen(request, timeout=20) as response:
        return response.read(5_000_000)


def web_url(url):
    return isinstance(url, str) and urlparse(url).scheme in ('http', 'https') and bool(urlparse(url).netloc)


def price(cost, description=''):
    """Never turn absent prices, free food, student discounts, or 'from' into free admission."""
    c = clean(cost).lower()
    if re.fullmatch(r'(free!?|\$?0(?:\.00)?|no charge|free admission)', c):
        return 0.0, 'Free'
    if re.fullmatch(r'\$\d+(?:\.\d{1,2})?(?:\s*[-–]\s*\$?\d+(?:\.\d{1,2})?)?', c):
        amount = max(float(n) for n in re.findall(r'\d+(?:\.\d+)?', c))
        return (amount, clean(cost)) if amount <= 20 else None
    if not c and re.search(r'\b(?:free and open to (?:the )?public|(?:admission is free|this event is free|free admission)(?:[.!;,]|$))', clean(description), re.I):
        return 0.0, 'Free'
    return None


def feature(*, title, url, venue, address, lng, lat, start, end, cost, price_label,
            source, checked, description='', kind='event', conditions='', expires=None, all_day=False):
    if not web_url(url) or not title or not start or not end or end <= start:
        return None
    try:
        lng, lat, cost = float(lng), float(lat), float(cost)
    except (ValueError, TypeError):
        return None
    if not (-98.05 < lng < -97.4 and 30.0 < lat < 30.65 and 0 <= cost <= 20):
        return None
    fid = hashlib.sha256(f'{url}|{start.isoformat()}'.encode()).hexdigest()[:20]
    return {'type': 'Feature', 'id': fid, 'geometry': {'type': 'Point', 'coordinates': [lng, lat]},
            'properties': dict(id=fid, title=clean(title), url=url, venue=clean(venue), address=clean(address),
                               start=start.isoformat(), end=end.isoformat(), price=cost, priceLabel=price_label,
                               source=source, checked=checked.isoformat(), kind=kind, allDay=all_day,
                               description=clean(description)[:220], conditions=clean(conditions)[:300],
                               expires=min(end, expires or checked + timedelta(hours=24)).isoformat())}


def ld_events(page):
    def walk(value):
        if isinstance(value, dict):
            types = value.get('@type', [])
            if types == 'Event' or (isinstance(types, list) and 'Event' in types):
                yield value
            for child in value.values():
                yield from walk(child)
        elif isinstance(value, list):
            for child in value:
                yield from walk(child)
    for script in re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', page, re.S | re.I):
        try:
            yield from walk(json.loads(script))
        except ValueError:
            continue


def library_event(item, branches, now):
    url = item.findtext('link', '').replace('http://', 'https://', 1)
    if urlparse(url).netloc != 'library.austintexas.gov':
        return None
    description = clean(item.findtext('description'))
    branch_name = description.split(' - ')[0]
    branch = branches.get(branch_name)
    if not branch:
        return None  # Online, mobile-library stops and unknown venues are not guessed.
    page = fetch(url).decode('utf-8')
    events = list(ld_events(page))
    if not events:
        raise ValueError('Missing event metadata')
    event = events[0]
    if event.get('eventStatus', '').endswith(('EventCancelled', 'EventPostponed')):
        return None
    if not event.get('eventAttendanceMode', '').endswith('OfflineEventAttendanceMode'):
        return None
    if str(event.get('isAccessibleForFree')).lower() != 'true':
        return None
    if 'Free and open to the public' not in clean(page):
        return None
    start, end = date(event.get('startDate')), date(event.get('endDate'))
    if not start or start > now + timedelta(days=MAX_DAYS):
        return None
    # No invented duration: missing end times expire at their start.
    end = end or start
    if end <= now or end <= start:
        return None
    address = branch['address']
    tags = re.search(r'<div class="event_tag_links">(.*?)</div>', page, re.S)
    conditions = clean(tags.group(1)) if tags else ''
    if re.search(r'\b(register|registration|RSVP|ticket|space is limited)\b', description, re.I):
        conditions += ' · Check the organizer for registration or capacity limits.'
    return feature(title=item.findtext('title'), url=url, venue=branch_name,
                   address=json.loads(address['human_address']).get('address', ''),
                   lng=address['longitude'], lat=address['latitude'], start=start, end=end,
                   cost=0, price_label='Free', source='Austin Public Library', checked=now,
                   description=description.removeprefix(branch_name + ' - '), conditions=conditions)


def library(now, previous):
    branches = {b['name']: b for b in json.loads(fetch(BRANCHES))}
    if 'John Gillum Branch (North Village)' in branches:
        branches['John Gillum Branch'] = branches['John Gillum Branch (North Village)']
    items = ET.fromstring(fetch(LIBRARY)).findall('.//item')
    if not items:
        raise ValueError('Library feed has no event records')
    candidates = [i for i in items if date(i.findtext('pubDate'))
                  and now - timedelta(days=1) <= date(i.findtext('pubDate')) <= now + timedelta(days=MAX_DAYS)]
    failed = []
    def one(item):
        try:
            return library_event(item, branches, now)
        except Exception as error:
            url = item.findtext('link', '').replace('http://', 'https://', 1)
            failed.append(url)
            print(f'Library detail skipped: {url}: {error}')
            return None
    with ThreadPoolExecutor(max_workers=4) as pool:
        result = [f for f in pool.map(one, candidates) if f]
    result.extend(f for f in previous if f['properties']['url'] in failed and valid_cached(f, now))
    if candidates and len(failed) == len(candidates):
        raise ValueError('All library event detail requests failed')
    return result, len(failed)


def university(now):
    result = []
    day = now.astimezone(ZONE).date().isoformat()
    first = json.loads(fetch(f'{UT}?start_date={day}&days={MAX_DAYS}&pp=100'))
    total = int(first.get('page', {}).get('total', 1))
    if total > 20:
        raise ValueError('Unexpectedly large UT calendar; refusing to publish an incomplete import')
    pages = [first]
    for page in range(2, total + 1):
        pages.append(json.loads(fetch(f'{UT}?start_date={day}&days={MAX_DAYS}&pp=100&page={page}')))
    for page in pages:
        for wrapper in page.get('events', []):
            e = wrapper['event']
            audiences = e.get('filters', {}).get('event_target_audience', [])
            if e.get('status') != 'live' or not any(a.get('name') == 'General Public' for a in audiences):
                continue
            description = clean(e.get('description_text') or e.get('description'))
            if re.search(r'\b(?:UT ID|students only|members only)\b', description, re.I):
                continue
            cost = price(e.get('ticket_cost'), description)
            geo = e.get('geo') or {}
            if not cost or (geo.get('city') or '').lower() != 'austin':
                continue
            for wrapper_instance in e.get('event_instances', []):
                instance = wrapper_instance['event_instance']
                start, end = date(instance.get('start')), date(instance.get('end'))
                if not start or start > now + timedelta(days=MAX_DAYS):
                    continue
                all_day = bool(instance.get('all_day'))
                if not end and all_day:
                    end = datetime.combine(start.astimezone(ZONE).date() + timedelta(days=1), datetime.min.time(), ZONE)
                # Timed events lacking an end are displayed only before their start.
                effective_end = end or start
                if effective_end <= now:
                    continue
                expiry = effective_end
                if not end:
                    effective_end = start + timedelta(seconds=1)
                f = feature(title=e.get('title'), url=e.get('localist_url'), venue=e.get('location_name'),
                            address=geo.get('street'), lng=geo.get('longitude'), lat=geo.get('latitude'),
                            start=start, end=effective_end, cost=cost[0], price_label=cost[1],
                            source='UT Austin', checked=now, all_day=all_day,
                            description='', conditions='Check organizer for admission, registration and schedule details.',
                            expires=min(expiry, now + timedelta(hours=24)))
                if f:
                    f['properties']['endKnown'] = bool(end)
                    result.append(f)
    return result, 0


def curated(now):
    result = []
    for item in json.loads((ROOT / 'tools/explore/curated.json').read_text()):
        verified = date(item['verified'])
        until = date(item['validUntil'])
        if not verified or not until or until <= now:
            continue
        # Human-reviewed entries have a fixed review deadline, never auto-renew it.
        for offset in range(MAX_DAYS):
            day = now.astimezone(ZONE).date() + timedelta(days=offset)
            hours = item['hours'].get(str(day.weekday()))
            if not hours or day.isoformat() in item.get('closedDates', []):
                continue
            start = datetime.fromisoformat(f'{day}T{hours[0]}').replace(tzinfo=ZONE)
            end = datetime.fromisoformat(f'{day}T{hours[1]}').replace(tzinfo=ZONE)
            if end <= now or start >= until:
                continue
            f = feature(title=item['title'], url=item['url'], venue=item['venue'], address=item['address'],
                        lng=item['coordinates'][0], lat=item['coordinates'][1], start=start, end=end,
                        cost=item['price'], price_label=item['priceLabel'], source='Verified activity',
                        checked=verified, kind=item.get('kind', 'activity'), description=item['description'],
                        conditions=item['conditions'], expires=until)
            if f:
                result.append(f)
    return result, 0


def valid_cached(f, now):
    p = f.get('properties', {})
    expires = date(p.get('expires'))
    return expires and expires > now


def build():
    now = datetime.now(timezone.utc)
    previous = json.loads(OUT.read_text()).get('features', []) if OUT.exists() else []
    result, statuses = [], []
    jobs = [('Austin Public Library', LIBRARY, lambda: library(now, previous)),
            ('UT Austin', 'https://calendar.utexas.edu/', lambda: university(now)),
            ('Verified activity', '', lambda: curated(now))]
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [(name, url, pool.submit(job)) for name, url, job in jobs]
        for name, url, future in futures:
            try:
                items, failures = future.result()
                ok = True
                print(f'{name}: {len(items)} entries; {failures} detail requests failed')
            except Exception as error:
                print(f'{name}: {error}')
                items = [f for f in previous if f['properties']['source'] == name and valid_cached(f, now)]
                ok, failures = False, 1
            statuses.append(dict(name=name, url=url, ok=ok, failures=failures, count=len(items)))
            result.extend(items)
    if not any(s['ok'] for s in statuses[:2]):
        raise RuntimeError('Both live sources failed; keeping previous published file')
    unique = {}
    for f in result:
        p = f['properties']
        key = (p['title'].casefold(), p['start'], tuple(f['geometry']['coordinates']))
        unique[key] = f
    features = sorted(unique.values(), key=lambda f: f['properties']['start'])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(dict(type='FeatureCollection', generated=now.isoformat(), sources=statuses,
                                  features=features), ensure_ascii=False, indent=1) + '\n')
    print(f'Published {len(features)} records to {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    build()
