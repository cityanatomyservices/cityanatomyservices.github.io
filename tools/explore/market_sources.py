"""Public Austin-area market calendars and explicitly published regular hours.

Regular schedules are checked on every refresh, only expanded 14 days ahead,
labelled as regular schedules, and subject to the same 24-hour expiry as events.
"""
from datetime import datetime, timedelta
import json
import re
from urllib.parse import quote, urljoin

from build import ZONE, clean, fetch
from culture_sources import Page, first, geocode, local, page
from calendar_http import read_calendar

CITIES = ('AUSTIN', 'CEDAR PARK', 'ROUND ROCK', 'GEORGETOWN')
MARKET = re.compile(r'\b(markets?|mercado|pulga|gear\s*swap)\b', re.I)
CANCELLED = re.compile(r'\b(cancelled|canceled|postponed|temporarily closed)\b', re.I)
REGULAR = 'Regular published schedule; check the organizer for weather and holiday changes.'


def market_row(title, start, end, url, venue, address, **extra):
    coordinates = extra.pop('coordinates', None)
    return dict(title=title, theme='pop-up-markets', start=start, end=end, url=url,
                venue=venue, address=address, coordinates=coordinates or geocode(address, cities=CITIES), **extra)


def soon(start, end, now):
    return start and start < now+timedelta(days=14) and (end or start) > now


def require(text, pattern):
    match = re.search(pattern, text, re.I)
    if not match:
        raise ValueError('Published market schedule or address changed; review required')
    return match


def hours(day, value, daytime=False):
    """Read ranges such as 9 AM–1 PM, 10-3pm, or daytime retail hours 10-5."""
    value = re.sub(r'\s+', '', value).lower().replace('.', '')
    match = re.fullmatch(r'(\d{1,2}(?::\d\d)?)(am|pm)?[-–—](\d{1,2}(?::\d\d)?)(am|pm)?', value)
    if not match:
        raise ValueError('Unrecognized market hours: '+value)
    a, am, b, bm = match.groups()
    if not bm:
        if not daytime:
            raise ValueError('Market hours have no am/pm')
        am, bm = 'am', 'pm'
        if a.startswith('12'):
            am = 'pm'
    day_text = day.strftime('%B %d, %Y')
    end = local(day_text, b+bm)
    if am:
        start = local(day_text, a+am)
        if end <= start:
            end += timedelta(days=1)
    else:
        candidates = [local(day_text, a+suffix) for suffix in ('am', 'pm')]
        starts = [s for s in candidates if timedelta(0) < end-s <= timedelta(hours=12)]
        if not starts:
            raise ValueError('Ambiguous market hours: '+value)
        start = max(starts)
    if end-start > timedelta(hours=16):
        raise ValueError('Unexpectedly long market day')
    return start, end


def regular(now, title, url, venue, address, schedules, excluded=(), coordinates=None):
    """schedules: (weekday, nth weekday or None, hours, daytime shorthand)."""
    rows = []
    for offset in range(15):
        day = now.astimezone(ZONE).date()+timedelta(days=offset)
        if day.isoformat() in excluded:
            continue
        for weekday, nth, value, daytime in schedules:
            if day.weekday() != weekday or nth and (day.day-1)//7+1 != nth:
                continue
            start, end = hours(day, value, daytime)
            if soon(start, end, now):
                rows.append(market_row(title, start, end, url, venue, address, description=REGULAR, coordinates=coordinates))
    return rows


def sunshine(now):
    url = 'https://nextdoor.com/pages/santas-sun-market-georgetown-tx/'
    root = page(url)
    text = root.text()
    # Use the organizer's own story, not Nextdoor's generic Sunday hours or
    # neighbors' recommendations, which omit the third-Sunday restriction.
    story = require(text, r'Our story (.*?) See more').group(1)
    require(story, r'1101 S\. I-35 Georgetown, TX')
    match = require(story, r'every Saturday and 3rd Sundays all year round from ([\d:]+\s*-\s*[\d:]+pm)')
    if CANCELLED.search(story):
        return []
    # A current explicit cancellation notice takes precedence over regular hours.
    activity = text.split('Activity ', 1)[-1].split('Our story', 1)[0]
    if re.search(r'(?:market|we(?: are|’re|\'re))[^.!?]{0,60}\b(?:cancelled|canceled|closed this|closed on)\b', activity, re.I):
        return []
    return regular(now, 'Sunshine Markets — Georgetown', url, 'Floor & Decor parking lot — Georgetown',
                   '1101 S Interstate 35 Georgetown TX 78626', [(5,None,match[1],False),(6,3,match[1],False)])


def soco(now):
    url = 'https://www.socomakersmarket.com/'
    text = page(url).text()
    # A styled heading splits "10" into separate text nodes on this site.
    text = re.sub(r'\b1\s+0\b', '10', text)
    match = require(text, r'Visit the market Fridays ([\d:]+\s*-\s*[\d:]+), Saturdays ([\d:]+\s*-\s*[\d:]+) and Sundays ([\d:]+\s*-\s*[\d:]+)\s*\|\s*1501 S Congress Ave Austin')
    if re.search(r'market[^.!?]{0,50}(?:cancelled|canceled|temporarily closed)', text, re.I):
        return []
    return regular(now, 'SoCo Makers Market & Vintage Annex', url, 'SoCo Makers Market',
                   '1501 S Congress Ave Austin TX 78704', [(d,None,h,True) for d,h in zip((4,5,6),match.groups())])


def rivco(now):
    url = 'https://www.austinmakerscollective.com/about-3'
    text = page(url).text()
    section = require(text, r'the RivCo (.*?) PRIMA DORA MAKERS MARKET').group(1)
    require(section, r'343 S Congress Ave, Austin, TX 78704')
    weekend = require(section, r'Saturday \+ Sunday ([\d:]+\s*-\s*[\d:]+pm)')[1]
    friday = require(section, r'Friday Night ([\d:]+\s*-\s*[\d:]+pm)')[1]
    if CANCELLED.search(section):
        return []
    return regular(now, 'RivCo Pop Up — Austin Makers Collective', url, 'Cork & Brew Market — RivCo',
                   '343 S Congress Ave Austin TX 78704', [(4,None,friday,False),(5,None,weekend,False),(6,None,weekend,False)])


def texas_farmers(now, kind):
    url = 'https://texasfarmersmarket.org/'+('farmers-markets-and-events' if kind=='bell' else 'mueller')
    root = page(url)
    text = root.text()
    coordinates = None
    if kind == 'bell':
        venue, address, weekday = 'Texas Farmers’ Market at Bell — Cedar Park', '200 S Bell Blvd Cedar Park TX 78613', 5
        require(text, r'200 South Bell Boulevard, Cedar Park TX 78613')
        match = require(text, r'Every Saturday from (\d+(?::\d\d)?am\s*-\s*\d+(?::\d\d)?pm)')
    else:
        venue, address, weekday = 'Texas Farmers’ Market at Mueller', '2006 Philomena St Austin TX 78723', 6
        require(text, r'2006 Philomena St, Austin TX 78723')
        match = require(text, r'Every Sunday from (\d+(?::\d\d)?am\s*-\s*\d+(?::\d\d)?pm)')
        # The pavilion's address is not in the Census street-address range.
        # Read the organizer's own map pin, verifying its address each refresh.
        places = [json.loads(n.attrs['data-context']).get('location', {}) for n in root.find('div')
                  if 'markerLat' in n.attrs.get('data-context','')]
        place = next((p for p in places if p.get('addressLine1') == '2006 Philomena Street'
                      and 'Austin' in p.get('addressLine2','')), None)
        if not place:
            raise ValueError('Mueller market map location missing')
        coordinates = [float(place['markerLng']),float(place['markerLat'])]
    if re.search(r'market[^.!?]{0,50}(?:cancelled|canceled|temporarily closed)', text, re.I):
        return []
    return regular(now, venue, url, venue, address, [(weekday,None,match[1],False)], coordinates=coordinates)


def bell(now):
    return texas_farmers(now, 'bell')


def mueller(now):
    return texas_farmers(now, 'mueller')


def sfc(now):
    url = 'https://sustainablefoodcenter.org/farmers-markets-support/sfc-farmers-markets/'
    sections = [(r'SFC Farmers[’\'] Market Downtown Situated (.*?) SFC Farmers',
                 'SFC Farmers’ Market Downtown', 'Republic Square', '422 Guadalupe St Austin TX 78701', r'422 Guadalupe St, Austin'),
                (r'SFC Farmers[’\'] Market at Sunset Valley Located (.*?) Park for Free',
                 'SFC Farmers’ Market at Sunset Valley', 'Toney Burger Center', '3200 Jones Rd Austin TX 78745', r'3200 Jones Rd, Austin')]
    def calendar(body):
        text = Page(body.decode('utf-8')).root.text()
        rows = []
        for pattern, title, venue, address, address_pattern in sections:
            section = require(text, pattern)[1]
            require(section, address_pattern)
            match = require(section, r'Hours: Saturdays, (\d+\s*AM\s*[–-]\s*\d+\s*PM)')
            if not CANCELLED.search(section):
                rows.extend(regular(now,title,url,venue,address,[(5,None,match[1],False)]))
        return rows
    return read_calendar(url, calendar, fetch)


def farmer_george(now):
    url = 'https://www.farmergeorge.market/'
    text = page(url).text()
    match = require(text, r'Round Rock Farmers Market is open every Saturday, year-round, rain or shine, from (\d+\s*AM[–-]\d+\s*PM) at Rock Creek Center, 2111 IH-35 N, Round Rock, TX 78664\. Closed on Christmas Day')
    # The same site advertises a not-yet-open Sunday market. Do not import it.
    excluded = [f'{year}-12-25' for year in (now.year, now.year+1)]
    return regular(now, 'Round Rock Farmers Market', url, 'Rock Creek Center — Round Rock',
                   '2111 N Interstate 35 Round Rock TX 78664', [(5,None,match[1],False)], excluded)


def ical_markets(body, now, url):
    # Libraries handle RRULE, EXDATE, moved RECURRENCE-ID instances, folded
    # lines, escaped locations, and daylight saving. No hand-written RRULEs.
    from icalendar import Calendar
    import recurring_ical_events
    calendar = Calendar.from_ical(body)
    if calendar.name != 'VCALENDAR' or not calendar.walk('VEVENT'):
        raise ValueError('Market calendar is missing its event data')
    instances = recurring_ical_events.of(calendar).between(now-timedelta(days=1), now+timedelta(days=14))
    if len(instances) > 1000:
        raise ValueError('Unexpected market calendar size')
    rows = []
    for e in instances:
        title = clean(str(e.get('SUMMARY','')))
        if not MARKET.search(title) or CANCELLED.search(title) or str(e.get('STATUS','')).upper() in ('CANCELLED','TENTATIVE'):
            continue
        start, end = e.decoded('DTSTART'), e.decoded('DTEND', None)
        if not isinstance(start, datetime) or not isinstance(end, datetime):
            continue
        if start.tzinfo is None or end.tzinfo is None:
            raise ValueError('Calendar performance timezone missing')
        if not soon(start,end,now):
            continue
        location = clean(str(e.get('LOCATION','')))
        match = re.fullmatch(r'(.+?),\s*(\d.+?),\s*Austin,\s*TX\s*(\d{5})(?:,\s*USA)?',location)
        if not match:
            raise ValueError('Market location is not an unambiguous Austin street address: '+location)
        venue, street, zipcode = match.groups()
        # Census resolves streets, not suites. Preserve the full source address
        # in the popup while geocoding the street when a suite is supplied.
        address = f'{street}, Austin TX {zipcode}'
        geo_address = re.sub(r'\s+Suite\s*#?\w+','',address,flags=re.I)
        rows.append(dict(title=title,theme='pop-up-markets',start=start.astimezone(ZONE),end=end.astimezone(ZONE),
                         url=url,venue=venue,address=address,coordinates=geocode(geo_address),
                         description='Dated market from the organizer’s calendar. Check event details for entry and age restrictions.'))
    return rows


def witches(now):
    url = 'https://calendar.google.com/calendar/ical/'+quote('eventsysatx@gmail.com',safe='')+'/public/basic.ics'
    return ical_markets(fetch(url),now,'https://yarrowandsageatx.com/pages/calendar')


def front(now):
    base = 'https://futurefronttexas.org'
    data = json.loads(fetch(base+'/events?format=json'))
    events = data['upcoming']
    if not isinstance(events,list) or len(events) >= 100:
        raise ValueError('Unexpected Future Front event feed')
    rows = []
    for e in events:
        title = clean(e['title'])
        if not MARKET.search(title) or CANCELLED.search(title):
            continue
        start = datetime.fromtimestamp(e['startDate']/1000,ZONE).replace(microsecond=0)
        end = datetime.fromtimestamp(e['endDate']/1000,ZONE).replace(microsecond=0)
        if not soon(start,end,now) or start.date()!=end.date():
            continue  # Multi-day exhibitions need daily hours, not overnight pins.
        place = e.get('location') or {}
        venue = clean(place.get('addressTitle'))
        address = clean(place.get('addressLine1'))
        if not re.search(r'\bAustin,\s*(?:TX|Texas)\b',clean(place.get('addressLine2')),re.I):
            continue
        # This organizer has reused old Squarespace templates. Import only
        # market venues whose identity is explicitly consistent with the event.
        if 'Coquito' in title and 'coquito' not in venue.casefold():
            print('Future Front: skipping Coquito event with conflicting Stubb’s location',flush=True)
            continue
        if not re.match(r'\d',address):
            raise ValueError('Future Front market has no street address')
        rows.append(market_row(title,start,end,urljoin(base,e['fullUrl']),venue,address+' Austin TX'))
    return rows


def machine_works(now):
    base = 'https://events.cmwbrewery.com'
    root = page(base+'/calendar')
    cards = root.find('article','show')
    if not cards:
        raise ValueError('Central Machine Works calendar missing')
    rows=[]
    for e in cards:
        title=first(e,cls='show__name').text()
        if not MARKET.search(title) or CANCELLED.search(title):
            continue
        when=first(e,cls='show__rule').text()
        match=require(when,r'^\w+, ([A-Za-z]+ \d{1,2}, \d{4}) at (\d{1,2}:\d{2}\s*[AP]M)$')
        start=local(match[1],match[2])
        if not soon(start,None,now):
            continue
        url=urljoin(base,e.attrs['data-href'])
        if not url.startswith(base+'/'):
            continue
        detail=page(url).text()
        require(detail,r'4824 E Cesar Chavez St, Austin, TX 78702')
        end=None
        times=re.search(r'When .{0,60}?@\s*(\d{1,2}(?::\d\d)?\s*(?:am|pm)?\s*-\s*\d{1,2}(?::\d\d)?\s*[ap]m)',detail,re.I)
        if times:
            actual,end=hours(start.date(),times[1])
            if actual!=start:
                raise ValueError('Central Machine Works calendar and detail times disagree')
        rows.append(market_row(title,start,end,url,'Central Machine Works','4824 E Cesar Chavez St Austin TX'))
    return rows


SOURCES = [
    ('Sunshine Markets','https://nextdoor.com/pages/santas-sun-market-georgetown-tx/',sunshine),
    ('SoCo Makers Market','https://www.socomakersmarket.com/',soco),
    ('Austin Makers Collective','https://www.austinmakerscollective.com/about-3',rivco),
    ('Texas Farmers’ Market at Bell','https://texasfarmersmarket.org/farmers-markets-and-events',bell),
    ('Texas Farmers’ Market at Mueller','https://texasfarmersmarket.org/mueller',mueller),
    ('SFC Farmers’ Markets','https://sustainablefoodcenter.org/farmers-markets-support/sfc-farmers-markets/',sfc),
    ('Farmer George','https://www.farmergeorge.market/',farmer_george),
    ('Austin Witches Market / Yarrow & Sage','https://yarrowandsageatx.com/pages/calendar',witches),
    ('The Front Market / Future Front','https://thefrontmarket.com/popups',front),
    ('Central Machine Works markets','https://events.cmwbrewery.com/calendar',machine_works),
]
