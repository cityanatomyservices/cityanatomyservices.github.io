#!/usr/bin/env python3
"""Add public profile filters and per-location opening hours to the existing tour.

Usage: python3 tools/special-events/enrich-studio-tour.py <external-cache> [--fetch]
Raw organizer downloads stay outside the repository. Pins/chat zones are preserved.
"""
import argparse
import concurrent.futures
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
URL = 'https://atxstudiotour.com'
FACETS = [('mediums', 'Art mediums'), ('activities', 'Activities'),
          ('location-vibe', 'Overall vibe'), ('ada-accessibility', 'Accessibility'),
          ('groups-highlighted', 'Communities highlighted'),
          ('space_availability', 'Indoor / outdoor'), ('post_type', 'Participants'),
          ('content_suitability', 'Family-friendly')]
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

class Node:
    def __init__(self, tag, attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []
    def text(self):
        if self.tag in ('script', 'style'): return ''
        return re.sub(r'\s+', ' ', ' '.join(c.text() if isinstance(c, Node) else c for c in self.children)).strip()
    def nodes(self):
        yield self
        for child in self.children:
            if isinstance(child, Node): yield from child.nodes()

class DOM(HTMLParser):
    def __init__(self, raw):
        super().__init__(convert_charrefs=True)
        self.root = Node('document'); self.stack = [self.root]; self.feed(raw)
    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs, self.stack[-1]); self.stack[-1].children.append(node)
        if tag not in VOID: self.stack.append(node)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i].tag == tag: self.stack = self.stack[:i]; break
    def handle_data(self, value): self.stack[-1].children.append(value)

def get(url):
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(request, timeout=40) as response:
                return response.read(), dict(response.headers)
        except OSError:
            if attempt == 3: raise
            time.sleep(2**attempt)

def fetch(cache):
    cache.mkdir(parents=True, exist_ok=True); (cache/'pages').mkdir(exist_ok=True)
    (cache/'explore.html').write_bytes(get(URL+'/explore/')[0])
    fields = 'id,type,link,title,modified_gmt,' + ','.join(k for k, _ in FACETS if k != 'post_type')
    records = []
    for kind in ('art', 'groups', 'host', 'location'):
        endpoint = f'{URL}/wp-json/wp/v2/{kind}?per_page=100&_fields={fields}'
        raw, headers = get(endpoint); rows = json.loads(raw)
        pages = int(next(v for k,v in headers.items() if k.lower() == 'x-wp-totalpages'))
        for page in range(2, pages+1): rows.extend(json.loads(get(endpoint+f'&page={page}')[0]))
        records.extend(rows); print(f'{kind}: {len(rows)} public records', flush=True)
    (cache/'records.json').write_text(json.dumps(records))
    profiles = [r for r in records if r['type'] != 'location']
    def page(record):
        # --fetch explicitly refreshes every public profile, including changed hours.
        (cache/'pages'/f"{record['id']}.html").write_bytes(get(record['link'])[0])
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for count, _ in enumerate(pool.map(page, profiles), 1):
            if count % 100 == 0: print(f'{count}/{len(profiles)} profiles downloaded', flush=True)
    (cache/'checked.txt').write_text(datetime.now(timezone.utc).isoformat(timespec='seconds'))

def filter_options(raw):
    values = {key: {} for key, _ in FACETS}
    for node in DOM(raw).root.nodes():
        a = node.attrs
        if node.tag == 'input' and a.get('name') in values and a.get('data-label'):
            values[a['name']][a['value']] = a['data-label']
    if any(not options for options in values.values()): raise ValueError('An organizer filter group is missing')
    return values

def clock(value):
    match = re.fullmatch(r'(\d{1,2})(?::(\d{2}))?\s*([ap])m', value.strip(), re.I)
    if not match: return None
    hour, minute, half = int(match[1]), int(match[2] or 0), match[3].lower()
    if not 1 <= hour <= 12 or minute > 59: return None
    return f'{hour % 12 + (12 if half == "p" else 0):02}:{minute:02}'

def opening(text, event):
    """Parse only the displayed Open section; incomplete/invalid times stay unknown."""
    text = re.sub(r'^Open\s*', '', text).strip()
    result = {'status': 'unknown', 'days': {}, 'text': text or 'Opening schedule not published.'}
    if text.startswith('All Tour Dates'):
        # Check the published time range instead of silently borrowing event defaults.
        times = re.findall(r'\b\d{1,2}(?::\d{2})?\s*[ap]m\b', text, re.I)
        if len(times) == 2 and all(clock(t) for t in times) and clock(times[0]) < clock(times[1]):
            result.update(status='published', days={d: [{'open': clock(times[0]), 'close': clock(times[1])}] for d in event['dates']})
        return result
    headings = list(re.finditer(r'(?:Saturday,?\s*|Sunday,?\s*)?Nov\.?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*[-–]\s*(\d{1,2})(?:st|nd|rd|th)?)?\s*\|', text, re.I))
    for index, match in enumerate(headings):
        body = text[match.end():headings[index+1].start() if index+1 < len(headings) else len(text)]
        times = re.findall(r'\b\d{1,2}(?::\d{2})?\s*[ap]m\b', body, re.I)
        windows = []
        if len(times) == 2:
            start, end = map(clock, times)
            if start and end and (end > start or end < '05:00') and end != start:
                windows = [{'open': start, 'close': end, **({'nextDay': True} if end < start else {})}]
        for number in range(int(match[1]), int(match[2] or match[1])+1):
            date = f'{event["dates"][0][:4]}-11-{number:02}'
            if date not in event['dates']: raise ValueError(f'Unexpected organizer date: {text}')
            result['days'][date] = windows
    if headings: result['status'] = 'published'
    return result

def locations(raw, event):
    marker = raw.find('data-elementor-type="single-post"')
    if marker < 0: raise ValueError('Missing public profile content')
    start = raw.rfind('<', 0, marker); end = raw.find('<footer', marker)
    raw = raw[start:end if end >= 0 else len(raw)]
    main = next((n for n in DOM(raw).root.nodes() if n.attrs.get('data-elementor-type') == 'single-post'), None)
    if main is None: raise ValueError('Missing public profile content')
    current = None; found = {}; by_url = {f['properties']['url']: f['properties']['number'] for f in event['features']}
    for node in main.nodes():
        if node.tag == 'a' and '/location/' in node.attrs.get('href', ''):
            text = node.text().rstrip('.')
            number = int(text) if text.isdigit() else by_url.get(node.attrs['href'])
            if number:
                current = number; found.setdefault(number, opening('', event))
        if node.tag in ('h3', 'h4', 'h5', 'h6') and node.text() == 'Open' and current:
            found[current] = opening(node.parent.parent.text(), event)
    return found

def enrich(event, cache):
    options = filter_options((cache/'explore.html').read_text())
    records = json.loads((cache/'records.json').read_text())
    stops = {f['properties']['number']: f['properties'] for f in event['features']}
    # The organizer index links some profiles whose own Location/Open sections
    # are empty. Preserve that established location, but never invent its hours.
    index_locations = {}
    for number, stop in stops.items():
        for profile in stop.get('profiles', []): index_locations.setdefault(profile['url'], []).append(number)
    for stop in stops.values(): stop['profiles'] = []
    unknown, partial, mapped = 0, 0, 0
    for record in records:
        if record['type'] == 'location': continue
        facets = {}
        for key, _ in FACETS:
            ids = [record['type']] if key == 'post_type' else record.get(key, [])
            # Store only the public filter labels the Explore page actually offers.
            facets[key] = [options[key][str(value)] for value in ids if str(value) in options[key]]
        name = DOM(record['title']['rendered']).root.text()
        published = locations((cache/'pages'/f"{record['id']}.html").read_text(), event)
        if not published: published = {number: opening('', event) for number in index_locations.get(record['link'], [])}
        for number, availability in published.items():
            if number not in stops: continue
            stops[number]['profiles'].append({'id': str(record['id']), 'name': name, 'url': record['link'],
                'kind': {'art':'artists','host':'host','groups':'groups'}[record['type']],
                'facets': facets, 'availability': availability})
            mapped += 1; unknown += availability['status'] == 'unknown'
            partial += any(not hours for hours in availability['days'].values())
    for stop in stops.values():
        stop['profiles'].sort(key=lambda p:p['name'].casefold())
        stop['participants'] = list(dict.fromkeys(p['name'] for p in stop['profiles']))
    event['filters'] = [{'key':key, 'label':label, 'options':list(choices.values()),
                        'match':'all' if key == 'ada-accessibility' else 'any'}
                       for key,label in FACETS for choices in [options[key]]]
    event['availabilityChecked'] = (cache/'checked.txt').read_text().strip()
    event['availabilitySource'] = URL+'/explore/'
    event['scheduleNote'] = 'Choose a day to see listed participants and their published hours. Some schedules need checking; individual artists at the same stop can attend on different days.'
    return {'stops':len(stops), 'profileLocations':mapped, 'unknownSchedules':unknown,
            'incompleteSchedules':partial, 'stopsWithoutProfiles':sum(not s['profiles'] for s in stops.values())}

def main():
    parser = argparse.ArgumentParser(description=__doc__); parser.add_argument('cache', type=Path); parser.add_argument('--fetch', action='store_true')
    args = parser.parse_args()
    if args.cache.resolve().is_relative_to(ROOT): raise SystemExit('Keep raw source downloads outside the public repository.')
    if args.fetch: fetch(args.cache)
    path = ROOT/'special-events/data/austin-studio-tour-2026.geojson'; event = json.loads(path.read_text())
    result = enrich(event, args.cache)
    path.write_text(json.dumps(event, indent=2, ensure_ascii=False)+'\n')
    print(json.dumps(result, indent=2))

if __name__ == '__main__': main()
