#!/usr/bin/env python3
"""build.py — the bike shops app's data.geojson from the owner's CSV.

    python3 apps/austin-bike-shops/build.py          (from the repo root)

Reads C:/Dev/austin-bicycle-shops/greater-austin-bicycle-and-ebike-shops-with-contact-info.csv
(the owner's research, 2026-10-22) and writes data.geojson beside this
file. The owner's `type` and `specialties` text is kept whole and also
sorted into the fields the page's dropdowns need: `kind` (Independent /
Chain / Outdoor retailer / E-bike specialist / Nonprofit), `ebikes`
(Yes / No) and `service` (Yes / No). Re-run after the CSV changes, then
bump the `?v=` on `data:` in config.js.
"""
import csv, json, os

CSV = '/mnt/c/Dev/austin-bicycle-shops/greater-austin-bicycle-and-ebike-shops-with-contact-info.csv'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.geojson')


def kind(text):
    low = text.lower()
    if 'e-bike specialist' in low:
        return 'E-bike specialist'
    if 'nonprofit' in low:
        return 'Nonprofit'
    if 'outdoor retail' in low:
        return 'Outdoor retailer'
    if 'chain' in low:
        return 'Chain'
    return 'Independent'


def yes_no(found):
    return 'Yes' if found else 'No'


with open(CSV, encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))
features = []
for r in rows:
    t, sp = r['type'].strip(), r['specialties'].strip()
    low = (t + ' ' + sp).lower()
    features.append({'type': 'Feature', 'properties': {
        'name': r['name'].strip(), 'kind': kind(t), 'ebikes': yes_no('e-bike' in low or 'ebike' in low),
        'service': yes_no('service' in low or 'repair' in low),
        'type': t, 'specialties': sp, 'general_area': r['general_area'].strip(), 'address': r['address'].strip(),
        'city': r['city'].strip(), 'phone': r['phone'].strip(), 'website': r['website'].strip(),
        'status': r['verification_status'].strip(), 'notes': r['notes'].strip(),
        'source': r['source_urls'].split(';')[0].split(' | ')[0].strip()},
        'geometry': {'type': 'Point', 'coordinates': [float(r['longitude']), float(r['latitude'])]}})
out = {'type': 'FeatureCollection', 'name': 'greater-austin-bicycle-and-ebike-shops',
       'description': 'Greater Austin bicycle and e-bike shops, owner research (C:/Dev/austin-bicycle-shops/...-with-contact-info.csv), built by build.py. '
                      '`kind`, `ebikes` and `service` are sorted from the owner\'s type and specialties text (kept whole). Pins: OSM objects or address geocodes, not verified entrances.',
       'features': features}
with open(OUT, 'w') as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
    f.write('\n')
print(len(features), 'places written to', OUT)
