"""Free organizer feeds for Events & Festivals. Only dated, located programs."""
from datetime import datetime, timedelta
import json
import re
from urllib.parse import urlencode, urljoin

from build import ZONE, clean, date, fetch
from culture_sources import Page, classify, first, fixed_row, page
from market_sources import hours

EXCLUDE = re.compile(r'\b(cancelled|canceled|postponed|sold out|virtual|webinar|members?[- ]only|member (?:reception|tour)|private event)\b', re.I)


def eligible(title):
    return bool(title) and not EXCLUDE.search(title) and classify(title) in ('events', 'festivals')


def in_window(start, end, now):
    return start and start < now+timedelta(days=14) and (end or start) > now


def timed(start, end):
    # Multiweek exhibitions and all-day date placeholders are not opening hours.
    return start and (not end or timedelta(0) < end-start <= timedelta(hours=18))


def event_row(title, start, end, url, venue, address):
    return fixed_row(title, classify(title), start, end, url, venue, address)


def tribe(now, base):
    """The Events Calendar's public API expands each dated recurrence for us."""
    query = urlencode(dict(start_date=now.astimezone(ZONE).date(),
                           end_date=(now+timedelta(days=14)).astimezone(ZONE).date(), per_page=50))
    url = base+'/wp-json/tribe/events/v1/events?'+query
    data = json.loads(fetch(url))
    total_pages = int(data['total_pages'])
    if not 0 <= total_pages <= 10 or not isinstance(data['events'], list):
        raise ValueError('Unexpected museum calendar pagination')
    pages = [data]+[json.loads(fetch(url+f'&page={i}')) for i in range(2,total_pages+1)]
    if sum(len(p['events']) for p in pages) != int(data['total']):
        raise ValueError('Incomplete museum event calendar')
    rows = []
    for p in pages:
        for e in p['events']:
            title = clean(e['title'])
            if not eligible(title) or e.get('all_day') or e.get('status') != 'publish' or e.get('hide_from_listings'):
                continue
            status=e.get('event_status') or ''
            if isinstance(status,dict):
                status=status.get('status','')
            if str(status).lower() in ('canceled','cancelled','postponed'):
                continue
            if e.get('timezone') not in ('America/Chicago','US/Central'):
                raise ValueError('Unexpected museum timezone')
            start, end = date(e['start_date']), date(e.get('end_date'))
            # Some organizers repeat the start in the end field when unknown.
            if end == start:
                end = None
            if not in_window(start,end,now) or not timed(start,end):
                continue
            venue = e.get('venue') or {}
            if not isinstance(venue,dict) or venue.get('city','').casefold() != 'austin':
                continue
            address = clean(venue.get('address'))
            if not re.match(r'\d',address):
                continue
            # Census street location avoids stale, copied organizer map pins.
            rows.append(event_row(title,start,end,e['url'],clean(venue.get('venue')),address+' Austin TX'))
    return rows


def contemporary(now):
    return tribe(now,'https://thecontemporaryaustin.org')


def mexicarte(now):
    return tribe(now,'https://mexic-artemuseum.org')


def squarespace(now, url):
    """Upcoming dated programs, with the organizer's street address for each."""
    data = json.loads(fetch(url+'?format=json'))
    upcoming = data['upcoming']
    if not isinstance(upcoming,list) or len(upcoming) >= 100:
        raise ValueError('Unexpected organizer calendar format')
    rows=[]
    # Include recently started items from `past`; check the actual times below.
    for e in upcoming + data.get('past',[]):
        title=clean(e['title'])
        if not eligible(title):
            continue
        start=datetime.fromtimestamp(e['startDate']/1000,ZONE).replace(microsecond=0)
        end=datetime.fromtimestamp(e['endDate']/1000,ZONE).replace(microsecond=0)
        if not in_window(start,end,now) or not timed(start,end):
            continue
        place=e.get('location') or {}
        if not re.search(r'\bAustin,\s*(?:TX|Texas)\b',place.get('addressLine2',''),re.I):
            continue
        address=clean(place.get('addressLine1'))
        if not re.match(r'\d',address):
            continue
        body=Page(e.get('body','')).root.text()
        if re.search(r'\b(?:this event is (?:cancelled|canceled)|members only|online only)\b',body,re.I):
            continue
        rows.append(event_row(title,start,end,urljoin(url,e['fullUrl']),clean(place.get('addressTitle')),address+' Austin TX'))
    return rows


def pease(now):
    return squarespace(now,'https://peasepark.org/events')


def canopy(now):
    return squarespace(now,'https://www.canopyaustin.com/happenings-')


def preservation(now):
    return squarespace(now,'https://www.preservationaustin.org/events')


def blanton(now):
    base='https://blantonmuseum.org'
    today=now.astimezone(ZONE).replace(hour=0,minute=0,second=0,microsecond=0)
    query=urlencode(dict(response_type='juicebox-events',per_page=100,
                         start_date=int(today.timestamp()),end_date=int((now+timedelta(days=14)).timestamp())))
    # This is the same public feed used by the museum's calendar UI.
    entries=json.loads(fetch(base+'/wp-json/wp/v2/programs?'+query))
    if not isinstance(entries,list) or len(entries)>=100:
        raise ValueError('Unexpected Blanton calendar size')
    rows=[]
    for e in entries:
        title=clean(e['title']['rendered'])
        if not eligible(title) or e.get('all_day'):
            continue
        start=date(e['start_date']['date']['mysql'])
        end=date(e['end_date']['date']['mysql'])
        if not in_window(start,end,now) or not timed(start,end):
            continue
        rows.append(event_row(title,start,end,e['link'],'Blanton Museum of Art','200 E Martin Luther King Jr Blvd Austin TX'))
    return rows


def bullock(now):
    base='https://www.thestoryoftexas.com'
    url=base+'/calendar/?_post_type_filter=event'
    rows=[]; seen=set()
    for number in range(1,11):
        root=page(url+(f'&_paged={number}' if number>1 else ''))
        cards=first(root,cls='facetwp-template').find('article','Listing-article')
        if not cards:
            raise ValueError('Bullock event cards missing')
        starts=[]
        for card in cards:
            link=first(card,'a','Listing-title-link');title=link.text()
            if '/events/' not in link.attrs.get('href','') or not eligible(title):
                continue
            clock=first(card,'time','Listing-times-item')
            start=date(clock.attrs['datetime']);starts.append(start)
            start,end=hours(start.date(),clock.text())
            if not in_window(start,end,now):
                continue
            key=(link.attrs['href'],start)
            if key in seen:
                continue
            seen.add(key)
            rows.append(event_row(title,start,end,link.attrs['href'],'Bullock Texas State History Museum','1800 N Congress Ave Austin TX'))
        pager=root.find('div',attr=('data-name','pagination'))
        next_page=any('next' in a.attrs.get('class','').lower() for p in pager for a in p.find('a'))
        if not next_page or starts and max(starts)>=now+timedelta(days=14):
            return rows
    raise ValueError('Bullock pagination exceeded limit')


SOURCES=[
    ('The Contemporary Austin','https://thecontemporaryaustin.org/events/',contemporary),
    ('Mexic-Arte Museum','https://mexic-artemuseum.org/calendar/',mexicarte),
    ('Pease Park Conservancy programs','https://peasepark.org/events',pease),
    ('Canopy arts events','https://www.canopyaustin.com/happenings-',canopy),
    ('Preservation Austin','https://www.preservationaustin.org/events',preservation),
    ('Blanton Museum of Art','https://blantonmuseum.org/programs/',blanton),
    ('Bullock Museum programs','https://www.thestoryoftexas.com/calendar/?_post_type_filter=event',bullock),
]
