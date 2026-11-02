#!/usr/bin/env python3
"""Public City of Austin snapshots. Standard library only; no accounts or keys."""
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlencode, urljoin, urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo
import hashlib
import json
import re
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'chat/data/city-hall.json'
CITY = 'https://www.austintexas.gov'
TZ = ZoneInfo('America/Chicago')


class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def find(self, tag=None, cls=None):
        found = []
        for child in self.children:
            if isinstance(child, Node):
                if (tag is None or child.tag == tag) and (cls is None or cls in child.attrs.get('class', '').split()):
                    found.append(child)
                found.extend(child.find(tag, cls))
        return found

    def text(self):
        return ' '.join(' '.join(c.text() if isinstance(c, Node) else c for c in self.children).split())


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break

    def handle_data(self, value):
        self.stack[-1].children.append(value)


def fetch(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Austin.chat City Hall public data (+https://austin.chat/contact/)'}), timeout=40) as response:
                return response.read().decode('utf-8')
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))


def date(value):
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    return parsed.replace(tzinfo=TZ) if parsed.tzinfo is None else parsed.astimezone(TZ)


def official_url(value):
    if isinstance(value, dict):
        value = value.get('url', '')
    value = urljoin(CITY, value or '')
    host = urlparse(value).hostname or ''
    if urlparse(value).scheme not in {'http', 'https'} or not (host == 'austintexas.gov' or host.endswith('.austintexas.gov')):
        raise ValueError('Non-city source URL')
    return value.replace('http://', 'https://', 1)


def districts(value):
    return sorted(set(re.findall(r'(?<!\d)(10|[1-9])(?:\.0)?(?!\d)', str(value or ''))), key=int)


def record(category, title, when, url, **fields):
    if not title or not when:
        raise ValueError('Missing title or date')
    url = official_url(url)
    return dict(id=hashlib.sha256((url + '|' + when.isoformat()).encode()).hexdigest()[:20],
                category=category, title=title, date=when.isoformat(), url=url,
                dateOnly=False, districts=[], scope='unknown', **fields)


def listing_page(html, kind):
    doc = Document(html).root
    cards = doc.find(cls='event-listing-data')
    if not cards and not doc.find(cls='view-empty'):
        raise ValueError('City listing markup missing')
    rows = []
    for card in cards:
        times, titles = card.find('time'), card.find(cls='views-field-title')
        # News uses the same listing container but a different title class.
        links = titles[0].find('a') if titles else [a for a in card.find('a') if a.text()]
        if not times or not links or not times[0].attrs.get('datetime'):
            raise ValueError('City listing missing date or link')
        title = links[0].text()
        when = date(times[0].attrs['datetime'])
        row = record(kind, title, when, links[0].attrs['href'])
        if kind == 'meetings':
            row['cancelled'] = bool(re.search(r'\bcancel[le]+d\b', title, re.I))
            row['board'] = re.split(r'\s+[-–—]\s+', re.sub(r'^CANCELLED:\s*', '', title, flags=re.I))[0]
            row['districts'] = districts(' '.join(re.findall(r'\bDistrict\s+(10|[1-9])\b', title, re.I)))
            row['scope'] = 'district' if row['districts'] else 'citywide'
            location = card.find(cls='organization') + card.find(cls='address-line1')
            row['location'] = ' · '.join(n.text() for n in location) or 'See agenda for location'
        else:
            row['dateOnly'] = True
            row['type'] = 'City news'
        rows.append(row)
    next_links = [a.attrs.get('href') for item in doc.find('li', 'pager__item--next') for a in item.find('a')]
    return rows, next_links[0] if next_links else None


def city_list(url, category, now):
    rows, visited = [], set()
    cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=29)
    upper = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=14)
    for _ in range(60):
        if url in visited:
            raise ValueError('Repeated calendar page')
        visited.add(url)
        page, next_page = listing_page(fetch(url), category)
        rows.extend(r for r in page if (now <= date(r['date']) < upper if category == 'meetings' else cutoff.date() <= date(r['date']).date() <= now.date()) and not r.get('cancelled'))
        reached = any(date(r['date']) >= upper for r in page) if category == 'meetings' else any(date(r['date']) < cutoff for r in page)
        if not next_page or reached:
            return rows
        url = official_url(urljoin(url, next_page))
    raise ValueError('City listing pagination exceeded limit')


def council_rows(html, now):
    rows = {}
    for a in Document(html).root.find('a'):
        match = re.fullmatch(r'/council/\d{4}/(\d{8})-([a-z0-9-]+)', a.attrs.get('href', ''))
        if not match:
            continue
        when = datetime.strptime(match[1], '%Y%m%d').replace(tzinfo=TZ)
        if not now.date() <= when.date() < (now + timedelta(days=14)).date():
            continue
        title = re.sub(r'^[A-Za-z]+\s+\d{1,2},\s+\d{4}\s*', '', a.text())
        if re.search(r'cancel[le]+d', title, re.I):
            continue
        if not title or title in {'Agenda', 'Meeting Details'}:
            continue
        board = re.sub(r'\s+(?:Regular|Special Called|Work Session|Meeting).*$', '', title)
        if board in {'City Council', 'Council'}:
            board = 'Austin City Council'
        row = record('meetings', title, when, a.attrs['href'], board=board, location='See agenda for location')
        row.update(dateOnly=True, scope='citywide')
        rows[row['url']] = row
    if not re.search(r'/council/\d{4}/\d{8}-', html):
        raise ValueError('Council meeting index missing')
    return list(rows.values())


def council(now):
    rows = []
    for year in sorted({now.year, (now + timedelta(days=14)).year}):
        rows.extend(council_rows(fetch(f'{CITY}/council/{year}/{year}_master_index'), now))
    for row in rows:
        doc = Document(fetch(row['url'])).root
        paragraphs = [p.text() for tag in ['p', 'h2', 'h3', 'h4'] for p in doc.find(tag)]
        # Use an explicitly labelled convening time; never infer from proclamations
        # or from the page's "updated at" timestamp. Other meetings keep date only.
        for p in paragraphs:
            match = re.search(r'(\d{1,2}:\d{2}\s*[AP]M)\s*[–—-]\s*City Council Convenes', p, re.I)
            if match:
                clock = datetime.strptime(match[1].upper(), '%I:%M %p')
                row['date'] = date(row['date']).replace(hour=clock.hour, minute=clock.minute).isoformat()
                row['dateOnly'] = False
                break
    return rows


def soda(dataset, select, where, order):
    rows = []
    for offset in range(0, 100000, 1000):
        query = urlencode({'$select': select, '$where': where, '$order': order, '$limit': 1000, '$offset': offset})
        page = json.loads(fetch(f'https://data.austintexas.gov/resource/{dataset}.json?{query}'))
        if not isinstance(page, list):
            raise ValueError('Invalid Open Data response')
        rows.extend(page)
        if len(page) < 1000:
            return rows
    raise ValueError('Open Data pagination exceeded limit')


def permit_rows(rows):
    result = []
    for p in rows:
        r = record('permits', p.get('permit_type_desc', 'Construction permit') + ' · ' + p['permit_number'], date(p['issue_date']), p['link'],
                   location=p.get('original_address1') or p.get('permit_location', ''), description=p.get('description', ''),
                   number=p['permit_number'], type=p.get('permit_type_desc', ''), status=p.get('status_current', ''))
        r.update(dateOnly=True, districts=districts(p.get('council_district')))
        result.append(r)
    return result


def permits(now):
    start = (now.date() - timedelta(days=6)).isoformat()
    end = (now.date() + timedelta(days=1)).isoformat()
    return permit_rows(soda('3syk-w9eu', 'project_id,permit_number,permit_type_desc,permit_location,original_address1,description,issue_date,status_current,council_district,link',
                           f"issue_date >= '{start}T00:00:00' AND issue_date < '{end}T00:00:00'", 'issue_date DESC,project_id'))


def development(now):
    start = (now.date() - timedelta(days=29)).isoformat()
    end = (now.date() + timedelta(days=1)).isoformat()
    rows = soda('mavg-96ck', 'folderrsn,case_name,permit_number,sub_type,status,description_of_work,proposed_land_use,application_start_date,council_district,street_number,street_prefix,street_name,street_type,street_direction,link',
                f"application_start_date >= '{start}T00:00:00' AND application_start_date < '{end}T00:00:00'", 'application_start_date DESC,folderrsn')
    result = []
    for p in rows:
        r = record('development', p.get('case_name') or p['permit_number'], date(p['application_start_date']), p['link'],
                   number=p.get('permit_number', ''), type=p.get('sub_type', 'Site plan'), status=p.get('status', ''),
                   description=p.get('description_of_work') or p.get('proposed_land_use', ''),
                   location=' '.join(p[k] for k in ['street_number', 'street_prefix', 'street_name', 'street_type', 'street_direction'] if p.get(k)))
        r.update(dateOnly=True, districts=districts(p.get('council_district')))
        result.append(r)
    return result


def zoning(now):
    rows = soda('k2wj-4v6p', 'meeting_date,pub_date,view_doc', f"meeting_date >= '{now.date().isoformat()}T00:00:00'", 'meeting_date,pub_date')
    result = []
    for p in rows:
        r = record('announcements', 'Zoning public notice · Council meeting ' + date(p['meeting_date']).strftime('%b %-d'), date(p['pub_date']), p['view_doc'],
                   description='Official zoning cases scheduled before City Council. Open the notice for case addresses and hearing information.', type='Zoning notice', hearingDate=p['meeting_date'][:10])
        r.update(dateOnly=True, scope='citywide')
        result.append(r)
    return result


SOURCES = [
    ('boards', 'Boards & commissions calendar', CITY + '/boards-commissions/events', 'meetings', lambda n: city_list(CITY + '/boards-commissions/events', 'meetings', n)),
    ('council-events', 'Council public calendar', CITY + '/council/events', 'meetings', lambda n: city_list(CITY + '/council/events', 'meetings', n)),
    ('council', 'City Council & committee agendas', CITY + '/council/meetings', 'meetings', council),
    ('news', 'City of Austin news', CITY + '/news', 'announcements', lambda n: city_list(CITY + '/news', 'announcements', n)),
    ('zoning', 'Zoning notices · Austin Open Data', 'https://data.austintexas.gov/d/k2wj-4v6p', 'announcements', zoning),
    ('permits', 'Issued construction permits · Austin Open Data', 'https://data.austintexas.gov/d/3syk-w9eu', 'permits', permits),
    ('siteplans', 'Site plan cases · Austin Open Data', 'https://data.austintexas.gov/d/mavg-96ck', 'development', development),
]


def assemble(now, previous, sources=SOURCES):
    output = dict(version=1, generated=now.isoformat(), sources=[], records=[])
    for key, title, url, category, importer in sources:
        meta = dict(id=key, title=title, url=url, category=category, ok=True, checked=now.isoformat())
        try:
            rows = importer(now)
            ttl = timedelta(hours=12 if category == 'meetings' else 72)
            for r in rows:
                r['source'] = key
                r['expires'] = (now + ttl).isoformat()
        except Exception as exc:
            old = next((s for s in previous.get('sources', []) if s['id'] == key), {})
            meta.update(ok=False, checked=old.get('checked'), error=type(exc).__name__)
            rows = [r for r in previous.get('records', []) if r.get('source') == key and date(r['expires']) > now]
            print(f'{key}: failed ({type(exc).__name__}); retaining {len(rows)} unexpired records', file=sys.stderr)
        rows = list({r['id']: r for r in rows}.values())
        meta['count'] = len(rows)
        output['sources'].append(meta)
        output['records'].extend(rows)
        print(f'{key}: {len(rows)} records; ok={meta["ok"]}', flush=True)
    output['records'].sort(key=lambda r: (r['category'], r['date'], r['id']))
    return output


if __name__ == '__main__':
    previous = json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {}
    output = assemble(datetime.now(TZ), previous)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')
    sys.exit(0 if all(s['ok'] for s in output['sources']) else 1)
