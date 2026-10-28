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
    ('KUT', 'kut', 'headlines', 'https://www.kut.org/austin.rss'),
    ('KXAN', 'kxan', 'headlines', 'https://www.kxan.com/news/local/austin/feed/'),
    ('Austin Chronicle news', 'chronicle', 'headlines', 'https://www.austinchronicle.com/category/news/feed/'),
    ('Austin Chronicle culture', 'chronicle', 'culture', 'https://www.austinchronicle.com/feed/'),
    ('Austin Current', 'current', 'headlines', 'https://austincurrent.org/feed/'),
    ('Community Impact · Austin area', 'community-impact', 'headlines', 'https://communityimpact.com/rss/austin/'),
    ('KVUE', 'kvue', 'headlines', 'https://www.kvue.com/feeds/syndication/rss/news/local'),
    ('Austin Monthly', 'monthly', 'culture', 'https://www.austinmonthly.com/feed/'),
    ('The Daily Texan', 'daily-texan', 'headlines', 'https://thedailytexan.com/category/news/feed/'),
    ('City of Austin', 'city', 'city', 'https://www.austintexas.gov/site/news/rss.xml'),
    ('KUT housing', 'kut', 'property', 'https://www.kut.org/housing.rss'),
    ('KUT transportation', 'kut', 'transport', 'https://www.kut.org/transportation.rss'),
    ('Texas Tribune', 'tribune', 'national', 'https://www.texastribune.org/feed/'),
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
    root = ET.fromstring(data)
    if root.tag != 'rss' or root.find('channel') is None:
        raise ValueError('Expected an RSS channel, not a website or error page')
    for entry in root.findall('./channel/item'):
        tags = {clean(tag.text).casefold() for tag in entry.findall('category')}
        if any(re.search(r'\b(contests?|sponsored|advertorial|partner content)\b', tag) for tag in tags):
            continue
        # The separate Chronicle news feed includes its weekly issue. Its general
        # feed supplies arts/food/music stories without repeating those headlines.
        if source == 'Austin Chronicle culture' and 'news' in tags:
            continue
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


def build():
    now = datetime.now(timezone.utc)
    # Dated activities now come from the same six Explore feeds as the map.
    jobs = [(name, publisher, url, lambda data, name=name, cat=cat: rss(data, name, cat, now))
            for name, publisher, cat, url in FEEDS]
    try:
        previous = json.loads(OUT.read_text()).get('items', [])
    except (OSError, ValueError):
        previous = []
    items, statuses = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
        futures = [(name, publisher, url, parser, pool.submit(fetch, url)) for name, publisher, url, parser in jobs]
        for name, publisher, url, parser, future in futures:
            try:
                found = parser(future.result())
                statuses.append(dict(name=name, publisher=publisher, url=url, ok=True, count=len(found)))
            except Exception as error:
                print(f'{name}: {error}')
                found = [item for item in previous if item['source'] == name
                         and date(item.get('expires')) and date(item['expires']) > now]
                statuses.append(dict(name=name, publisher=publisher, url=url, ok=False, count=len(found)))
            for item in found:
                item['publisher'] = publisher
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
