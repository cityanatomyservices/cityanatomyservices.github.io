#!/usr/bin/env python3
"""fetch-places.py — the businesses in each neighborhood, from OpenStreetMap.

    python3 tools/fetch-places.py          (from the repo root, in WSL)

Reads chat/data/geofences.geojson (the 65 neighborhoods) and
chat/data/categories.json (which OSM shop / amenity / leisure values to
keep, and the label each gets on the card). Asks the Overpass API for every
such place inside the neighborhoods' bounding box, works out which
neighborhood each one is in (point in polygon, the same test as
chat/locate.js), and writes one small file per neighborhood:

    chat/data/places/<neighborhood id>.json   by group, then category, places sorted by name
    chat/data/places/index.json               when it ran and how many it kept

The chat map loads a neighborhood's file when you walk into it. Nothing else
reads these files. Re-run after editing categories.json or whenever the
list should be refreshed; the files are deterministic apart from the date.

Data: © OpenStreetMap contributors, ODbL 1.0 (keep the credit on the card).
Plain python3 — urllib and json only, no QGIS, no shapely.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GEOFENCES = os.path.join(ROOT, 'chat', 'data', 'geofences.geojson')
CATEGORIES = os.path.join(ROOT, 'chat', 'data', 'categories.json')
OUT = os.path.join(ROOT, 'chat', 'data', 'places')

# Two public Overpass mirrors; the first is usually the quicker one
# (same pattern as C:\GISData\scripts\fetch_energy_water.py).
MIRRORS = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
]


def overpass(query):
    """POST the query to a mirror; three rounds over the mirrors, waiting longer each time."""
    body = urllib.parse.urlencode({'data': query}).encode()
    last = None
    for attempt in range(3):
        for url in MIRRORS:
            try:
                print(f'  asking {url} (try {attempt + 1})', flush=True)
                req = urllib.request.Request(url, data=body, headers={
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'austin.chat fetch-places/1.0 (anatomy.city)',
                })
                with urllib.request.urlopen(req, timeout=600) as r:
                    return json.load(r)
            except Exception as e:          # a busy mirror: try the next one
                last = e
                print(f'  failed: {e}', flush=True)
        time.sleep(10 * (attempt + 1))
    raise SystemExit(f'Overpass did not answer: {last}')


def in_ring(pt, ring):
    """True when [lng, lat] is inside the ring — a copy of inRing in chat/locate.js."""
    x, y = pt
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def outer_rings(geometry):
    """The outer ring of each polygon in a Polygon or MultiPolygon."""
    if geometry['type'] == 'Polygon':
        return [geometry['coordinates'][0]]
    return [poly[0] for poly in geometry['coordinates']]


def bbox(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return min(xs), min(ys), max(xs), max(ys)


def main():
    with open(GEOFENCES) as f:
        neighborhoods = json.load(f)['features']
    with open(CATEGORIES) as f:
        categories = json.load(f)
    categories.pop('_comment', None)
    groups = categories.pop('groups', {})          # heading -> [label, ...], in card order

    # each neighborhood: its rings with a bounding box, so most points are
    # ruled out by four comparisons before the ring test
    areas = []
    for n in neighborhoods:
        rings = [(ring, bbox(ring)) for ring in outer_rings(n['geometry'])]
        areas.append((n['properties'], rings))

    def find_neighborhood(pt):
        for props, rings in areas:
            for ring, (w, s, e, nn) in rings:
                if w <= pt[0] <= e and s <= pt[1] <= nn and in_ring(pt, ring):
                    return props
        return None

    # the region: the box around all 65 neighborhoods
    w = min(b[0] for _, rings in areas for _, b in rings)
    s = min(b[1] for _, rings in areas for _, b in rings)
    e = max(b[2] for _, rings in areas for _, b in rings)
    n = max(b[3] for _, rings in areas for _, b in rings)
    box = f'{s},{w},{n},{e}'

    # the query: every shop, plus only the amenity / leisure values listed
    parts = [f'nwr["shop"]({box});']
    for key in categories:
        if key == 'shop':
            continue
        values = '|'.join(categories[key].keys())
        parts.append(f'nwr["{key}"~"^({values})$"]({box});')
    query = '[out:json][timeout:180];(' + ''.join(parts) + ');out center tags;'
    print('Overpass query over', box)
    data = overpass(query)
    elements = data.get('elements', [])
    print(f'  {len(elements)} elements received')

    # sort every element into a neighborhood and a category
    by_neighborhood = {}          # id -> {label -> [place...]}
    unmapped = Counter()
    kept = 0
    for el in elements:
        tags = el.get('tags') or {}
        name = tags.get('name') or tags.get('brand')
        if not name:
            continue
        label = None
        for key in categories:
            value = tags.get(key)
            if value and value in categories[key]:
                label = categories[key][value]
                break
        if label is None:
            if tags.get('shop'):
                unmapped[tags['shop']] += 1
            continue
        center = el.get('center') or el
        if 'lat' not in center:
            continue
        pt = (center['lon'], center['lat'])
        hood = find_neighborhood(pt)
        if hood is None:
            continue
        place = {
            'id': el['type'][0] + str(el['id']),           # n123 / w123 / r123: traceable to OSM
            'name': name,
            'lng': round(pt[0], 5),
            'lat': round(pt[1], 5),
        }
        if tags.get('addr:housenumber') and tags.get('addr:street'):
            place['address'] = tags['addr:housenumber'] + ' ' + tags['addr:street']
        by_neighborhood.setdefault(hood['id'], {}).setdefault(label, []).append(place)
        kept += 1
    print(f'  {kept} places kept inside the neighborhoods')

    # the card's order: the groups in categories.json order, each with its
    # labels in the order listed there; a label in no group goes under Other
    group_of = {label: g for g, labels in groups.items() for label in labels}
    order = {g: list(labels) for g, labels in groups.items()}
    for key in categories:
        for label in categories[key].values():
            if label not in group_of:
                group_of[label] = 'Other'
                order.setdefault('Other', []).append(label)

    # write: one file per neighborhood (every neighborhood gets one, even if empty)
    os.makedirs(OUT, exist_ok=True)
    for old in os.listdir(OUT):
        if old.endswith('.json'):
            os.remove(os.path.join(OUT, old))
    today = date.today().isoformat()
    counts = {}
    for props, _ in areas:
        found = by_neighborhood.get(props['id'], {})
        out_groups = []
        for g, labels in order.items():
            cats = []
            for label in labels:
                if label in found:
                    places = sorted(found[label], key=lambda p: p['name'].lower())
                    cats.append({'name': label, 'places': places})
            if cats:
                out_groups.append({'name': g, 'categories': cats})
        count = sum(len(c['places']) for g in out_groups for c in g['categories'])
        counts[props['id']] = count
        out = {'id': props['id'], 'name': props['name'], 'fetched': today, 'count': count, 'groups': out_groups}
        with open(os.path.join(OUT, props['id'] + '.json'), 'w') as f:
            json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump({'fetched': today, 'source': 'OpenStreetMap via Overpass (ODbL)', 'total': kept,
                   'neighborhoods': counts}, f, indent=1)

    for hood_id, count in sorted(counts.items(), key=lambda kv: -kv[1])[:10]:
        print(f'  {count:5d}  {hood_id}')
    print('  ... written to chat/data/places/')
    if unmapped:
        print('shop values not in categories.json (count): ' +
              ', '.join(f'{v} {c}' for v, c in unmapped.most_common(25)))


if __name__ == '__main__':
    sys.exit(main())
