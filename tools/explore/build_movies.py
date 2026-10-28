"""Public theater showtimes -> main-map Movies layer. No AI, keys or packages."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from html import unescape
import hashlib
import json
import re
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from build import ROOT, ZONE, clean, date, web_url

OUT = ROOT / 'chat/data/explore/movies.geojson'
DAYS = 14
ALAMO = 'https://feeds.drafthouse.com/adcService/showtimes.svc/marketFilms/austin'
VIOLET = 'https://austin.violetcrown.com/cinema/'
BULLOCK = 'https://www.thestoryoftexas.com/calendar/'
# The museum's own footer map link resolves to this building coordinate.
IMAX_VENUE = dict(name='Bullock Museum IMAX', address='1800 Congress Ave., Austin, TX 78701',
                  coordinates=[-97.7390687, 30.280337], tags=['imax'])


def fetch(url, now):
    url += ('&' if '?' in url else '?') + urlencode({'austinchat_refresh': int(now.timestamp())})
    request = Request(url, headers={'User-Agent': 'AustinChatExplore/1.0 (+https://austin.chat/contact/)'})
    with urlopen(request, timeout=30) as response:
        body = response.read(20_000_001)
    if len(body) > 20_000_000:
        raise ValueError('Response too large; refusing a truncated schedule')
    return body.decode('utf-8')


def structured(page):
    def walk(obj):
        if isinstance(obj, dict):
            if '@type' in obj:
                yield obj
            for value in obj.values():
                yield from walk(value)
        elif isinstance(obj, list):
            for value in obj:
                yield from walk(value)
    for raw in re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', page, re.S | re.I):
        yield from walk(json.loads(raw))


def screening(title, venue, start, url, now, *, format='', detail_url=None, conditions='', key=None):
    """Only explicit future starts at known Austin venues; ticket price stays unknown."""
    start = date(start) if isinstance(start, str) else start
    if not start or start <= now or start.astimezone(ZONE).date() >= now.astimezone(ZONE).date() + timedelta(days=DAYS):
        return None
    if not clean(title) or not web_url(url) or not web_url(detail_url or url):
        return None
    try:
        lng, lat = map(float, venue['coordinates'])
    except (KeyError, ValueError, TypeError):
        return None
    if not (-98.05 < lng < -97.4 and 30.0 < lat < 30.65):
        return None
    return dict(title=clean(title), venue=venue['name'], address=venue['address'], coordinates=[lng, lat],
                tags=venue.get('tags', []), start=start.isoformat(), url=url, detailUrl=detail_url or url,
                format=clean(format), conditions=clean(conditions), key=str(key or url))


def alamo_records(payload, now):
    data = payload['data']
    generated = date(data.get('sessionsGenerated'))
    if not generated or now - generated > timedelta(hours=12):
        raise ValueError('Alamo schedule is stale')
    result = []
    for film in data['market']['films']:
        film_url = f'https://drafthouse.com/austin/show/{film["slug"]}'
        for day in film['dates']:
            for cinema in day['cinemas']:
                if cinema.get('timeZoneATE') != 'America/Chicago':
                    continue
                venue = dict(name='Alamo Drafthouse ' + cinema['name'], address=cinema['address'] + ', ' + cinema['city'],
                             coordinates=[cinema['longitude'], cinema['latitude']], tags=['dine-in'])
                for show in cinema['sessions']:
                    if show.get('status') != 'onsale':
                        continue
                    url = show.get('salesURL') or film_url
                    # A film page is the official fallback when the feed has no session booking URL.
                    if urlparse(url).hostname not in ('drafthouse.com', 'www.drafthouse.com', 'tickets.drafthouse.com'):
                        url = film_url
                    conditions = ' · '.join(filter(None, [film.get('rating'), f'{film["runtime"]} min' if film.get('runtime') else '',
                        'Dine-in food and drinks cost extra. Check age policies and ticket availability.']))
                    if show.get('fbSpendRequirement') not in (None, '', '0', 0):
                        conditions += f' Food and beverage minimum: ${show["fbSpendRequirement"]}.'
                    row = screening(film['name'], venue, show['dateTime'], url, now, format=show.get('formatName', ''),
                                    detail_url=film_url, conditions=conditions, key=f'{cinema["id"]}:{show["id"]}')
                    if row:
                        result.append(row)
    if not result:
        raise ValueError('No upcoming Alamo screenings; investigate before replacing the last schedule')
    return result, 0


def alamo(now, previous):
    return alamo_records(json.loads(fetch(ALAMO, now)), now)


def violet_records(page, now, fallback_venue=None):
    nodes = list(structured(page))
    theater = next((n for n in nodes if n.get('@type') == 'MovieTheater' and n.get('geo')), None)
    if theater:
        geo, address = theater['geo'], theater['address']
        venue = dict(name='Violet Crown Austin', address=address['streetAddress'] + ', Austin, TX ' + address['postalCode'],
                     coordinates=[geo['longitude'], geo['latitude']], tags=['dine-in'])
    else:
        venue = fallback_venue
    if not venue:
        raise ValueError('Missing Violet Crown location metadata')
    movies = {n.get('@id'): n for n in nodes if n.get('@type') == 'Movie'}
    result = []
    for event in nodes:
        if event.get('@type') != 'ScreeningEvent':
            continue
        if event.get('eventStatus', '').endswith(('EventCancelled', 'EventPostponed')):
            continue
        offer = event.get('offers') or {}
        if offer.get('availability') not in ('https://schema.org/InStock', 'http://schema.org/InStock'):
            continue
        url = event.get('url', '')
        if urlparse(url).hostname != 'austin.violetcrown.com':
            continue
        movie = movies.get((event.get('workPresented') or {}).get('@id'), {})
        detail = movie.get('sameAs') or url
        row = screening(event['name'], venue, event.get('startDate'), url, now, detail_url=detail,
                        conditions=' · '.join(filter(None, [movie.get('contentRating'), 'Dining and drinks available; charged separately. Check ticket availability.'])))
        if row:
            result.append(row)
    return result, venue


def violet(now, previous):
    page = fetch(VIOLET, now)
    rows, venue = violet_records(page, now)
    # Film pages publish additional ScreeningEvent metadata beyond the short home-page preview.
    urls = sorted(set(unescape(u) for u in re.findall(r'href=["\'](https://austin\.violetcrown\.com/movie/[^"\']+/)["\']', page)))
    if not urls or len(urls) > 60:
        raise ValueError('Unexpected Violet Crown movie index')
    failed = []
    def one(url):
        try:
            return violet_records(fetch(url, now), now, venue)[0]
        except Exception as error:
            print(f'Violet Crown detail unavailable: {url}: {error}', flush=True)
            failed.append(url)
            return []
    with ThreadPoolExecutor(max_workers=3) as pool:
        for found in pool.map(one, urls):
            rows.extend(found)
    if not rows:
        raise ValueError('No upcoming published Violet Crown showtimes')
    # Preserve only failed film pages, without renewing their original expiry.
    cached = [f for f in previous if f['properties']['url'] in failed and valid_cached(f, now)]
    return rows, len(failed), cached


def bullock_page(page, day, now):
    marker = 'window.FWP_JSON = '
    if marker not in page:
        raise ValueError('Missing museum calendar pagination metadata')
    settings = json.JSONDecoder().raw_decode(page.split(marker, 1)[1])[0]
    pager = settings['preload_data']['settings']['pager']
    pages = int(pager['total_pages'])
    if pages > 12:
        raise ValueError('Unexpected number of museum calendar pages')
    rows = []
    cards = re.findall(r'<li\b[^>]*class="[^"]*\btype-showtime\b[^"]*"[^>]*>(.*?)</article>', page, re.S)
    if pager['total_rows'] and not cards:
        raise ValueError('Museum showtime markup changed')
    for card in cards:
        if 'IMAX Theatre' not in clean(card):
            continue  # The adjacent Texas Spirit Theater is not IMAX.
        title = re.search(r'<a[^>]*class="Listing-title-link[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', card, re.S)
        if not title:
            raise ValueError('Missing museum movie title/link')
        url = unescape(title.group(1))
        if urlparse(url).hostname != 'www.thestoryoftexas.com':
            continue
        times = set(re.findall(r'<time[^>]*class="Listing-times-item"[^>]*datetime="([^"]+)"', card))
        if not times:
            raise ValueError('Missing museum screening times')
        for start in times:
            if date(start).astimezone(ZONE).date() != day:
                raise ValueError('Museum calendar date filter did not match the requested day')
            row = screening(clean(title.group(2)), IMAX_VENUE, start, url, now,
                            format='IMAX 3D' if re.search(r'\b3D\b', clean(card)) else 'IMAX',
                            conditions='Tickets sold separately from museum admission. Check the museum for availability and age guidance.')
            if row:
                rows.append(row)
    return rows, pages


def bullock(now, previous):
    rows, failed = [], []
    def one(offset):
        day = now.astimezone(ZONE).date() + timedelta(days=offset)
        try:
            query = dict(_post_type_filter='showtime', _calendar_date_filter=day.strftime('%Y%m%d'), _paged=1)
            found, pages = bullock_page(fetch(BULLOCK + '?' + urlencode(query), now), day, now)
            for page in range(2, pages + 1):
                query['_paged'] = page
                more, _ = bullock_page(fetch(BULLOCK + '?' + urlencode(query), now), day, now)
                found.extend(more)
            return found
        except Exception as error:
            failed.append(day.isoformat())
            print(f'IMAX calendar unavailable for {day}: {error}', flush=True)
            return []
    with ThreadPoolExecutor(max_workers=3) as pool:
        for found in pool.map(one, range(DAYS)):
            rows.extend(found)
    if len(failed) == DAYS:
        raise ValueError('All museum calendar requests failed')
    cached = [f for f in previous if f['properties'].get('day') in failed and valid_cached(f, now)]
    return rows, len(failed), cached


def group(rows, source, now):
    groups = {}
    for row in rows:
        day = date(row['start']).astimezone(ZONE).date().isoformat()
        key = (source, row['venue'], row['title'], day)
        groups.setdefault(key, []).append(row)
    result = []
    for key, rows in groups.items():
        row = rows[0]
        # A session can occur in the page preview and the film's full schedule.
        shows = { (r['start'], r['key']): dict(start=r['start'], url=r['url'], format=r['format']) for r in rows }
        shows = sorted(shows.values(), key=lambda r: (r['start'], r['url']))
        first, last = date(shows[0]['start']), date(shows[-1]['start'])
        fid = 'movie-' + hashlib.sha256('|'.join(key).encode()).hexdigest()[:20]
        p = dict(id=fid, title=row['title'], venue=row['venue'], address=row['address'], kind='movie',
                 price=None, priceLabel='Check ticket price', start=first.isoformat(),
                 end=(last + timedelta(seconds=1)).isoformat(), endKnown=False, day=key[-1],
                 expires=min(last, now + timedelta(hours=12)).isoformat(), checked=now.isoformat(),
                 url=row['detailUrl'], source=source, tags=row['tags'], conditions=row['conditions'], showtimes=shows)
        result.append(dict(type='Feature', id=fid, geometry=dict(type='Point', coordinates=row['coordinates']), properties=p))
    return result


def valid_cached(f, now):
    p = f.get('properties', {})
    expiry = date(p.get('expires'))
    return expiry and expiry > now and any(date(s.get('start')) and date(s['start']) > now for s in p.get('showtimes', []))


def build():
    now = datetime.now(timezone.utc)
    previous = json.loads(OUT.read_text()).get('features', []) if OUT.exists() else []
    sources = [('Alamo Drafthouse', 'https://drafthouse.com/austin', alamo),
               ('Bullock Museum IMAX', BULLOCK, bullock), ('Violet Crown Austin', VIOLET, violet)]
    features, statuses = [], []
    with ThreadPoolExecutor(max_workers=3) as pool:
        jobs = [(name, url, pool.submit(fn, now, [f for f in previous if f['properties']['source'] == name])) for name, url, fn in sources]
        for name, url, job in jobs:
            try:
                output = job.result()
                rows, failures = output[:2]
                items = group(rows, name, now)
                items.extend(output[2] if len(output) > 2 else [])
                ok = True
            except Exception as error:
                print(f'{name}: {error}', flush=True)
                items = [f for f in previous if f['properties']['source'] == name and valid_cached(f, now)]
                ok, failures = False, 1
            features.extend(items)
            statuses.append(dict(name=name, url=url, ok=ok, failures=failures, count=len(items)))
            print(f'{name}: {len(items)} movie/day listings; {failures} failed requests', flush=True)
    if not any(s['ok'] for s in statuses):
        raise RuntimeError('All movie sources failed; preserving the previous snapshot')
    # Prefer freshly checked records when a partial fallback overlaps a successful page.
    unique = {}
    for f in sorted(features, key=lambda f: f['properties']['checked']):
        unique[f['properties']['id']] = f
    features = sorted(unique.values(), key=lambda f: (f['properties']['start'], f['properties']['title']))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(dict(type='FeatureCollection', generated=now.isoformat(), sources=statuses,
                                  features=features), ensure_ascii=False, indent=1) + '\n')
    print(f'Published {len(features)} movie listings / {sum(len(f["properties"]["showtimes"]) for f in features)} showtimes', flush=True)


if __name__ == '__main__':
    build()
