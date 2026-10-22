#!/usr/bin/env python3
"""build.py — the horseback riding app's data.geojson from the owner's CSV.

    python3 apps/austin-horseback-riding/build.py          (from the repo root)

Reads C:/Dev/austin-horseback-riding/austin-area-horseback-riding-with-contact-info.csv
(the owner's research, 2026-10-22) and writes data.geojson beside this
file. The owner's `type_of_riding` text is kept whole (`types`) and also
sorted into three fields the page's dropdowns need: `riding` (Trail rides
/ Lessons & training / Therapeutic riding), `style` (English / Western /
both / Not stated) and `camps` (Yes / No). Re-run after the CSV changes,
then bump the `?v=` on `data:` in config.js.
"""
import csv, json, os, re

CSV = '/mnt/c/Dev/austin-horseback-riding/austin-area-horseback-riding-with-contact-info.csv'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.geojson')


def riding(text):
    low = text.lower()
    if 'adaptive' in low or 'therapeutic' in low:
        return 'Therapeutic riding'
    if re.search(r'trail|ranch riding|resort|sunset|family rides', low):
        return 'Trail rides'
    return 'Lessons & training'


def style(text):
    low = text.lower()
    english = bool(re.search(r'english|hunter|jumper|dressage|saddle-seat|eventing|cross-country', low))
    western = 'western' in low
    if english and western:
        return 'English and Western'
    return 'English' if english else 'Western' if western else 'Not stated'


rows = list(csv.DictReader(open(CSV, encoding='utf-8-sig')))
features = []
for r in rows:
    t = r['type_of_riding'].strip()
    features.append({'type': 'Feature', 'properties': {
        'name': r['name'].strip(), 'riding': riding(t), 'style': style(t), 'camps': 'Yes' if 'camp' in t.lower() else 'No',
        'types': t, 'general_area': r['general_area'].strip(), 'address': r['address'].strip(), 'city': r['city'].strip(),
        'phone': r['phone'].strip(), 'website': r['website'].strip(), 'notes': r['notes'].strip(),
        'source': r['source_urls'].split(';')[0].split(' | ')[0].strip()},
        'geometry': {'type': 'Point', 'coordinates': [float(r['longitude']), float(r['latitude'])]}})
out = {'type': 'FeatureCollection', 'name': 'austin-area-horseback-riding',
       'description': 'Austin-area horseback riding, owner research (C:\\Dev\\austin-horseback-riding\\...-with-contact-info.csv), built by build.py. '
                      '`riding`, `style` and `camps` are sorted from the owner\'s type_of_riding text (kept whole in `types`). Pins are approximate, not arena entrances.',
       'features': features}
with open(OUT, 'w') as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
    f.write('\n')
print(len(features), 'places written to', OUT)
