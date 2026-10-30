"""Protect market recurrence exceptions, nearby cities, hours and source scope."""
from datetime import datetime, timedelta, timezone
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from culture_sources import Page
import market_sources as m
import culture_sources as c
import build_layers as b

NOW = datetime(2026, 10, 28, 20, tzinfo=timezone.utc)


def ics(events):
    return ('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//AustinChat Tests//EN\r\n'+events+'END:VCALENDAR\r\n').encode()


def event(uid, start, end, extra='', title='Witches Market @ Club'):
    return (f'BEGIN:VEVENT\r\nUID:{uid}\r\nSUMMARY:{title}\r\n'
            f'DTSTART;TZID=America/Chicago:{start}\r\nDTEND;TZID=America/Chicago:{end}\r\n'
            'LOCATION:Club\\, 123 Main St\\, Austin\\, TX 78701\\, USA\r\n'
            f'{extra}END:VEVENT\r\n')


class Markets(unittest.TestCase):
    def setUp(self):
        p=patch.object(m,'geocode',return_value=[-97.74,30.27]);p.start();self.addCleanup(p.stop)

    def sfc_page(self):
        return '''SFC Farmers’ Market Downtown Situated in Republic Square.
        Hours: Saturdays, 9 AM – 1 PM Republic Square, 422 Guadalupe St, Austin
        SFC Farmers’ Market at Sunset Valley Located in south Austin.
        Hours: Saturdays, 9 AM – 1 PM Toney Burger Center, 3200 Jones Rd, Austin
        Park for Free'''

    def test_sfc_retries_incomplete_response_before_expanding_verified_hours(self):
        with patch.object(m,'fetch',side_effect=[b'<p>Unavailable</p>',self.sfc_page().encode()]) as get, patch('calendar_http.time.sleep'):
            rows=m.sfc(NOW)
        self.assertEqual(len(rows),4)
        self.assertEqual(get.call_count,2)
        self.assertEqual({r['venue'] for r in rows},{'Republic Square','Toney Burger Center'})
        self.assertTrue(all(r['start'].weekday()==5 and r['start'].hour==9 and r['end'].hour==13 for r in rows))
        self.assertEqual({r['start'].utcoffset() for r in rows},{timedelta(hours=-5),timedelta(hours=-6)})

    def test_sfc_still_rejects_changed_schedule_and_honors_cancellation(self):
        with patch.object(m,'fetch',return_value=self.sfc_page().replace('Saturdays','Sundays').encode()) as get, patch('calendar_http.time.sleep'):
            with self.assertRaisesRegex(ValueError,'after 3 attempts'):
                m.sfc(NOW)
            self.assertEqual(get.call_count,3)
        with patch.object(m,'fetch',return_value=self.sfc_page().replace('in Republic Square.','in Republic Square. Temporarily closed.').encode()):
            rows=m.sfc(NOW)
        self.assertEqual(len(rows),2)
        self.assertTrue(all(r['venue']=='Toney Burger Center' for r in rows))

    def test_sunshine_saturdays_and_only_third_sunday_with_dst(self):
        html='''Activity SUNSHINE MARKETS See you Saturday! Our story Outdoor markets at
        1101 S. I-35 Georgetown, TX (Floor & Decor parking lot) every Saturday and 3rd Sundays all year round
        from 10:00-3:00pm. See more Sunday 10AM-3PM'''
        now=datetime(2026,11,6,20,tzinfo=timezone.utc)
        with patch.object(m,'page',return_value=Page(html).root): rows=m.sunshine(now)
        self.assertEqual([r['start'].strftime('%Y-%m-%d') for r in rows],['2026-11-07','2026-11-14','2026-11-15'])
        self.assertTrue(all(r['start'].hour==10 and r['end'].hour==15 for r in rows))
        self.assertTrue(all(r['start'].utcoffset()==timedelta(hours=-6) for r in rows))
        self.assertTrue(all(r['description']==m.REGULAR for r in rows))
        self.assertIn('Georgetown',rows[0]['address'])

    def test_sunshine_rejects_changed_schedule_and_honors_cancellation(self):
        html='''Activity Our market is canceled this Saturday. Our story Outdoor markets at 1101 S. I-35 Georgetown, TX
        every Saturday and 3rd Sundays all year round from 10:00-3:00pm. See more'''
        with patch.object(m,'page',return_value=Page(html).root): self.assertEqual(m.sunshine(NOW),[])
        with patch.object(m,'page',return_value=Page(html.replace('3rd','2nd')).root):
            with self.assertRaises(ValueError): m.sunshine(NOW)

    def test_hours_noon_evening_and_missing_meridiem(self):
        day=NOW.date()
        for value,daytime,start,end in [('10-3pm',False,10,15),('12-4pm',False,12,16),('5-10pm',False,17,22),
                                       ('9 AM – 1 PM',False,9,13),('12:30-5',True,12,17)]:
            a,b=m.hours(day,value,daytime);self.assertEqual((a.hour,b.hour),(start,end))
        self.assertEqual(m.hours(day,'12:30-5',True)[0].minute,30)
        with self.assertRaises(ValueError):m.hours(day,'10-5')

    def test_regular_schedules_expire_and_do_not_extend_past_horizon(self):
        now=datetime(2027,12,24,18,tzinfo=timezone.utc)
        rows=m.regular(now,'Market','https://example.com','Venue','123 Main St',[(5,None,'10am-2pm',False)],['2027-12-25'])
        self.assertEqual([r['start'].date().isoformat() for r in rows],['2028-01-01'])
        feature=b.event_feature(rows[0],'Market',now)
        self.assertEqual(b.date(feature['properties']['expires']),now+timedelta(hours=24))

    def test_google_calendar_exclusions_moves_cancellations_and_dst(self):
        series=event('one','20261025T100000','20261025T140000',
                     'RRULE:FREQ=WEEKLY;COUNT=4\r\nEXDATE;TZID=America/Chicago:20261108T100000\r\n')
        moved=event('one','20261102T120000','20261102T160000',
                    'RECURRENCE-ID;TZID=America/Chicago:20261101T100000\r\n')
        canceled=event('two','20261031T100000','20261031T140000','STATUS:CANCELLED\r\n')
        renamed=event('three','20261031T100000','20261031T140000',title='CANCELED Market')
        lesson=event('four','20261031T100000','20261031T140000',title='Meditation class')
        rows=m.ical_markets(ics(series+moved+canceled+renamed+lesson),NOW,'https://organizer.example/calendar')
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['start'].isoformat(),'2026-11-02T12:00:00-06:00')
        self.assertEqual(rows[0]['end'].hour,16)
        self.assertEqual(rows[0]['address'],'123 Main St, Austin TX 78701')

    def test_calendar_rejects_missing_location_and_ignores_all_day(self):
        bad=event('one','20261031T100000','20261031T140000').replace('Club\\, 123 Main St\\, Austin\\, TX 78701\\, USA','TBD')
        with self.assertRaises(ValueError):m.ical_markets(ics(bad),NOW,'https://example.com')
        all_day='BEGIN:VEVENT\r\nUID:all\r\nSUMMARY:Market\r\nDTSTART;VALUE=DATE:20261031\r\nDTEND;VALUE=DATE:20261101\r\nEND:VEVENT\r\n'
        self.assertEqual(m.ical_markets(ics(all_day),NOW,'https://example.com'),[])

    def test_front_conflicting_template_and_overnight_exhibition_not_mapped(self):
        base=dict(title='The Front Market',startDate=int((NOW+timedelta(days=1)).timestamp()*1000),
                  endDate=int((NOW+timedelta(days=1,hours=4)).timestamp()*1000),fullUrl='/events/market',
                  location={'addressTitle':'Waterloo Park','addressLine1':'1401 Trinity St','addressLine2':'Austin, TX'})
        wrong=dict(base,title='Pulga Coquito',location={'addressTitle':'Stubbs','addressLine1':'801 Red River St','addressLine2':'Austin, TX'})
        overnight=dict(base,endDate=base['endDate']+3*86400000)
        with patch.object(m,'fetch',return_value=json.dumps({'upcoming':[base,wrong,overnight]}).encode()):rows=m.front(NOW)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['venue'],'Waterloo Park')

    def test_cmw_market_uses_dated_card_and_explicit_end(self):
        card='''<article class="show" data-href="/event?event=abc"><div class="show__name">East Austin Night Market</div>
        <div class="show__rule">Thursday, October 29, 2026 at 5:00 PM</div></article>'''
        detail='4824 E Cesar Chavez St, Austin, TX 78702 When Tomorrow @ 5 - 9 pm Description'
        with patch.object(m,'page',side_effect=[Page(card).root,Page(detail).root]):rows=m.machine_works(NOW)
        self.assertEqual(rows[0]['start'].isoformat(),'2026-10-29T17:00:00-05:00')
        self.assertEqual(rows[0]['end'].hour,21)

    def test_mueller_uses_organizers_verified_map_pin(self):
        context=json.dumps({'location':{'addressLine1':'2006 Philomena Street','addressLine2':'Austin, TX, 78723',
                                        'markerLng':-97.7025851,'markerLat':30.3001433}})
        html=f'''Every Sunday from 10am-2pm. 2006 Philomena St, Austin TX 78723
        <div data-context='{context}'></div>'''
        with patch.object(m,'page',return_value=Page(html).root): rows=m.mueller(NOW)
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]['coordinates'],[-97.7025851,30.3001433])
        with patch.object(m,'page',return_value=Page(html.replace('2006 Philomena Street','Other Street')).root):
            with self.assertRaisesRegex(ValueError,'map location missing'):m.mueller(NOW)

    def test_geocoder_nearby_city_is_explicitly_allowed(self):
        data={'result':{'addressMatches':[{'addressComponents':{'city':'GEORGETOWN'},
              'coordinates':{'x':-97.6887,'y':30.6341},'matchedAddress':'1101 S INTERSTATE 35, GEORGETOWN, TX'}]}}
        with tempfile.TemporaryDirectory() as tmp, patch.object(c,'CACHE',Path(tmp)/'cache.json'), patch.object(c,'fetch',return_value=json.dumps(data)):
            with self.assertRaises(ValueError):c.geocode('1101 S Interstate 35 Georgetown TX')
            coords=c.geocode('1101 S Interstate 35 Georgetown TX',cities=m.CITIES)
        f=b.event_feature(dict(title='Sunshine',theme='pop-up-markets',start=NOW+timedelta(days=1),end=NOW+timedelta(days=1,hours=5),
                              url='https://example.com',coordinates=coords,address='Georgetown'), 'Sunshine Markets', NOW)
        self.assertIsNotNone(f,'Georgetown market is inside the existing Austin-area coverage bounds')

    def test_market_failure_is_scoped_and_does_not_renew_expiry(self):
        row=m.market_row('Sunshine',NOW+timedelta(days=1),NOW+timedelta(days=1,hours=5),'https://example.com','Lot','Address')
        old=b.event_feature(row,'Sunshine Markets',NOW-timedelta(hours=2))
        def fail(_):raise ValueError('offline')
        with tempfile.TemporaryDirectory() as tmp, patch.object(b,'OUT',Path(tmp)), patch.object(b,'SOURCES',[
            ('Sunshine Markets','https://example.com',fail),('Other','https://example.com',lambda _:[]) ]):
            b.write('pop-up-markets',[old],NOW,[])
            with self.assertRaises(RuntimeError):b.events(NOW)
            data=json.loads((Path(tmp)/'pop-up-markets.geojson').read_text())
            self.assertEqual(data['features'],[old])
            self.assertFalse(data['sources'][0]['ok'])
            music=json.loads((Path(tmp)/'live-music.geojson').read_text())
            self.assertNotIn('Sunshine Markets',[s['name'] for s in music['sources']])


if __name__=='__main__': unittest.main()
