#!/usr/bin/env python3
"""Import a saved public organizer map, location records/pages and artist index.

Usage: python tools/special-events/import-studio-tour.py <source-directory>
The source directory is kept outside the public repository. See README.md.
"""
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]

class Headings(HTMLParser):
    def __init__(self):
        super().__init__(); self.tag = None; self.value = []; self.items = []
    def handle_starttag(self, tag, attrs):
        if tag in ('h1', 'h2'): self.tag = tag; self.value = []
    def handle_data(self, value):
        if self.tag: self.value.append(value)
    def handle_endtag(self, tag):
        if tag == self.tag:
            self.items.append((tag, ''.join(self.value).strip())); self.tag = None

def main():
    source = Path(sys.argv[1])
    markers = json.loads((source / 'markers.json').read_text(encoding='utf8'))
    records = {r['id']: r for r in json.loads((source / 'location-records.json').read_text(encoding='utf8'))}
    participants = json.loads((source / 'participants.json').read_text(encoding='utf8')) if (source / 'participants.json').exists() else {}
    features = []
    for marker in markers:
        record = records[marker['id']]
        raw = (source / f"{marker['id']}.html").read_text(encoding='utf8')
        # Exclude header search previews and the site footer.
        main_html = raw.split('data-elementor-type="single-post"', 1)[1].split('<footer', 1)[0]
        headings = Headings(); headings.feed(main_html)
        number = int(next(text for tag, text in headings.items if tag == 'h1').rstrip('.'))
        if number != int(marker['label']): raise ValueError(f"Map/page number mismatch: {marker['id']}")
        address = next(text for tag, text in headings.items if tag == 'h2')
        if not address or address in ('Get Directions', 'Featured Artists & Art Groups'): raise ValueError(f'Address unavailable: {number}')
        people = participants.get(str(number), [])
        names = list(dict.fromkeys(p['name'] for p in people))
        hosts = [p['name'] for p in people if p.get('kind') == 'host']
        title = hosts[0] + (f' + {len(hosts)-1} hosts' if len(hosts)>1 else '') if hosts else names[0] + (f' + {len(names)-1} more' if len(names)>1 else '') if names else address.split(',')[0]
        category = next((c.removeprefix('location-type-').replace('-', ' ').title() for c in record['class_list'] if c.startswith('location-type-')), 'Studio stop')
        lng, lat = marker['latLang']['lng'], marker['latLang']['lat']
        if not (-98.2 < lng < -97 and 29.8 < lat < 30.8): raise ValueError(f'Unexpected map coordinate: {number}')
        features.append({'type':'Feature','geometry':{'type':'Point','coordinates':[round(lng,7),round(lat,7)]},
            'properties':{'id':str(record['id']),'number':number,'title':title,'address':address,'category':category,
                          'participants':names,'profiles':people,'url':record['link']}})
    features.sort(key=lambda f:f['properties']['number'])
    points=[f['geometry']['coordinates'] for f in features]
    bounds=[[round(min(p[0] for p in points)-.002,7),round(min(p[1] for p in points)-.002,7)],
            [round(max(p[0] for p in points)+.002,7),round(max(p[1] for p in points)+.002,7)]]
    event={'type':'FeatureCollection','id':'austin-studio-tour-2026','title':'Austin Studio Tour 2026',
        'basemap':'stamen-watercolor',
        'dateLabel':'November 14–15 & 21–22, 2026','dates':['2026-11-14','2026-11-15','2026-11-21','2026-11-22'],
        'hours':{'open':'11:00','close':'17:00','label':'11 AM–5 PM · Austin time'},'utcOffset':'-06:00',
        'scheduleNote':'Plan within the tour’s 11 AM–5 PM hours. Artist attendance and individual opening times can vary; check the official stop before going.',
        'source':{'title':'Austin Studio Tour · official directory','url':'https://atxstudiotour.com/explore/?view=map',
                  'datesUrl':'https://atxstudiotour.com/','indexUrl':'https://atxstudiotour.com/index/'},
        'checked':datetime.fromtimestamp((source/'explore.html').stat().st_mtime,timezone.utc).isoformat(), 'bounds':bounds,'features':features}
    output=ROOT/'special-events/data/austin-studio-tour-2026.geojson';output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(event,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(f"Imported {len(features)} stops; {sum(bool(f['properties']['participants']) for f in features)} with named participants; bounds {bounds}")

if __name__ == '__main__': main()
