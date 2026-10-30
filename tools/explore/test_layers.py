"""Calendar boundaries, source failures and park geometry regression checks."""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import build_layers as b
import culture_sources as c

NOW = datetime(2026, 10, 28, 18, tzinfo=timezone.utc)


class Layers(unittest.TestCase):
    def row(self, **overrides):
        return dict(dict(title='Concert', theme='live-music', start=NOW+timedelta(hours=3),
                         end=None, url='https://example.org/calendar', venue='Venue',
                         address='1 Main St', coordinates=[-97.74,30.27]), **overrides)

    def test_unknown_price_and_end_are_not_invented(self):
        row=self.row(); p=b.event_feature(row,'Organizer',NOW)['properties']
        self.assertIsNone(p['price'])
        self.assertFalse(p['endKnown'])
        self.assertEqual(b.date(p['end']),row['start']+timedelta(seconds=1))
        self.assertEqual(b.date(p['expires']),row['start'])
        self.assertIsNone(b.event_feature(row,'Organizer',row['start']))
        for title in ['Canceled: concert','Sold out concert','Concert postponed']:
            self.assertIsNone(b.event_feature(self.row(title=title),'Organizer',NOW))

    def test_distinct_market_venues_and_expiry(self):
        a=b.event_feature(self.row(),'Austin Flea',NOW)
        other=b.event_feature(self.row(address='2 Main St'),'Austin Flea',NOW)
        self.assertNotEqual(a['id'],other['id'])
        later=b.event_feature(self.row(start=NOW+timedelta(days=4)),'Organizer',NOW)
        self.assertEqual(b.date(later['properties']['expires']),NOW+timedelta(hours=24))
        self.assertIsNone(b.event_feature(self.row(coordinates=[-96.8,32.7]),'Organizer',NOW))

    def test_failed_source_only_retains_until_original_expiry(self):
        old=b.event_feature(self.row(),'Offline',NOW)
        with TemporaryDirectory() as temp, patch.object(b,'OUT',Path(temp)):
            b.write('live-music',[old],NOW,[])
            def unavailable(_): raise ValueError('unavailable')
            sources=[('Offline','https://example.org',unavailable),('Healthy','https://example.org',lambda _:[])]
            with patch.object(b,'SOURCES',sources):
                with self.assertRaises(RuntimeError): b.events(NOW+timedelta(hours=1))
                snapshot=b.load_old('live-music')
                self.assertEqual(snapshot['features'],[old])
                self.assertFalse(snapshot['sources'][0]['ok'])
                with self.assertRaises(RuntimeError): b.events(NOW+timedelta(hours=4))
                self.assertEqual(b.load_old('live-music')['features'],[])
            b.write('live-music',[old],NOW,[])
            with patch.object(b,'SOURCES',[('Offline','https://example.org',lambda _:[])]):
                b.events(NOW+timedelta(hours=1))
                self.assertEqual(b.load_old('live-music')['features'],[],'removed/cancelled listings do not linger')

    def test_all_sources_fail_preserves_snapshot(self):
        with TemporaryDirectory() as temp, patch.object(b,'OUT',Path(temp)):
            b.write('live-music',[],NOW,[])
            before=(Path(temp)/'live-music.geojson').read_bytes()
            def fail(_): raise ValueError('offline')
            with patch.object(b,'SOURCES',[('Offline','https://example.org',fail)]):
                with self.assertRaises(RuntimeError): b.events(NOW+timedelta(hours=1))
            self.assertEqual((Path(temp)/'live-music.geojson').read_bytes(),before)

    def test_park_geometry_holes_and_inventory_status(self):
        outer=[[-97.8,30.2],[-97.6,30.2],[-97.6,30.4],[-97.8,30.4],[-97.8,30.2]]
        hole=[[-97.75,30.25],[-97.65,30.25],[-97.65,30.35],[-97.75,30.35],[-97.75,30.25]]
        geometry=dict(type='MultiPolygon',coordinates=[[outer,hole]])
        point=b.park_point(geometry)
        self.assertTrue(b.inside(point,outer));self.assertFalse(b.inside(point,hole))
        row=dict(the_geom=geometry,asset_status='Open',park_type='Neighborhood',development_status='Developed',
                 location_name='Test Park',address='1 Main St',asset_mgmt_id=1,asset_size='10')
        rows=[row,dict(row,asset_status='Closed',asset_mgmt_id=2),dict(row,development_status='Undeveloped',asset_mgmt_id=3),
              dict(row,park_type='Cemetery',asset_mgmt_id=4),dict(row,asset_size='20')]
        features=b.park_features(rows,NOW)
        self.assertEqual(len(features),1)
        p=features[0]['properties']
        self.assertEqual(p['acreage'],'20')
        self.assertNotIn('start',p);self.assertNotIn('expires',p)
        self.assertIsNone(p['price'])

    def test_fallout_cross_midnight_and_unknown_markup(self):
        html='''<article class="wfea-card-list-item"><h3><a href="https://example.org/show">Late improv</a></h3>
        <time>October 30, 2026, 11:30 pm - October 31, 2026, 12:30 am</time></article>'''
        with patch.object(c,'fetch',return_value=html.encode()):
            row=c.fallout(NOW)[0]
            self.assertEqual(row['end']-row['start'],timedelta(hours=1))
            self.assertEqual(row['end'].day,31)
        with patch.object(c,'fetch',return_value=b'<p>Calendar temporarily unavailable</p>'), patch('calendar_http.time.sleep'):
            with self.assertRaises(ValueError):c.fallout(NOW)

    def test_markets_only_use_explicit_dates(self):
        html='''<div data-testid="richTextElement">Hi Sign Brewing</div>
        <div data-testid="richTextElement">730 Shady Lane Saturday, October 31st 11am-4pm</div>
        <div data-testid="richTextElement">Every Saturday: no dated occurrence</div>'''
        with patch.object(c,'fetch',return_value=html.encode()):
            rows=c.flea(NOW)
            self.assertEqual(len(rows),1)
            self.assertEqual(rows[0]['start'].isoformat(),'2026-10-31T11:00:00-05:00')
            self.assertEqual(rows[0]['end'].hour,16)
            self.assertEqual(rows[0]['venue'],'Hi Sign Brewing')

    def test_ut_public_eligibility_all_day_and_dedup_id(self):
        event=dict(title='Orchestra concert',status='live',localist_url='https://calendar.utexas.edu/event/concert',
                   geo=dict(city='Austin',latitude=30.28,longitude=-97.73),location_name='Hall',
                   filters=dict(event_target_audience=[dict(name='General Public')]),
                   event_instances=[dict(event_instance=dict(start='2026-11-01T00:00:00-05:00',end=None,all_day=True))])
        data=dict(page=dict(total=1),events=[dict(event=event),dict(event=dict(event,description_text='UT ID required'))])
        with patch.object(c,'fetch',return_value=json.dumps(data).encode()):
            rows=c.university(NOW)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['theme'],'live-music')
        self.assertEqual(rows[0]['end'].isoformat(),'2026-11-02T00:00:00-06:00')
        self.assertTrue(rows[0]['allDay'])
        self.assertIsNone(c.classify('Documentary screening'))
        self.assertEqual(c.classify('Fall Carnival'),'festivals')


if __name__ == '__main__':
    unittest.main()
