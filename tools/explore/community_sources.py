"""City and community calendars with explicit public dates, hours and places."""
from datetime import datetime, timedelta
import re
from urllib.parse import urljoin

from build import ZONE, date
from culture_sources import first, local, page
from event_sources import eligible, event_row, in_window, timed
from market_sources import hours


def city_calendar(now, path):
    base='https://www.austintexas.gov'
    url=base+path
    rows=[]; visited=set()
    for _ in range(12):
        if url in visited:
            raise ValueError('City calendar pagination loop')
        visited.add(url)
        root=page(url)
        cards=root.find('div','event-listing-data')
        if not cards:
            raise ValueError('City calendar cards missing')
        upcoming=[]
        for card in cards:
            dates=first(card,cls='publish-date').find('time')
            if not dates:
                raise ValueError('City event date missing')
            starts=date(dates[0].attrs['datetime']);upcoming.append(starts)
            # A series date range does not say which dates it actually meets.
            if len(dates)!=1:
                continue
            link=first(first(card,cls='views-field-title'),'a');title=link.text()
            if not eligible(title):
                continue
            clocks=first(card,cls='publish-time').find('time')
            if not clocks:
                continue
            day=dates[0].text()
            start=local(day,clocks[0].text())
            end=local(day,clocks[1].text()) if len(clocks)>1 else None
            if end and end<=start:
                end+=timedelta(days=1)
            # Skip midnight date placeholders and verify the machine field
            # agrees with the visible time. City's JSON-LD offsets can be wrong.
            if start.hour==0 and start.minute==0:
                continue
            if start!=date(clocks[0].attrs['datetime']):
                raise ValueError('City visible and machine start times disagree')
            if not in_window(start,end,now) or not timed(start,end):
                continue
            place=first(card,cls='event-location')
            cities=place.find(cls='locality')
            addresses=place.find(cls='address-line1')
            if not cities or cities[0].text().casefold()!='austin' or not addresses:
                continue
            address=addresses[0].text()
            if not re.match(r'\d',address):
                continue  # Citywide routes need a specific published meeting point.
            # Drupal's second address line sometimes contains a room number.
            venue=first(place,cls='organization').text()
            rows.append(event_row(title,start,end,urljoin(base,link.attrs['href']),venue,address+' Austin TX'))
        links=root.find('li','pager__item--next')
        if not links or upcoming and min(upcoming)>=now+timedelta(days=14):
            return rows
        url=urljoin(url,first(links[0],'a').attrs['href'])
    raise ValueError('City event pagination exceeded limit')


def city_arts(now):
    # MACC's calendar includes programs absent from the parent department feed.
    rows=city_calendar(now,'/arts-culture/events')+city_calendar(now,'/macc/events')
    return list({(r['url'],r['start']):r for r in rows}.values())


def city_special(now):
    return city_calendar(now,'/ace/events')


def shoal(now):
    root=page('https://shoalcreekconservancy.org/events/')
    cards=root.find('div','event-item')
    if not cards:
        raise ValueError('Shoal Creek calendar missing')
    rows=[]
    for card in cards:
        details=first(card,cls='details');title=first(details,'h6').text()
        if not eligible(title):
            continue
        m=re.search(r'\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), ([A-Za-z]+ \d{1,2}, \d{4}) (\d{1,2}(?::\d\d)?\s*(?:[ap]m)?\s*[-–]\s*\d{1,2}(?::\d\d)?\s*[ap]m)',details.text(),re.I)
        if not m:
            raise ValueError('Shoal Creek event hours missing')
        day=datetime.strptime(m[1],'%B %d, %Y').date()
        start,end=hours(day,m[2])
        if not in_window(start,end,now):
            continue
        places=details.find('em')
        if len(places)<2 or not re.match(r'\d',places[1].text()) or not re.search(r'Austin,? TX',places[1].text(),re.I):
            continue
        rows.append(event_row(title,start,end,first(details,'a').attrs['href'],places[0].text(),places[1].text()))
    return rows


def creek_nights(now, url):
    """Creek Show explicitly publishes nightly hours and its current entrance."""
    text=page(url).text()
    m=re.search(r'Dates: ([A-Za-z]+) (\d{1,2})[-–](\d{1,2}), (20\d{2}) Time: (.*?) Nightly',text)
    if not m:
        raise ValueError('Creek Show nightly schedule changed')
    address=re.search(r'\((\d+(?: 1/2)? E \d+(?:st|nd|rd|th) St\.)\)',text)
    if not address:
        raise ValueError('Creek Show entrance address missing')
    first_day=datetime.strptime(f'{m[1]} {m[2]}, {m[4]}','%B %d, %Y').date()
    last_day=datetime.strptime(f'{m[1]} {m[3]}, {m[4]}','%B %d, %Y').date()
    if not 0<=(last_day-first_day).days<31:
        raise ValueError('Unexpected Creek Show date span')
    rows=[]
    for i in range((last_day-first_day).days+1):
        start,end=hours(first_day+timedelta(days=i),m[5])
        if in_window(start,end,now):
            rows.append(event_row('Creek Show',start,end,url,'Creek Show entrance — Waterloo Greenway',address[1]+' Austin TX'))
    return rows


def waterloo(now):
    root=page('https://waterloogreenway.org/events/')
    cards=root.find('article','events')
    if not cards:
        raise ValueError('Waterloo calendar missing')
    # Public destination addresses: waterloogreenway.org/visit/; the two
    # butterfly-tagging addresses are also printed on each calendar card.
    addresses={
        'Moody Amphitheater':'1401 N Trinity St Austin TX',
        'Meredith Heritage Tree Deck':'500 E 12th St Austin TX',
        'Lebermann Plaza':'1301 Trinity St Austin TX',
        "Grandpa's Lakeview Terrace (71 1/2 Trinity St.)":'71 1/2 Trinity St Austin TX',
    }
    rows=[]
    for card in cards:
        if 'events-past' in card.attrs.get('class','').split():
            continue
        link=first(card,'a','entry-title-link');title=link.text()
        if not eligible(title) or 'events_category-c3-live-nation-concerts' in card.attrs.get('class',''):
            continue
        days=first(card,cls='event-date').text()
        if not re.fullmatch(r'[A-Za-z]+ \d{1,2}, \d{4}',days):
            if title=='Creek Show':
                # The landing page supplies individual nightly hours; other
                # series need separately dated sessions before they can map.
                first_day=re.match(r'[A-Za-z]+ \d{1,2}, \d{4}',days)
                if first_day and local(first_day[0],'12AM')<now+timedelta(days=14):
                    rows.extend(creek_nights(now,link.attrs['href']))
            continue  # Import separately dated sessions, not a whole series span.
        day=datetime.strptime(days,'%B %d, %Y').date()
        value=first(card,cls='event-time').text()
        if 'doors' in value.lower():
            continue
        start,end=hours(day,value)
        if not in_window(start,end,now):
            continue
        venue=first(card,cls='event-location').text()
        if venue not in addresses:
            raise ValueError('New Waterloo event location needs verification: '+venue)
        rows.append(event_row(title,start,end,link.attrs['href'],venue+' — Waterloo Greenway',addresses[venue]))
    return rows


SOURCES=[
    ('City of Austin cultural centers','https://www.austintexas.gov/arts-culture/events',city_arts),
    ('Austin Center for Events','https://www.austintexas.gov/ace/events',city_special),
    ('Shoal Creek Conservancy','https://shoalcreekconservancy.org/events/',shoal),
    ('Waterloo Greenway programs','https://waterloogreenway.org/events/',waterloo),
]
