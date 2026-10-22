#!/usr/bin/env python3
"""build.py — the toy stores app's data.geojson from the owner's CSV.

    python3 apps/austin-toy-stores/build.py          (from the repo root)

Reads C:/Dev/austin-toy-stores/greater-austin-toy-stores-and-childrens-retailers-with-contact-info.csv
(the owner's research, 2026-10-22) and writes data.geojson beside this
file. The owner's `type` and `specialties` text is kept whole and also
sorted into the fields the page's dropdowns need: `kind` (Independent /
local, Chain, LEGO), `focus` (LEGO, Educational / STEM, Collectibles,
Plush, Games & puzzles, General toys) and `stock` (New / New and used).
Re-run after the CSV changes, then bump the `?v=` on `data:` in config.js.
"""
import csv, json, os

CSV = '/mnt/c/Dev/austin-toy-stores/greater-austin-toy-stores-and-childrens-retailers-with-contact-info.csv'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.geojson')


def kind(text):
    low = text.lower()
    if 'lego' in low:
        return 'LEGO'
    if 'chain' in low or 'brand-owned' in low or 'department-store' in low:
        return 'Chain'
    return 'Independent / local'


def focus(text):
    low = text.lower()
    for words, label in [(('lego', 'brick', 'minifigure'), 'LEGO'),
                         (('educational', 'stem', 'science', 'teaching'), 'Educational / STEM'),
                         (('collectible', 'action figure', 'vintage'), 'Collectibles'),
                         (('plush', 'stuffed'), 'Plush'),
                         (('game', 'puzzle'), 'Games & puzzles')]:
        if any(w in low for w in words):
            return label
    return 'General toys'


with open(CSV, encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))
features = []
for r in rows:
    t, sp = r['type'].strip(), r['specialties'].strip()
    low = (t + ' ' + sp).lower()
    features.append({'type': 'Feature', 'properties': {
        'name': r['name'].strip(), 'kind': kind(t), 'focus': focus(sp),
        'stock': 'New and used' if ('used' in low or 'vintage' in low or 'resale' in low) else 'New',
        'type': t, 'specialties': sp, 'general_area': r['general_area'].strip(), 'address': r['address'].strip(),
        'city': r['city'].strip(), 'phone': r['phone'].strip(), 'website': r['website'].strip(),
        'status': r['verification_status'].strip(), 'notes': r['notes'].strip(),
        'source': r['source_urls'].split(';')[0].split(' | ')[0].strip()},
        'geometry': {'type': 'Point', 'coordinates': [float(r['longitude']), float(r['latitude'])]}})
out = {'type': 'FeatureCollection', 'name': 'greater-austin-toy-stores-and-childrens-retailers',
       'description': 'Greater Austin toy stores and children\'s retailers, owner research (C:/Dev/austin-toy-stores/...-with-contact-info.csv), built by build.py. '
                      '`kind`, `focus` and `stock` are sorted from the owner\'s type and specialties text (kept whole). Pins: OSM objects or address geocodes, not verified entrances.',
       'features': features}
with open(OUT, 'w') as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
    f.write('\n')
print(len(features), 'places written to', OUT)
