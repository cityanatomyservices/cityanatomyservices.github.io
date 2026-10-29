#!/usr/bin/env python3
"""Refresh the neighborhood directory from free public sources."""
import argparse
import json
import os
import tempfile
from collections import Counter
from datetime import date, datetime, timezone
from pathlib import Path

from model import Neighborhoods, PlaceIndex, flattened, menu_files, merge, metres
from sources import city_places, curated_places, download, osm_places, overture_places

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'chat' / 'data'


def read(path):
    return json.loads(path.read_text())


def prior_places(folder):
    places = []
    for path in sorted(folder.glob('*.json')):
        if path.name == 'index.json':
            continue
        data = read(path)
        for group in data['groups']:
            for cat in group['categories']:
                for place in cat['places']:
                    places.append(dict(place, neighborhood=data['id'], category=cat['name']))
    return places


def build(cache, today, previous):
    categories = read(DATA / 'categories.json')
    neighborhoods = Neighborhoods(read(DATA / 'geofences.geojson')['features'])
    previous_by_id = {p['id']: p for p in previous}
    prior_index = PlaceIndex(previous)
    current_index = PlaceIndex()
    current, current_ids, rejected, current_city = [], set(), Counter(), {}
    city_rows = read(cache / 'city-food.json')
    if len(city_rows) < 1000:
        raise ValueError('Incomplete City input')
    latest_inspection = max(r.get('inspection_date', '')[:10] for r in city_rows)
    if (today - date.fromisoformat(latest_inspection)).days > 180:
        raise ValueError('City inspection feed is more than six months old')
    city_index = PlaceIndex(city_places(city_rows))
    groups = categories['groups']
    # New directory food listings need City corroboration, not just an open flag.
    food_categories = set(groups['Food & Drink']) | {'Supermarkets', 'Corner stores', 'Groceries'}
    overrides = read(DATA / 'place-overrides.json')
    excluded = {item['id'] for item in overrides['exclude']}
    corrections = {item['id']: item for item in overrides.get('correct', [])}
    additions, duplicates = Counter(), Counter()
    osm = list(osm_places(read(cache / 'osm.json'), categories))
    overture_data = read(cache / 'overture.geojson')
    overture = list(overture_places(overture_data, read(DATA / 'overture-categories.json')))
    excluded_index = PlaceIndex(p for p in osm + overture if p['id'] in excluded)

    def admit(place, source):
        original_id = place['id']
        if original_id in excluded or excluded_index.match(place):
            rejected['reviewed_exclusion'] += 1
            return
        if original_id in corrections:
            correction = corrections[original_id]
            place.update(correction['values'])
            place['sources'].setdefault('local', []).append(correction['source'])
        hood = neighborhoods.find(place['lng'], place['lat'])
        if not hood:
            rejected[source + '_outside_neighborhoods'] += 1
            return
        place['neighborhood'] = hood
        match = current_index.match(place)
        city = city_index.match(place) if place['category'] in food_categories else None
        if city:
            merge(place, city)
            existing = current_city.get(city['id'])
            if not match and existing and metres(existing, place) <= 250:
                match = existing
        if match:
            merge(match, place)
            if city:
                current_city[city['id']] = match
            duplicates[source] += 1
            return
        if source == 'overture' and place['category'] in food_categories and not city:
            rejected['new_food_without_city_match'] += 1
            return
        old = previous_by_id.get(original_id) or prior_index.match(place)
        if old:
            # Preserve room identities, but do not carry stale source evidence.
            place['id'] = old['id']
            aliases = set(place.get('aliases', [])) | set(old.get('aliases', [])) | {original_id}
            aliases.discard(place['id'])
            if aliases:
                place['aliases'] = sorted(aliases)
        else:
            additions[source] += 1
        if place['id'] in current_ids:
            place['id'] = original_id
            place['aliases'] = [a for a in place.get('aliases', []) if a != original_id]
        current.append(place)
        current_ids.add(place['id'])
        current_index.add(place)
        if city:
            current_city[city['id']] = place

    osm.sort(key=lambda p: (p['id'] not in previous_by_id, p['id']))
    for place in osm:
        admit(place, 'osm')
    for place in curated_places(ROOT):
        admit(place, 'local')
    for place in sorted(overture, key=lambda p: (p['id'] not in previous_by_id, p['id'])):
        admit(place, 'overture')
    fetched = today.isoformat()
    files = menu_files(current, neighborhoods, groups, fetched)
    validate(files, previous)
    old_ids = set(previous_by_id)
    new_ids = {p['id'] for p in current}
    alias_ids = {alias for p in current for alias in p.get('aliases', [])}
    source_counts = Counter(source for p in current for source in p['sources'])
    used_overture_ids = {i for p in current for i in p['sources'].get('overture', [])}
    overture_credits = sorted({(s['dataset'], s['license']) for f in overture_data['features'] if f['id'] in used_overture_ids for s in f['properties']['sources']})
    release_file = cache / 'release.json'
    release = read(release_file)['release'] if release_file.exists() else read(cache / 'overture.geojson.state')['last_release']
    if (today - date.fromisoformat(release[:10])).days > 90:
        raise ValueError('Overture release is more than 90 days old')
    audit = {
        'fetched': fetched, 'previous_total': len(previous), 'total': len(current),
        'added': len(new_ids - old_ids), 'retained_ids': len(old_ids & new_ids),
        'old_ids_redirected': len((old_ids - new_ids) & alias_ids),
        'retired_ids': sorted(old_ids - new_ids - alias_ids),
        'sources': dict(source_counts), 'additions_by_source': dict(additions),
        'merged_candidates': dict(duplicates), 'excluded_candidates': dict(rejected),
        'overture_release': release, 'city_latest_inspection': latest_inspection,
        'categories': dict(sorted(Counter(p['category'] for p in current).items())),
        'neighborhoods': {key: {'before': sum(p['neighborhood'] == key for p in previous), 'after': value['count']} for key, value in files.items()},
        'limitations': 'Source-backed listings, not a guarantee of current opening status. Coverage is limited to the 65 existing City planning-area geofences. New Overture food listings require matching City inspections; other Overture additions require an open flag, confidence >= 0.95, street address, website and a mapped public-facing category.'
    }
    index = {'fetched': fetched, 'source': 'OpenStreetMap, Overture Maps, City of Austin food inspections, Austin.chat shopping guides', 'total': len(current), 'sources': dict(source_counts), 'overture_release': release, 'overture_credits': [{'provider': provider, 'license': license} for provider, license in overture_credits], 'city_latest_inspection': latest_inspection, 'neighborhoods': {key: value['count'] for key, value in files.items()}}
    return files, index, audit


def validate(files, previous):
    places = [p for data in files.values() for p in flattened(data)]
    ids = [p['id'] for p in places]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate business IDs')
    if len(places) < max(2500, len(previous) * .8):
        raise ValueError('Directory would lose more than 20% of listings; refusing to overwrite it')
    for data in files.values():
        if data['count'] != len(flattened(data)):
            raise ValueError('Menu count mismatch')
        before = sum(p['neighborhood'] == data['id'] for p in previous)
        if before >= 20 and data['count'] < before * .6:
            raise ValueError('Unexpected neighborhood loss: ' + data['id'])
        for p in flattened(data):
            if not p['name'].strip() or not p.get('sources'):
                raise ValueError('Missing name or provenance')


def save_json(path, value):
    # Replace complete files only. Git publishes the validated set together.
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False, encoding='utf-8') as temp:
        json.dump(value, temp, ensure_ascii=False, separators=(',', ':'))
        temp.write('\n')
    os.replace(temp.name, path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=Path(tempfile.gettempdir()) / 'austin-places')
    parser.add_argument('--offline', action='store_true', help='Build from downloaded source files')
    parser.add_argument('--output', type=Path, default=DATA / 'places')
    parser.add_argument('--as-of', type=date.fromisoformat, default=datetime.now(timezone.utc).date())
    args = parser.parse_args()
    categories = read(DATA / 'categories.json')
    neighborhoods = Neighborhoods(read(DATA / 'geofences.geojson')['features'])
    if not args.offline:
        download(args.cache, neighborhoods.bounds, categories, args.as_of)
    previous = prior_places(DATA / 'places')
    files, index, audit = build(args.cache, args.as_of, previous)
    args.output.mkdir(parents=True, exist_ok=True)
    for key, data in files.items():
        save_json(args.output / (key + '.json'), data)
    save_json(args.output / 'index.json', index)
    save_json(args.output.parent / 'places-audit.json', audit)
    print(json.dumps({k:v for k,v in audit.items() if k not in ('categories', 'neighborhoods', 'retired_ids', 'limitations')}, indent=2))


if __name__ == '__main__':
    main()
