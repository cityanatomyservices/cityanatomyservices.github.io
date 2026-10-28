"""Free, keyless sources for Austin.chat. Run with Python 3.11+ (stdlib only)."""
import concurrent.futures
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import html
import json
from pathlib import Path
import re
import urllib.request
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'ticker' / 'feed.json'
CENTRAL = ZoneInfo('America/Chicago')
FEEDS = [
    ('KUT', 'headlines', 'https://www.kut.org/austin.rss'),
    ('KXAN', 'headlines', 'https://www.kxan.com/news/local/austin/feed/'),
    ('City of Austin', 'city', 'https://www.austintexas.gov/site/news/rss.xml'),
    ('KUT housing', 'property', 'https://www.kut.org/housing.rss'),
    ('KUT transportation', 'transport', 'https://www.kut.org/transportation.rss'),
    ('Texas Tribune', 'national', 'https://www.texastribune.org/feed/'),
]
LOCAL = re.compile(r'\b(Austin|Central Texas|Travis County|Round Rock)\b', re.I)
NATIONAL = re.compile(r'\b(federal|Congress|White House|Supreme Court|Trump|tariffs?|Medicare|Medicaid|ICE|immigration|shutdown)\b', re.I)


def clean(value):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]*>', ' ', html.unescape(value or ''))).strip()


def safe_url(value):
    return isinstance(value, str) and value.startswith(('https://', 'http://'))


def date(value):
    try:
        result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        try:
            result = parsedate_to_datetime(value)
        except (ValueError, TypeError):
            try:
                result = datetime.strptime(value, '%B %d, %Y')
            except (ValueError, TypeError):
                return None
    return result.replace(tzinfo=CENTRAL) if result.tzinfo is None else result


def fetch(url):
    request = urllib.request.Request(url, headers={
        'User-Agent': 'AustinChatTicker/1.0 (+https://austin.chat/contact/)',
        'Accept': 'application/json, application/rss+xml, application/xml, */*',
    })
    with urllib.request.urlopen(request, timeout=25) as response:
        return response.read(4_000_000)


def rss(data, source, category, now):
    items = []
    for entry in ET.fromstring(data).findall('.//item'):
        title = clean(entry.findtext('title'))
        link = html.unescape((entry.findtext('link') or '').strip())
        published = date(entry.findtext('pubDate'))
        if not title or not safe_url(link) or not published:
            continue
        if not now - timedelta(days=7) <= published <= now + timedelta(minutes=10):
            continue
        if category == 'national':
            context = title + ' ' + clean(entry.findtext('description'))
            if not (LOCAL.search(context) and NATIONAL.search(context)):
                continue
        items.append(dict(title=title, url=link, source=source, category=category,
                          published=published.isoformat(),
                          expires=(published + timedelta(days=7)).isoformat()))
    return sorted(items, key=lambda item: date(item['published']), reverse=True)[:(3 if category == 'national' else 8)]


def events(data, now):
    items = []
    for wrapper in json.loads(data).get('events', []):
        event = wrapper['event']
        audiences = event.get('filters', {}).get('event_target_audience', [])
        if not any(a.get('name') == 'General Public' for a in audiences):
            continue
        if event.get('status') != 'live':
            continue
        geo = event.get('geo') or {}
        if (geo.get('city') or '').lower() != 'austin':
            continue
        upcoming = []
        for instance in event.get('event_instances', []):
            instance = instance['event_instance']
            start = date(instance.get('start'))
            if start and now < start < now + timedelta(days=14):
                upcoming.append((start, instance))
        if not upcoming:
            continue
        start, instance = min(upcoming, key=lambda value: value[0])
        link = event.get('localist_url')
        if not safe_url(link):
            continue
        items.append(dict(title=clean(event.get('title')), url=link,
                          source='UT Austin calendar', category='events',
                          starts=start.isoformat(), expires=start.isoformat(),
                          allDay=bool(instance.get('all_day')),
                          location=clean(event.get('location_name'))))
    return sorted(items, key=lambda item: date(item['starts']))[:12]


def build():
    now = datetime.now(timezone.utc)
    jobs = [(name, url, lambda data, name=name, cat=cat: rss(data, name, cat, now))
            for name, cat, url in FEEDS]
    # Explicit start_date avoids a cached calendar response for a previous day.
    day = now.astimezone(CENTRAL).date().isoformat()
    jobs.append(('UT Austin calendar', f'https://calendar.utexas.edu/api/2/events?start_date={day}&days=14&pp=100',
                 lambda data: events(data, now)))
    try:
        previous = json.loads(OUT.read_text()).get('items', [])
    except (OSError, ValueError):
        previous = []
    items, statuses = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
        futures = [(name, url, parser, pool.submit(fetch, url)) for name, url, parser in jobs]
        for name, url, parser, future in futures:
            try:
                found = parser(future.result())
                statuses.append(dict(name=name, url=url, ok=True, count=len(found)))
            except Exception as error:
                print(f'{name}: {error}')
                found = [item for item in previous if item['source'] == name
                         and date(item.get('expires')) and date(item['expires']) > now]
                statuses.append(dict(name=name, url=url, ok=False, count=len(found)))
            items.extend(found)
    # Prefer category-specific coverage when the same article occurs in two feeds.
    unique = {}
    for item in items:
        key = item['url'].split('?')[0].rstrip('/')
        if key not in unique or item['category'] not in ('headlines', 'national'):
            unique[key] = item
    result = dict(generated=now.isoformat(), sources=statuses, items=list(unique.values()))
    if not any(source['ok'] for source in statuses):
        raise RuntimeError('All sources failed; keeping the previous feed')
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(unique)} ticker items; {sum(s["ok"] for s in statuses)}/{len(statuses)} sources responding')


if __name__ == '__main__':
    build()
