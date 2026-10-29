"""Geometry, conservative place matching, and the neighborhood menu format.

No network or third-party dependencies. Source evidence is not a guarantee
that a business is open; see README.md for the admission rules.
"""
import math
import re
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher
from urllib.parse import urlparse


def in_ring(point, ring):
    x, y = point
    inside = False
    for a, b in zip(ring, ring[1:] + ring[:1]):
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
    return inside


def polygons(geometry):
    return [geometry['coordinates']] if geometry['type'] == 'Polygon' else geometry['coordinates']


class Neighborhoods:
    def __init__(self, features):
        self.features = features
        self.areas = []
        for feature in features:
            for rings in polygons(feature['geometry']):
                xs, ys = zip(*[(p[0], p[1]) for p in rings[0]])
                self.areas.append((feature['properties'], rings, (min(xs), min(ys), max(xs), max(ys))))
        boxes = [a[2] for a in self.areas]
        self.bounds = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))

    def find(self, lng, lat):
        if not (-180 <= lng <= 180 and -90 <= lat <= 90):
            return None
        for props, rings, (w, s, e, n) in self.areas:
            if w <= lng <= e and s <= lat <= n and in_ring((lng, lat), rings[0]) and not any(in_ring((lng, lat), hole) for hole in rings[1:]):
                return props['id']
        return None


def normalized(text):
    text = unicodedata.normalize('NFKD', text or '').encode('ascii', 'ignore').decode().lower()
    text = text.replace('&', ' and ')
    return re.sub(r'[^a-z0-9]+', ' ', text).strip()


def name_key(text):
    text = re.sub(r'\s*#\s*\d+.*$', '', text or '')
    words = normalized(text).split()
    return ' '.join(w for w in words if w not in {'the', 'llc', 'inc', 'ltd'})


def address_key(text):
    # Keep suite separately: two tenants in one building must not be conflated.
    text = normalized(re.sub(r'#\s*(\w+)', r' suite \1', text or ''))
    text = re.split(r'\baustin\b|\btx\b', text)[0]
    suite = re.search(r'\b(?:suite|ste|unit)\s+(\w+)', text)
    text = re.split(r'\b(?:suite|ste|unit|bldg)\b', text)[0]
    synonyms = {'street':'st', 'avenue':'ave', 'road':'rd', 'boulevard':'blvd', 'lane':'ln', 'drive':'dr', 'parkway':'pkwy', 'highway':'hwy', 'north':'n', 'south':'s', 'east':'e', 'west':'w'}
    return ' '.join(synonyms.get(w, w) for w in text.split()), suite.group(1) if suite else ''


def metres(a, b):
    return math.hypot((a['lng'] - b['lng']) * 96300, (a['lat'] - b['lat']) * 111200)


def match_score(a, b):
    distance = metres(a, b)
    if distance > 250:
        return 0
    x, y = name_key(a['name']), name_key(b['name'])
    if not x or not y:
        return 0
    ax, sa = address_key(a.get('address', ''))
    bx, sb = address_key(b.get('address', ''))
    if sa and sb and sa != sb:
        return 0
    same_address = bool(ax and ax == bx and re.match(r'^\d', ax))
    # Different street numbers at two nearby branches are not duplicates.
    na, nb = re.match(r'^\d+', ax), re.match(r'^\d+', bx)
    if na and nb and na[0] != nb[0]:
        return 0
    similarity = SequenceMatcher(None, x, y).ratio()
    # A branch suffix ("Toy Joy - Downtown") is not another business. Require
    # a multiword shared name and the same address or a very close position.
    wx, wy = set(x.split()), set(y.split())
    subset = (wx <= wy or wy <= wx) and min(len(wx), len(wy)) >= 2 and min(len(x), len(y)) >= 6
    if subset and (same_address or distance <= 35):
        return 2.8 - distance / 1000
    # Hotels/clinics often spell out their names differently in two directories.
    # A shared domain alone is never enough (chains share domains).
    ua, ub = urlparse(a.get('website', '')), urlparse(b.get('website', ''))
    domains_match = ua.hostname and ub.hostname and ua.hostname.removeprefix('www.') == ub.hostname.removeprefix('www.')
    meaningful_words = (wx & wy) - {'austin', 'texas', 'hotel', 'clinic', 'center', 'south', 'north', 'west', 'east', 'and', 'at'}
    if same_address and domains_match and meaningful_words and a.get('category') == b.get('category'):
        return 2.7 - distance / 1000
    if x.replace(' ', '') == y.replace(' ', '') and (same_address or distance <= 65):
        return 3 - distance / 1000
    if same_address and similarity >= .88:
        return 2 + similarity - distance / 1000
    if distance <= 35 and similarity >= .94 and min(len(x), len(y)) >= 6:
        return 1 + similarity
    return 0


class PlaceIndex:
    """Small spatial index; matching still checks names, addresses and distance."""
    def __init__(self, places=()):
        self.cells = defaultdict(list)
        for place in places:
            self.add(place)

    def add(self, place):
        self.cells[(math.floor(place['lng'] * 300), math.floor(place['lat'] * 300))].append(place)

    def match(self, place):
        x, y = math.floor(place['lng'] * 300), math.floor(place['lat'] * 300)
        candidates = [p for dx in (-1, 0, 1) for dy in (-1, 0, 1) for p in self.cells.get((x + dx, y + dy), [])]
        scores = sorted(((match_score(place, p), p) for p in candidates), key=lambda item: item[0], reverse=True)
        # Ambiguous matches between distinct tenants are left separate.
        if not scores or scores[0][0] == 0 or (len(scores) > 1 and scores[1][0] > 0 and scores[0][0] - scores[1][0] < .05):
            return None
        return scores[0][1]


def safe_website(url):
    url = (url or '').strip()
    if re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', url) and not url.startswith(('https://', 'http://')):
        return None
    if url and '://' not in url:
        url = 'https://' + url
    try:
        parsed = urlparse(url)
        if not parsed.hostname or '.' not in parsed.hostname:
            return None
    except ValueError:
        return None
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        return None
    if re.search(r'[\s<>"\x00-\x1f]', url):
        return None
    return url


def merge(target, other):
    for key in ('address', 'website', 'opening_hours'):
        if not target.get(key) and other.get(key):
            target[key] = other[key]
    for source, evidence in other.get('sources', {}).items():
        items = target.setdefault('sources', {}).setdefault(source, [])
        for item in evidence:
            if item not in items:
                items.append(item)
    aliases = set(target.get('aliases', [])) | set(other.get('aliases', []))
    if not other['id'].startswith('aph-'):
        aliases.add(other['id'])
    aliases.discard(target['id'])
    if aliases:
        target['aliases'] = sorted(aliases)


def flattened(data):
    return [p for g in data['groups'] for c in g['categories'] for p in c['places']]


def menu_files(places, neighborhoods, groups, fetched):
    by_hood = defaultdict(lambda: defaultdict(list))
    for place in places:
        by_hood[place['neighborhood']][place['category']].append({k:v for k,v in place.items() if k not in ('category', 'neighborhood') and not k.startswith('_')})
    output = {}
    for feature in neighborhoods.features:
        props = feature['properties']
        found = by_hood[props['id']]
        out_groups = []
        for group, labels in groups.items():
            cats = [{'name': label, 'places': sorted(found[label], key=lambda p: (p['name'].casefold(), p['id']))} for label in labels if found[label]]
            if cats:
                out_groups.append({'name': group, 'categories': cats})
        count = sum(len(c['places']) for g in out_groups for c in g['categories'])
        output[props['id']] = dict(id=props['id'], name=props['name'], fetched=fetched, count=count, groups=out_groups)
    return output
