"""Read factual dates and locations from public organizer calendars."""
from datetime import datetime, timedelta
from html.parser import HTMLParser
import json
import re
from urllib.parse import urlencode, urljoin
from build import ROOT, ZONE, clean, date, fetch

CACHE = ROOT/'tools/explore/venue-cache.json'


class Node:
    def __init__(self, tag='', attrs=None):
        self.tag, self.attrs, self.children = tag, dict(attrs or []), []
    def text(self):
        return clean(' '.join(c.text() if isinstance(c, Node) else c for c in self.children if not isinstance(c, Node) or c.tag not in ('script','style')))
    def find(self, tag=None, cls=None, attr=None):
        result = []
        for c in self.children:
            if not isinstance(c, Node):
                continue
            if (not tag or c.tag == tag) and (not cls or cls in c.attrs.get('class','').split()) and (not attr or c.attrs.get(attr[0]) == attr[1]):
                result.append(c)
            result.extend(c.find(tag, cls, attr))
        return result


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node(); self.stack = [self.root]; self.feed(html)
    def handle_starttag(self, tag, attrs):
        n = Node(tag,attrs); self.stack[-1].children.append(n)
        if tag not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'):
            self.stack.append(n)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag == tag:
                del self.stack[i:]; break
    def handle_data(self, text):
        self.stack[-1].children.append(text)


def page(url):
    return Page(fetch(url).decode('utf-8')).root


def first(node, tag=None, cls=None, attr=None):
    found = node.find(tag, cls, attr)
    if not found:
        raise ValueError(f'Missing calendar field: {tag}/{cls}/{attr}')
    return found[0]


def geocode(address, cities=('AUSTIN',)):
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    if address in cache:
        return cache[address]['coordinates']
    url = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?' + urlencode(dict(address=address, benchmark='Public_AR_Current', format='json'))
    matches = json.loads(fetch(url))['result']['addressMatches']
    if len(matches) != 1 or matches[0]['addressComponents'].get('city') not in cities:
        raise ValueError(f'No unambiguous address match in the allowed cities: {address}')
    match = matches[0]
    coords = [match['coordinates']['x'], match['coordinates']['y']]
    cache[address] = dict(coordinates=coords, matchedAddress=match['matchedAddress'], source=url)
    CACHE.write_text(json.dumps(cache, indent=2)+'\n')
    return coords


def local(day, clock):
    clock = re.sub(r'\s+', '', clock).upper()
    pattern = '%B %d, %Y %I:%M%p' if ':' in clock else '%B %d, %Y %I%p'
    return datetime.strptime(day+' '+clock, pattern).replace(tzinfo=ZONE)


def classify(title, category=''):
    if re.search(r'\b(festivals?|fest|carnival|feria)\b', title, re.I):
        return 'festivals'
    if re.search(r'\b(flea|(?:makers?|artisan|craft|night|vintage|pop[ -]?up|holiday|farmers?|longhorn) markets?|mercado)\b', title, re.I):
        return 'pop-up-markets'
    if re.search(r'\b(movie|screening|documentary)\b', title, re.I):
        return None
    if category == 'comedy':
        return 'live-comedy'
    if category == 'music' or re.search(r'\b(concert|recital|orchestra|choir|ensemble|symphony|jazz)\b', title, re.I):
        return 'live-music'
    return 'events'


def fixed_row(title, group, start, end, url, venue, address, **extra):
    return dict(title=title, theme=group, start=start, end=end, url=url, venue=venue, address=address,
                coordinates=geocode(address), **extra)


def fallout(now):
    url = 'https://falloutcomedy.com/comedy-shows/'
    cards = page(url).find('article','wfea-card-list-item')
    if not cards: raise ValueError('Fallout calendar cards missing')
    rows = []
    for card in cards:
        link = first(first(card,'h3'), 'a')
        times = first(card,'time').text()
        m = re.fullmatch(r'([A-Za-z]+ \d{1,2}, \d{4}), (\d{1,2}:\d{2}\s*[ap]m)\s*[-–]\s*(?:([A-Za-z]+ \d{1,2}, \d{4}), )?(\d{1,2}:\d{2}\s*[ap]m)', times, re.I)
        if not m: raise ValueError(f'Unrecognized Fallout showtime: {times}')
        start,end = local(m[1],m[2]),local(m[3] or m[1],m[4])
        if end <= start: end += timedelta(days=1)
        rows.append(fixed_row(link.text(), 'live-comedy', start, end, link.attrs['href'], 'Fallout Theater', '616 Lavaca St Austin TX'))
    return rows


def antones(now):
    cards = page('https://antonesnightclub.com/').find('div','tw-event-item')
    if not cards: raise ValueError('Antone’s calendar cards missing')
    rows=[]
    for card in cards:
        link=first(first(card,cls='tw-name'),'a')
        title=link.text(); group=classify(title,'music')
        if not group: continue
        start=local(first(card,cls='tw-event-date').text(),first(card,cls='tw-event-time').text())
        rows.append(fixed_row(title,group,start,None,link.attrs['href'], 'Antone’s Nightclub','305 E 5th St Austin TX'))
    return rows


def meanwhile(now):
    cards = page('https://www.meanwhilebeer.com/events').find('div','collection-item-12')
    if not cards: raise ValueError('Meanwhile calendar cards missing')
    rows=[]
    for card in cards:
        link=first(card,'a','event-left');title=first(card,cls='beer-name').text()
        group=classify(title,'music' if re.search(r'(concert|ticketed show)',title,re.I) else '')
        if not group: continue
        day=first(card,cls='left').text()
        time=first(first(card,cls='events-sub-info'),cls='beer-style').text()
        rows.append(fixed_row(title,group,local(day,time),None,urljoin('https://www.meanwhilebeer.com',link.attrs['href']),
                              'Meanwhile Brewing','3901 Promontory Point Dr Austin TX'))
    return rows


def flea(now):
    root=page('https://www.austinflea.net/')
    blocks=root.find('div',attr=('data-testid','richTextElement'))
    rows=[]; previous=''
    for block in blocks:
        text=block.text()
        m=re.search(r'^(\d+[^,]*?) (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), ([A-Za-z]+) (\d{1,2})(?:st|nd|rd|th)?(?:,? (20\d{2}))? (\d{1,2}(?::\d\d)?\s*[ap]m)\s*[-–]\s*(\d{1,2}(?::\d\d)?\s*[ap]m)',text,re.I)
        if m:
            address=m[1]+' Austin TX'
            year=int(m[4] or now.astimezone(ZONE).year)
            day=f'{m[2]} {m[3]}, {year}'
            start,end=local(day,m[5]),local(day,m[6])
            # Only resolve an omitted year into the immediate upcoming window.
            if not m[4] and start < now-timedelta(days=30):
                start=start.replace(year=year+1);end=end.replace(year=year+1)
            if end<=start: end+=timedelta(days=1)
            if start <= now+timedelta(days=30):
                venue=previous.title()
                rows.append(fixed_row('Austin Flea at '+venue,'pop-up-markets',start,end,'https://www.austinflea.net/',venue,address))
        previous=text
    if not rows: raise ValueError('No dated upcoming Austin Flea markets found')
    return rows


def university(now):
    url=f'https://calendar.utexas.edu/api/2/events?start_date={now.astimezone(ZONE).date()}&days=14&pp=100'
    initial=json.loads(fetch(url));total=int(initial['page']['total'])
    if total>20:raise ValueError('Unexpected UT pagination')
    pages=[initial]+[json.loads(fetch(url+f'&page={i}')) for i in range(2,total+1)]
    rows=[]
    for data in pages:
        for item in data['events']:
            e=item['event']; geo=e.get('geo') or {}
            if e.get('status')!='live' or (geo.get('city') or '').lower()!='austin':continue
            if not any(a['name']=='General Public' for a in e.get('filters',{}).get('event_target_audience',[])):continue
            if re.search(r'\b(UT ID|students only|members only)\b',clean(e.get('description_text') or e.get('description')),re.I):continue
            group=classify(e['title'])
            if not group or not geo.get('latitude') or not geo.get('longitude'):continue
            for inst in e.get('event_instances',[]):
                instance=inst['event_instance'];start=date(instance.get('start'));end=date(instance.get('end'))
                if not start:continue
                all_day=bool(instance.get('all_day'))
                if not end and all_day:
                    end=datetime.combine(start.astimezone(ZONE).date()+timedelta(days=1),datetime.min.time(),ZONE)
                rows.append(dict(title=e['title'],theme=group,start=start,end=end,url=e['localist_url'],venue=e.get('location_name') or 'UT Austin',
                                 address=geo.get('street') or '',coordinates=[float(geo['longitude']),float(geo['latitude'])],allDay=all_day))
    return rows


SOURCES = [
    ('Fallout Theater','https://falloutcomedy.com/comedy-shows/',fallout),
    ('Antone’s Nightclub','https://antonesnightclub.com/',antones),
    ('Meanwhile Brewing','https://www.meanwhilebeer.com/events',meanwhile),
    ('Austin Flea','https://www.austinflea.net/',flea),
    ('UT Austin','https://calendar.utexas.edu/',university),
]
