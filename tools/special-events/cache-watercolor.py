#!/usr/bin/env python3
"""Cache the licensed historic Watercolor artwork around the Studio Tour.

Four concurrent requests; existing JPEGs are reused. No account or API key.
The archive explicitly permits reuse: https://watercolormaps.collection.cooperhewitt.org/
"""
import concurrent.futures
import json
import math
from pathlib import Path
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'special-events/tiles/stamen-watercolor-austin'
UPSTREAM = 'https://watercolormaps.collection.cooperhewitt.org/tile/watercolor'
PUBLIC = '/special-events/tiles/stamen-watercolor-austin'
# The historic archive has gaps at zoom 15 around the tour's western edge.
# Zoom 14 has complete coverage; MapLibre scales it beneath current labels.
MAX_ZOOM = 14
ATTRIBUTION = ('Map tiles by <a href="https://stamen.com/">Stamen Design</a>, under '
    '<a href="https://creativecommons.org/licenses/by/3.0/">CC BY 3.0</a>. '
    'Data by <a href="https://www.openstreetmap.org/">OpenStreetMap</a>, under '
    '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC BY-SA</a>. '
    'Archived by <a href="https://watercolormaps.collection.cooperhewitt.org/">Cooper Hewitt, Smithsonian Design Museum</a>.')

def tile(lng, lat, zoom):
    scale = 2 ** zoom
    return (math.floor((lng + 180) / 360 * scale),
            math.floor((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * scale))

def fetch(item):
    zoom, x, y = item
    path = OUT / str(zoom) / str(x) / f'{y}.jpg'
    if path.exists():
        data = path.read_bytes()
        if data.startswith(b'\xff\xd8') and data.endswith(b'\xff\xd9'):
            return len(data)
    for attempt in range(4):
        try:
            request = urllib.request.Request(f'{UPSTREAM}/{zoom}/{x}/{y}.jpg',
                headers={'User-Agent': 'Austin.chat-Watercolor-cache/1.0'})
            with urllib.request.urlopen(request, timeout=25) as response:
                data = response.read()
            if not data.startswith(b'\xff\xd8') or not data.endswith(b'\xff\xd9'):
                raise ValueError('Response is not a complete JPEG')
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix('.tmp')
            temporary.write_bytes(data)
            temporary.replace(path)
            return len(data)
        except (OSError, ValueError) as error:
            if attempt == 3:
                raise RuntimeError(f'Could not cache {zoom}/{x}/{y}') from error
            time.sleep(2 ** attempt)

def main():
    event = json.loads((ROOT / 'special-events/data/austin-studio-tour-2026.geojson').read_text())
    (west, south), (east, north) = event['bounds']
    bounds = [round(west-.04, 7), round(south-.04, 7), round(east+.04, 7), round(north+.04, 7)]
    jobs = []
    for zoom in range(MAX_ZOOM + 1):
        left, top = tile(bounds[0], bounds[3], zoom)
        right, bottom = tile(bounds[2], bounds[1], zoom)
        jobs.extend((zoom, x, y) for x in range(left, right+1) for y in range(top, bottom+1))
    print(f'Caching {len(jobs)} Austin tiles through zoom {MAX_ZOOM}.', flush=True)
    total = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for count, size in enumerate(pool.map(fetch, jobs), 1):
            total += size
            if count % 250 == 0:
                print(f'{count}/{len(jobs)} tiles ready ({total / 1024 / 1024:.1f} MiB).', flush=True)
    value = {'tilejson': '3.0.0', 'name': 'Stamen Watercolor — Austin archive',
        'scheme': 'xyz', 'minzoom': 0, 'maxzoom': MAX_ZOOM, 'bounds': bounds,
        'tiles': [PUBLIC + '/{z}/{x}/{y}.jpg'], 'attribution': ATTRIBUTION,
        'description': 'Original 2012–2014 artwork; current labels and tour data are separate overlays.',
        'upstream': UPSTREAM + '/{z}/{x}/{y}.jpg', 'tileCount': len(jobs), 'totalBytes': total}
    (OUT / 'tiles.json').write_text(json.dumps(value, indent=2) + '\n')
    print(f'Complete: {len(jobs)} JPEGs, {total / 1024 / 1024:.1f} MiB. Attribution in tiles.json.', flush=True)

if __name__ == '__main__':
    main()
