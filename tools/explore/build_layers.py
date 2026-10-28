"""Refresh Austin's public event categories; no AI or keys."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import re
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from build import ROOT, clean, date, web_url
from culture_sources import SOURCES as CULTURE_SOURCES
from comedy_sources import SOURCES as COMEDY_SOURCES
from music_sources import SOURCES as MUSIC_SOURCES
from market_sources import SOURCES as MARKET_SOURCES
from event_sources import SOURCES as MUSEUM_SOURCES
from community_sources import SOURCES as COMMUNITY_SOURCES

EVENT_SOURCES = MUSEUM_SOURCES + COMMUNITY_SOURCES
SOURCES = CULTURE_SOURCES + COMEDY_SOURCES + MUSIC_SOURCES + MARKET_SOURCES + EVENT_SOURCES
COMEDY_NAMES = {name for name, _, _ in COMEDY_SOURCES}
MUSIC_NAMES = {name for name, _, _ in MUSIC_SOURCES}
MARKET_NAMES = {name for name, _, _ in MARKET_SOURCES}
EVENT_NAMES = {name for name, _, _ in EVENT_SOURCES}

OUT = ROOT / 'chat/data/explore'
THEMES = ('pop-up-markets', 'festivals', 'live-comedy', 'live-music', 'events')
DAYS = 14
PARK_DATA = 'https://data.austintexas.gov/resource/v8hw-gz65.json'
PARK_SOURCE = 'https://data.austintexas.gov/d/v8hw-gz65'
PARK_DIRECTORY = 'https://www.austintexas.gov/parks/locations/park-directory'


def fetch(url, now):
    # These public JSON APIs accept their documented parameters only. Unlike
    # the cinema HTML feeds, an arbitrary cache query is not supported.
    request = Request(url, headers={'User-Agent': 'AustinChatExplore/1.0 (+https://austin.chat/contact/)', 'Cache-Control': 'no-cache'})
    with urlopen(request, timeout=30) as response:
        body = response.read(25_000_001)
    if len(body) > 25_000_000:
        raise ValueError('Response exceeds import limit')
    return body.decode('utf-8')


def event_feature(row, source, now):
    """Normalize source facts without inventing admission prices or durations."""
    title, group = clean(row.get('title')), row.get('theme')
    if not title or group not in THEMES or re.search(r'\b(cancelled|canceled|postponed|sold out)\b', title, re.I):
        return None
    start, end = row.get('start'), row.get('end')
    if not start or start >= now + timedelta(days=DAYS) or (end or start) <= now or end and end <= start:
        return None
    try:
        lng, lat = map(float, row['coordinates'])
    except (KeyError, TypeError, ValueError):
        return None
    if not (-98.05 < lng < -97.4 and 30 < lat < 30.65) or not web_url(row.get('url')):
        return None
    # Same occurrence ID as Free & cheap so overlapping UT listings deduplicate.
    key = f'{row["url"]}|{start.isoformat()}'
    if source != 'UT Austin':
        key += '|' + clean(row.get('address'))
    fid = hashlib.sha256(key.encode()).hexdigest()[:20]
    p = dict(id=fid, title=title, venue=clean(row.get('venue')), address=clean(row.get('address')),
             kind='listing', theme=group, start=start.isoformat(), end=(end or start+timedelta(seconds=1)).isoformat(),
             endKnown=bool(end), allDay=bool(row.get('allDay')), checked=now.isoformat(),
             expires=min(end or start, now+timedelta(hours=24)).isoformat(), price=None, priceLabel='Check admission',
             url=row['url'], source=source,
             description=clean(row.get('description'))[:220],
             conditions='Check the organizer for tickets, age limits, admission conditions and schedule changes.'
                        + (' End time not published; listing disappears at its start.' if not end else ''))
    return dict(type='Feature', id=fid, geometry=dict(type='Point', coordinates=[lng,lat]), properties=p)


def load_old(name):
    path = OUT / f'{name}.geojson'
    return json.loads(path.read_text()) if path.exists() else None


def write(name, features, now, sources, **extra):
    OUT.mkdir(parents=True, exist_ok=True)
    payload = dict(type='FeatureCollection', generated=now.isoformat(), sources=sources, features=features, **extra)
    (OUT/f'{name}.geojson').write_text(json.dumps(payload, ensure_ascii=False, indent=1)+'\n')


def retained(features, failed, now):
    return [f for f in features if f['properties'].get('source') in failed
            and date(f['properties'].get('expires')) and date(f['properties']['expires']) > now]


def events(now):
    failed, unique, statuses = set(), {}, []
    # Sequential adapters also serialize address-cache writes for new markets.
    for source, url, adapter in SOURCES:
        try:
            rows = adapter(now)
            fresh = [f for row in rows if (f := event_feature(row, source, now))]
            unique.update((f['id'], f) for f in fresh)
            statuses.append(dict(name=source, url=url, ok=True, failures=0))
            print(f'{source}: {len(fresh)} upcoming listings', flush=True)
        except Exception as error:
            failed.add(source)
            statuses.append(dict(name=source, url=url, ok=False, failures=1))
            print(f'{source}: {error}', flush=True)
    if len(failed) == len(SOURCES):
        raise RuntimeError('All event sources failed; retaining previous category files')
    combined = {}
    event_statuses = []
    for name in THEMES:
        features = [f for f in unique.values() if f['properties']['theme'] == name]
        features += [f for f in retained((load_old(name) or {}).get('features', []), failed, now) if f['id'] not in unique]
        features.sort(key=lambda f: f['properties']['start'])
        sources = [dict(s, count=sum(f['properties']['source'] == s['name'] for f in features)) for s in statuses
                   if (name == 'live-comedy' or s['name'] not in COMEDY_NAMES)
                   and (name == 'live-music' or s['name'] not in MUSIC_NAMES)
                   and (name == 'pop-up-markets' or s['name'] not in MARKET_NAMES)
                   and (name in ('events', 'festivals') or s['name'] not in EVENT_NAMES)]
        write(name, features, now, sources)
        print(f'{name}: {len(features)} listings', flush=True)
        if name in ('events', 'festivals'):
            combined.update((f['id'], f) for f in features)
            event_statuses = sources
    # The old files remain available to previously opened tabs. The new card
    # receives one combined snapshot, including each source's retained items.
    features = sorted(combined.values(), key=lambda f: f['properties']['start'])
    sources = [dict(s, count=sum(f['properties']['source'] == s['name'] for f in features)) for s in event_statuses]
    write('events-festivals', features, now, sources)
    print(f'events-festivals: {len(features)} listings', flush=True)
    if failed:
        raise RuntimeError('Some calendars unavailable: '+', '.join(sorted(failed)))


def inside(point, ring):
    x, y = point
    result = False
    for a, b in zip(ring, ring[1:] + ring[:1]):
        if (a[1] > y) != (b[1] > y) and x < (b[0]-a[0]) * (y-a[1]) / (b[1]-a[1]) + a[0]:
            result = not result
    return result


def area(ring):
    return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(ring,ring[1:]+ring[:1]))) / 2


def park_point(geometry):
    """Choose an interior point in the largest polygon, respecting holes."""
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    polygon = max(polygons, key=lambda p: area(p[0]))
    ring = polygon[0]
    # A scan across the polygon pairs intersections (holes split intervals).
    y = (min(p[1] for p in ring) + max(p[1] for p in ring))/2
    intersections = []
    for boundary in polygon:
        for a,b in zip(boundary,boundary[1:]+boundary[:1]):
            if (a[1] > y) != (b[1] > y):
                intersections.append(a[0] + (y-a[1])*(b[0]-a[0])/(b[1]-a[1]))
    intersections.sort()
    spans = [(b-a, (a+b)/2) for a,b in zip(intersections[::2], intersections[1::2]) if b>a]
    if not spans:
        raise ValueError('Park geometry has no interior span')
    point = [max(spans)[1], y]
    if not inside(point, ring) or any(inside(point, hole) for hole in polygon[1:]):
        raise ValueError('Park marker falls outside the accessible polygon')
    return [round(v, 6) for v in point]


def park_features(rows, now, links=None):
    links = links or {}
    permitted = {'Neighborhood', 'Greenbelt', 'Pocket', 'Pocket Park', 'Metropolitan', 'District', 'Nature Preserve', 'Bark Park', 'Button', 'Button Park', 'Special'}
    unique = {}
    for row in rows:
        if row.get('asset_status') != 'Open' or row.get('park_type') not in permitted or row.get('development_status') == 'Undeveloped':
            continue
        title = clean(row.get('location_name'))
        if not title or not row.get('address') or not row.get('the_geom'):
            continue
        point = park_point(row['the_geom'])
        if not (-98.05 < point[0] < -97.4 and 30.0 < point[1] < 30.65):
            continue
        fid = 'coa-park-' + str(row.get('asset_mgmt_id') or row['objectid'])
        p = dict(id=fid, title=title, venue=title, address=clean(row['address']), kind='park', theme='parks',
                 parkType=row['park_type'], development=row.get('development_status'), checked=now.isoformat(),
                 price=None, priceLabel='Check park hours & fees', url=links.get(title.casefold(), PARK_DIRECTORY),
                 source='City of Austin Parks and Recreation', acreage=row.get('asset_size'),
                 description=f'{row["park_type"]} park · Listed open in the city park inventory.',
                 conditions='Park locations appear in every time view. Check posted hours and closures. Some facilities or parking may charge fees. Marker is inside the park boundary, not necessarily an entrance.')
        f = dict(type='Feature', id=fid, geometry=dict(type='Point', coordinates=point), properties=p)
        if fid not in unique or float(row.get('asset_size') or 0) > float(unique[fid]['properties'].get('acreage') or 0):
            unique[fid] = f
    return sorted(unique.values(), key=lambda f: f['properties']['title'])


def parks(now):
    old = load_old('parks')
    if old and now - date(old['generated']) < timedelta(hours=24):
        print('parks: daily snapshot is current', flush=True)
        return
    rows, offset = [], 0
    while True:
        page = json.loads(fetch(f'{PARK_DATA}?$limit=500&$offset={offset}&$order=objectid', now))
        rows.extend(page)
        if len(page) < 500:
            break
        offset += 500
        if offset > 10000:
            raise ValueError('Unexpected park dataset size')
    links = {}
    try:
        directory = fetch(PARK_DIRECTORY, now)
        for href, title in re.findall(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', directory, re.S):
            url = urljoin(PARK_DIRECTORY, href)
            if url.startswith('https://www.austintexas.gov/'):
                links[clean(title).casefold()] = url
    except Exception as error:
        print(f'Park directory links unavailable; using official directory: {error}', flush=True)
    features = park_features(rows, now, links)
    if len(features) < 100:
        raise ValueError('Unexpectedly small park inventory; keeping previous snapshot')
    write('parks', features, now, [dict(name='City of Austin open data', url=PARK_SOURCE, ok=True, failures=0, count=len(features))],
          timeIndependent=True, refreshHours=24)
    print(f'parks: {len(features)} city park locations', flush=True)


def build():
    # Parks was removed from the menu. Keep its historical snapshot and
    # importer available, but stop requesting an unused city inventory daily.
    events(datetime.now(timezone.utc))


if __name__ == '__main__':
    build()
