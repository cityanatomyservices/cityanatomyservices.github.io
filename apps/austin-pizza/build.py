#!/usr/bin/env python3
"""build.py — the pizza app's data.geojson from the owner's CSV.

    python3 apps/austin-pizza/build.py          (from the repo root)

Reads C:/Dev/austin-pizza/austin-pizza-restaurants-deep-research.csv (the
owner's research, 2026-10-22: 194 Austin-address places serving pizza,
with Austin Public Health inspection scores, Reddit and Austin Monthly
notes) and writes data.geojson beside this file. The owner's text is kept
whole; four fields are sorted from it for the page's dropdowns: `kind`
(Chain / Pizzeria / Bar, brewery or restaurant / Counter or trailer),
`style` (Detroit, Neapolitan or wood-fired, New York, Sicilian or deep
pan, Sourdough, Thin crust, Other, Not stated), `score` (the health score
in bands) and `area` (the owner's general area). Re-run after the CSV
changes, then bump the `?v=` on `data:` in config.js.
"""
import csv, json, os

CSV = '/mnt/c/Dev/austin-pizza/austin-pizza-restaurants-deep-research.csv'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data.geojson')
NO_REDDIT = 'No venue-specific discussion identified in reviewed threads.'
NO_MAG = 'No coverage identified in the reviewed local-magazine sources.'


def kind(text):
    low = text.lower()
    if 'chain' in low or 'concession' in low:
        return 'Chain'
    if any(w in low for w in ('trailer', 'truck', 'stand', 'counter', 'food-hall', 'food-court', 'grocery')):
        return 'Counter or trailer'
    if any(w in low for w in ('brewery', 'brewpub', 'bar', 'arcade', 'cafe', 'italian restaurant', 'restaurant /')):
        return 'Bar, brewery or restaurant'
    return 'Pizzeria'


def style(text):
    low = text.lower()
    if low in ('', 'not verified'):
        return 'Not stated'
    for words, label in [(('detroit',), 'Detroit'), (('neapolitan', 'wood-fired', 'coal-fired'), 'Neapolitan or wood-fired'),
                         (('new york', 'jersey', 'grandma'), 'New York'), (('sicilian', 'roman', 'deep', 'chicago'), 'Sicilian or deep pan'),
                         (('sourdough',), 'Sourdough'), (('thin',), 'Thin crust')]:
        if any(w in low for w in words):
            return label
    return 'Other'


def score_band(s):
    if not s:
        return 'No score matched'
    n = int(s)
    return '90 to 100' if n >= 90 else '80 to 89' if n >= 80 else 'Below 80'


with open(CSV, encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))
features = []
for r in rows:
    g = lambda k: r.get(k, '').strip()
    health = (g('health_score') + ' (' + g('health_inspection_date') + ')') if g('health_score') else ''
    features.append({'type': 'Feature', 'properties': {
        'name': g('name'), 'kind': kind(g('type')), 'style': style(g('pizza_style')), 'score': score_band(g('health_score')),
        'area': g('general_area'), 'type': g('type'), 'pizza_style': g('pizza_style'), 'website_says': g('website_says'),
        'address': g('address'), 'phone': g('phone'), 'website': g('website'), 'health': health,
        'health_url': g('health_source_url'),
        'reddit': '' if g('reddit_notes') == NO_REDDIT else g('reddit_notes'), 'reddit_url': g('reddit_source_urls').split(';')[0].strip(),
        'magazine': '' if g('local_magazine_coverage') == NO_MAG else g('local_magazine_coverage'),
        'magazine_url': g('local_magazine_source_urls').split(';')[0].strip(),
        'status': g('verification_status'), 'notes': g('notes')},
        'geometry': {'type': 'Point', 'coordinates': [float(r['longitude']), float(r['latitude'])]}})
out = {'type': 'FeatureCollection', 'name': 'austin-pizza-restaurants',
       'description': 'Austin places serving pizza, owner research 2026-10-22 (C:/Dev/austin-pizza/austin-pizza-restaurants-deep-research.csv), built by build.py. '
                      '`kind`, `style`, `score` and `area` are sorted from the owner\'s text (kept whole). Health scores are dated Austin Public Health inspection scores (data.austintexas.gov ecmv-9xxi), not food ratings; blank means no confident match. Pins are approximate.',
       'features': features}
with open(OUT, 'w') as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
    f.write('\n')
print(len(features), 'places written to', OUT)
