"""Free source downloads and adapters. A failed source never becomes an empty menu."""
import json
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, timedelta

from model import safe_website

CITY_URL = 'https://data.austintexas.gov/resource/ecmv-9xxi.json'
USER_AGENT = 'Austin.chat neighborhood directory (https://austin.chat/contact/)'


def get_json(url, data=None, timeout=90):
    request = urllib.request.Request(url, data=data, headers={'User-Agent': USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.load(response)


def download(cache, bounds, categories, today):
    cache.mkdir(parents=True, exist_ok=True)
    w, s, e, n = bounds
    box = f'{s},{w},{n},{e}'
    parts = [f'nwr["{key}"~"^({"|".join(values)})$"]({box});' for key, values in categories.items() if key not in ('groups', '_comment')]
    query = '[out:json][timeout:180];(' + ''.join(parts) + ');out center tags;'
    error = None
    for attempt in range(2):
        for mirror in ('https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter'):
            try:
                print('Downloading OpenStreetMap:', mirror, flush=True)
                osm = get_json(mirror, urllib.parse.urlencode({'data': query}).encode(), 240)
                if osm.get('remark') or len(osm.get('elements', [])) < 2000:
                    raise ValueError('Incomplete or unexpectedly small Overpass response')
                (cache / 'osm.json').write_text(json.dumps(osm))
                error = None
                break
            except Exception as exc:
                error = exc
                print('Overpass retry:', exc, flush=True)
        if error is None:
            break
        time.sleep(5 * (attempt + 1))
    if error:
        raise RuntimeError('OpenStreetMap refresh failed; keeping published files') from error

    since = (today - timedelta(days=365)).isoformat()
    rows, offset = [], 0
    while True:
        params = {'$where': f"inspection_date >= '{since}T00:00:00'", '$order': 'inspection_date DESC,inspectionid DESC', '$limit': 10000, '$offset': offset}
        batch = get_json(CITY_URL + '?' + urllib.parse.urlencode(params))
        if not isinstance(batch, list):
            raise ValueError('Unexpected City inspection response')
        rows.extend(batch)
        if len(batch) < 10000:
            break
        offset += 10000
        if offset > 100000:
            raise ValueError('City pagination exceeded expected size')
    if len(rows) < 1000:
        raise ValueError('Unexpectedly small City inspection response')
    (cache / 'city-food.json').write_text(json.dumps(rows))
    from overturemaps.core import get_latest_release
    release = get_latest_release()
    print('Downloading Overture Places:', release, flush=True)
    subprocess.run([sys.executable, '-m', 'overturemaps', 'download', f'--bbox={w},{s},{e},{n}', '--type=place', '-f', 'geojson', '--release', release, '-o', str(cache / 'overture.geojson')], check=True, timeout=600)
    (cache / 'release.json').write_text(json.dumps({'release': release}))


def osm_places(data, categories):
    if data.get('remark') or len(data.get('elements', [])) < 2000:
        raise ValueError('Incomplete OpenStreetMap input')
    for element in data['elements']:
        tags = element.get('tags') or {}
        if tags.get('access') == 'private' or any(tags.get(k) == 'yes' for k in ('disused', 'abandoned', 'demolished', 'closed')):
            continue
        if tags.get('shop') in ('vacant', 'no') or tags.get('opening_hours') == 'closed':
            continue
        category = next((values[tags[key]] for key, values in categories.items() if key not in ('groups', '_comment') and tags.get(key) in values), None)
        name = tags.get('name') or tags.get('brand')
        center = element.get('center') or element
        if not category or not name or 'lat' not in center or 'lon' not in center:
            continue
        place = dict(id=element['type'][0] + str(element['id']), name=name.strip(), lng=round(center['lon'], 6), lat=round(center['lat'], 6), category=category,
                     sources={'osm': [element['type'] + '/' + str(element['id'])]})
        if tags.get('addr:housenumber') and tags.get('addr:street'):
            place['address'] = tags['addr:housenumber'] + ' ' + tags['addr:street'] + (' Ste ' + tags['addr:unit'] if tags.get('addr:unit') else '')
        website = safe_website(tags.get('website') or tags.get('contact:website'))
        if website:
            place['website'] = website
        if tags.get('opening_hours'):
            # Preserve the published OSM expression. The planner shows it for
            # review; it does not pretend to interpret holidays/seasonal rules.
            place['opening_hours'] = tags['opening_hours']
        yield place


def city_places(rows):
    latest = {}
    for row in rows:
        facility = row.get('facility_id')
        if facility and row.get('inspection_date', '') > latest.get(facility, {}).get('inspection_date', ''):
            latest[facility] = row
    for facility, row in latest.items():
        try:
            lng, lat = float(row['lng']), float(row['lat'])
        except (KeyError, ValueError, TypeError):
            continue
        if not row.get('restaurant_name'):
            continue
        yield dict(id='aph-' + facility, name=row['restaurant_name'], address=row.get('address', ''), lng=lng, lat=lat,
                   sources={'city': [{'id': facility, 'inspected': row['inspection_date'][:10]}]})


def overture_places(data, categories):
    if len(data.get('features', [])) < 2000:
        raise ValueError('Unexpectedly small Overture response')
    for feature in data['features']:
        props = feature['properties']
        if props.get('operating_status') != 'open' or props.get('confidence', 0) < .95:
            continue
        taxonomy = props.get('taxonomy') or {}
        hierarchy = taxonomy.get('hierarchy') or []
        category = next((categories[key] for key in [taxonomy.get('primary')] + list(reversed(hierarchy)) if key in categories), None)
        # No broad catch-all for offices, residences, individual practitioners,
        # schools or home-based services. Only specifically mapped public types.
        name = (props.get('names') or {}).get('primary')
        address = next((a.get('freeform') for a in props.get('addresses') or [] if a.get('freeform')), None)
        website = next((url for raw in props.get('websites') or [] if (url := safe_website(raw))), None)
        if not category or not name or not address or not website or not re.match(r'^\d', address):
            continue
        if feature['geometry']['type'] != 'Point':
            continue
        lng, lat = feature['geometry']['coordinates'][:2]
        yield dict(id='ov-' + feature['id'], name=name.strip(), address=address.strip(), lng=round(lng, 6), lat=round(lat, 6), category=category, website=website,
                   sources={'overture': [feature['id']]})


def curated_places(root):
    for app, category in [('austin-vintage-guitar', 'Music stores'), ('austin-bike-shops', 'Bike shops'), ('austin-toy-stores', 'Toy stores')]:
        data = json.loads((root / 'apps' / app / 'data.geojson').read_text())
        for feature in data['features']:
            p = feature['properties']
            if re.search(r'\b(closed|closing|former)\b', p.get('status', '') + ' ' + p.get('notes', ''), re.I):
                continue
            website = safe_website(p.get('website'))
            source = safe_website(p.get('source'))
            if not website or not source or feature['geometry']['type'] != 'Point':
                continue
            import hashlib
            identity = app + '|' + p['name'] + '|' + p.get('address', '')
            lng, lat = feature['geometry']['coordinates'][:2]
            yield dict(id='ac-' + hashlib.sha256(identity.encode()).hexdigest()[:16], name=p['name'], lng=lng, lat=lat, category=category, address=p.get('address', ''), website=website, sources={'local': [source]})
