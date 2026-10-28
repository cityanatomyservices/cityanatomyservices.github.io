"""Event-feed boundaries, public eligibility, combined cards and stale data."""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import build_layers as b
import community_sources as c
import event_sources as e
from build import ZONE
from culture_sources import Page

NOW=datetime(2026,10,28,20,tzinfo=timezone.utc)


def venue_row(title,start,end,url,venue,address):
    return dict(title=title,theme='festivals' if 'Festival' in title else 'events',start=start,end=end,
                url=url,venue=venue,address=address,coordinates=[-97.74,30.27])


class Events(unittest.TestCase):
    def tribe_event(self,**changes):
        return dict(dict(title='Art workshop',status='publish',timezone='America/Chicago',all_day=False,
                         start_date='2026-11-01 10:00:00',end_date='2026-11-01 11:00:00',url='https://example.org/event',
                         venue=dict(venue='Museum',address='1 Main St',city='Austin')),**changes)

    def test_tribe_pagination_eligibility_dst_and_unknown_end(self):
        entries=[self.tribe_event(),self.tribe_event(title='Canceled art'),self.tribe_event(all_day=True),
                 self.tribe_event(title='Member reception'),self.tribe_event(venue=dict(city='Dallas')),
                 self.tribe_event(title='Second tour',end_date='2026-11-01 10:00:00')]
        pages=[dict(events=entries[:3],total=6,total_pages=2),dict(events=entries[3:])]
        with patch.object(e,'fetch',side_effect=[json.dumps(p).encode() for p in pages]) as fetch, patch.object(e,'event_row',side_effect=venue_row):
            rows=e.tribe(NOW,'https://example.org')
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]['start'].utcoffset(),timedelta(hours=-6))
        self.assertIsNone(rows[1]['end'])
        self.assertIn('&page=2',fetch.call_args_list[-1].args[0])
        with patch.object(e,'fetch',return_value=json.dumps(dict(events=[],total=2,total_pages=1)).encode()):
            with self.assertRaises(ValueError):e.tribe(NOW,'https://example.org')

    def test_empty_calendar_is_success_and_changed_timezone_fails(self):
        with patch.object(e,'fetch',return_value=b'{"events":[],"total":0,"total_pages":0}'):
            self.assertEqual(e.mexicarte(NOW),[])
        cancelled=self.tribe_event(event_status=dict(status='canceled'))
        with patch.object(e,'fetch',return_value=json.dumps(dict(events=[cancelled],total=1,total_pages=1)).encode()):
            self.assertEqual(e.contemporary(NOW),[])
        bad=self.tribe_event(timezone='UTC')
        with patch.object(e,'fetch',return_value=json.dumps(dict(events=[bad],total=1,total_pages=1)).encode()):
            with self.assertRaises(ValueError):e.contemporary(NOW)

    def test_squarespace_uses_street_not_copied_pin_and_skips_multiday(self):
        start=datetime(2026,11,1,12,tzinfo=ZONE)
        def item(title,hours=1,**extra):
            return dict(dict(title=title,startDate=start.timestamp()*1000+321,endDate=(start+timedelta(hours=hours)).timestamp()*1000+321,
                             fullUrl='/art',body='',location=dict(addressTitle='Gallery',addressLine1='1 Main St',addressLine2='Austin, Texas, 78701',
                             markerLat=40.7,markerLng=-74)),**extra)
        data=dict(upcoming=[item('Art opening'),item('Month-long exhibition',48),item('Virtual workshop'),
                           item('Unknown location',location={}),item('Closed',body='<p>This event is canceled.</p>')],past=[])
        with patch.object(e,'fetch',return_value=json.dumps(data).encode()),patch.object(e,'event_row',side_effect=venue_row):
            rows=e.squarespace(NOW,'https://example.org/events')
        self.assertEqual([r['title'] for r in rows],['Art opening'])
        self.assertEqual(rows[0]['address'],'1 Main St Austin TX')
        self.assertEqual(rows[0]['start'].microsecond,0)
        self.assertEqual(rows[0]['start'].utcoffset(),timedelta(hours=-6))

    def test_blanton_reads_event_date_not_post_publication(self):
        entry=dict(title=dict(rendered='Public tour'),date='2026-01-01T12:00:00',link='https://example.org/tour',
                   start_date=dict(date=dict(mysql='2026-11-01 14:00:00')),end_date=dict(date=dict(mysql='2026-11-01 15:00:00')))
        with patch.object(e,'fetch',return_value=json.dumps([entry]).encode()),patch.object(e,'event_row',side_effect=venue_row):
            row=e.blanton(NOW)[0]
        self.assertEqual(row['start'].isoformat(),'2026-11-01T14:00:00-06:00')

    def test_bullock_ignores_featured_films_virtual_and_member_events(self):
        def card(title,slug):
            return f'<article class="Listing-article"><a class="Listing-title-link" href="https://example.org/{slug}">{title}</a><time class="Listing-times-item" datetime="2026-11-01T10:00:00">10:00am – 5:00pm</time></article>'
        html=card('Featured film','films/movie')+'<div class="facetwp-template">'+card('Museum Day','events/day')+card('Virtual workshop','events/virtual')+card('Member Reception','events/member')+'</div><div data-name="pagination"></div>'
        with patch.object(e,'page',return_value=Page(html).root),patch.object(e,'event_row',side_effect=venue_row):
            rows=e.bullock(NOW)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['end'].hour,17)
        with patch.object(e,'page',return_value=Page(html).root),patch.object(e,'event_row',side_effect=venue_row):
            self.assertEqual(len(e.bullock(datetime(2026,11,1,14,tzinfo=ZONE))),1,'ongoing museum day remains visible')

    def city_card(self,title='Neighborhood Festival',day='November 1, 2026',start='10:00 AM',end='2:00 PM',machine='2026-11-01T16:00:00Z',address='1 Main St',extra_date=''):
        return f'''<div class="event-listing-data"><div class="publish-date"><time datetime="{machine}">{day}</time>{extra_date}</div>
        <div class="publish-time"><time datetime="{machine}">{start}</time><time datetime="2026-11-01T20:00:00Z">{end}</time></div>
        <div class="views-field-title"><a href="/event/festival">{title}</a></div><div class="event-location"><span class="organization">Community Center</span>
        <span class="address-line1">{address}</span><span class="locality">Austin</span></div></div>'''

    def test_city_uses_visible_times_and_rejects_date_ranges_routes_and_midnight(self):
        html=self.city_card()+self.city_card(extra_date='<time datetime="2026-11-03T16:00:00Z">November 3, 2026</time>')+self.city_card(address='Congress Avenue')+self.city_card(start='12:00 AM')
        with patch.object(c,'page',return_value=Page(html).root),patch.object(c,'event_row',side_effect=venue_row):
            rows=c.city_calendar(NOW,'/ace/events')
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['start'].isoformat(),'2026-11-01T10:00:00-06:00')
        with patch.object(c,'page',return_value=Page(self.city_card(machine='2026-11-01T10:00:00Z')).root):
            with self.assertRaises(ValueError):c.city_calendar(NOW,'/ace/events')

    def test_city_follows_pagination_and_deduplicates_department_feeds(self):
        first=Page(self.city_card()+'<li class="pager__item--next"><a href="?page=1">Next</a></li>').root
        last=Page(self.city_card(title='Later program',day='November 7, 2026',machine='2026-11-07T16:00:00Z')).root
        with patch.object(c,'page',side_effect=[first,last]) as read,patch.object(c,'event_row',side_effect=venue_row):
            rows=c.city_calendar(NOW,'/arts-culture/events')
        self.assertEqual(len(rows),2)
        self.assertTrue(read.call_args.args[0].endswith('/arts-culture/events?page=1'))
        with patch.object(c,'city_calendar',return_value=rows):
            self.assertEqual(len(c.city_arts(NOW)),2)

    def test_shoal_does_not_pin_private_meeting_points(self):
        def card(place,address):
            return f'<div class="event-item"><div class="details"><h6>Volunteer Cleanup</h6>Saturday, November 7, 2026 8:00-10:00am <em>{place}</em><em>{address}</em><a href="https://example.org/cleanup">Details</a></div></div>'
        html=card('Trail','Meeting point sent after registration')+card('Park','1380 W 34th St, Austin, TX 78731')
        with patch.object(c,'page',return_value=Page(html).root),patch.object(c,'event_row',side_effect=venue_row):
            rows=c.shoal(NOW)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['start'].hour,8)

    def test_waterloo_skips_past_series_and_concerts(self):
        def card(day,extra='',title='Community Celebration'):
            return f'<article class="events {extra}"><a class="entry-title-link" href="https://example.org/day">{title}</a><div class="event-date">{day}</div><div class="event-time">6-8PM</div><div class="event-location">Moody Amphitheater</div></article>'
        html=card('November 1, 2026')+card('November 1, 2026 — December 1, 2026')+card('November 1, 2026','events_category-c3-live-nation-concerts')+'<article class="events events-past">Past markup</article>'
        with patch.object(c,'page',return_value=Page(html).root),patch.object(c,'event_row',side_effect=venue_row):
            rows=c.waterloo(NOW)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['end'].hour,20)

    def test_creek_show_expands_only_explicit_nightly_hours(self):
        html='Dates: November 13-21, 2026 Time: 6-10pm Nightly Guests enter at (703 1/2 E 4th St.).'
        now=datetime(2026,11,10,12,tzinfo=ZONE)
        with patch.object(c,'page',return_value=Page(html).root),patch.object(c,'event_row',side_effect=venue_row):
            rows=c.creek_nights(now,'https://example.org/creek')
        self.assertEqual(len(rows),9)
        self.assertTrue(all(r['start'].hour==18 and r['end'].hour==22 for r in rows))
        with patch.object(c,'page',return_value=Page(html.replace('Nightly','')).root):
            with self.assertRaises(ValueError):c.creek_nights(now,'https://example.org/creek')

    def test_combined_feed_merges_festivals_and_events_with_original_failure_expiry(self):
        def row(title):return venue_row(title,NOW+timedelta(days=2),NOW+timedelta(days=2,hours=3),'https://example.org/'+title,'Hall','1 Main St')
        festival=b.event_feature(row('Festival'),'Offline',NOW)
        def unavailable(_):raise ValueError('offline')
        sources=[('Offline','https://example.org',unavailable),('Healthy','https://example.org',lambda _:[row('Workshop')])]
        with TemporaryDirectory() as temp,patch.object(b,'OUT',Path(temp)),patch.object(b,'SOURCES',sources):
            b.write('festivals',[festival],NOW,[])
            with self.assertRaises(RuntimeError):b.events(NOW+timedelta(hours=1))
            combined=b.load_old('events-festivals')
            self.assertEqual(len(combined['features']),2)
            self.assertEqual(next(f for f in combined['features'] if f['properties']['source']=='Offline'),festival)
            self.assertEqual([s['count'] for s in combined['sources']],[1,1])
            with self.assertRaises(RuntimeError):b.events(NOW+timedelta(hours=25))
            self.assertEqual(len(b.load_old('events-festivals')['features']),1)

    def test_new_event_sources_do_not_leak_into_other_layer_health(self):
        name='Blanton Museum of Art'
        with TemporaryDirectory() as temp,patch.object(b,'OUT',Path(temp)),patch.object(b,'SOURCES',[(name,'https://example.org',lambda _:[]) ]):
            b.events(NOW)
            self.assertEqual(b.load_old('live-music')['sources'],[])
            self.assertEqual(b.load_old('pop-up-markets')['sources'],[])
            self.assertEqual(b.load_old('events-festivals')['sources'][0]['name'],name)


if __name__=='__main__':unittest.main()
