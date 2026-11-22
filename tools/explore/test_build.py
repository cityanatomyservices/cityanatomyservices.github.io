import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import xml.etree.ElementTree as ET
import build

NOW = datetime(2026, 10, 28, 15, tzinfo=timezone.utc)

class BuildTests(unittest.TestCase):
    def test_price_never_guesses_free(self):
        for cost, text in [(None, 'Free food for everyone'), (None, 'This event is free for UT students'),
                           ('From $10', ''), ('$0 students / $35 public', ''), ('$25', ''), (None, '')]:
            self.assertIsNone(build.price(cost, text))
        self.assertEqual(build.price(None, 'Free and open to the public.'), (0, 'Free'))
        self.assertEqual(build.price('$5–$15'), (15, '$5–$15'))
        self.assertEqual(build.price('Free'), (0, 'Free'))

    def test_feature_validity_and_freshness(self):
        fields = dict(title='Example', url='https://example.org/event', venue='Venue', address='Austin',
                      lng=-97.75, lat=30.27, start=NOW, end=NOW + timedelta(days=2), cost=0,
                      price_label='Free', source='Test', checked=NOW)
        f = build.feature(**fields)
        self.assertEqual(build.date(f['properties']['expires']), NOW + timedelta(hours=24))
        for replacement in [dict(lng=None), dict(lat=50), dict(cost=-1), dict(cost=50), dict(url='javascript:alert(1)')]:
            self.assertIsNone(build.feature(**(fields | replacement)))
        self.assertFalse(build.valid_cached(f, NOW + timedelta(days=2)))

    def test_library_metadata_controls_admission_cancellation_and_end_time(self):
        item = ET.fromstring('<item><title>Workshop</title><link>https://library.austintexas.gov/event/test</link><description>Central Library - Bring supplies.</description></item>')
        branches = {'Central Library': {'address': {'longitude': '-97.75', 'latitude': '30.27', 'human_address': '{"address":"710 W Cesar Chavez"}'}}}
        event = {'@type': 'Event', 'startDate': '2026-10-28T12:00:00-05:00', 'endDate': '2026-10-28T13:00:00-05:00',
                 'isAccessibleForFree': True, 'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode', 'eventStatus': 'https://schema.org/EventScheduled'}
        def run(e):
            html = '<script type="application/ld+json">'+json.dumps({'@graph': [e]})+'</script>Free and open to the public'
            with patch.object(build, 'fetch', return_value=html.encode()):
                return build.library_event(item, branches, NOW)
        self.assertEqual(run(event)['properties']['end'], '2026-10-28T13:00:00-05:00')
        self.assertIsNone(run(event | {'eventStatus': 'https://schema.org/EventCancelled'}))
        self.assertIsNone(run(event | {'isAccessibleForFree': False}))
        self.assertIsNone(run(event | {'endDate': None}))
        self.assertIsNone(run(event | {'eventAttendanceMode': 'https://schema.org/OnlineEventAttendanceMode'}))

    def test_stale_library_feed_cannot_silently_clear_existing_data(self):
        stale = b'<rss><channel><item><pubDate>Mon, 12 Oct 2026 09:30:00 -0500</pubDate></item></channel></rss>'
        locations = b'[{"name":"Central Library","address":{}}]'
        with patch.object(build, 'fetch', side_effect=[locations, stale, stale, stale]) as fetch, patch('calendar_http.time.sleep'):
            with self.assertRaisesRegex(ValueError, 'no current event records'):
                build.library(NOW, [])
        self.assertIn('?austinchat_refresh=', fetch.call_args_list[1].args[0])
        self.assertEqual(fetch.call_count, 4)

    def test_library_timeout_recovers_without_adding_socrata_query(self):
        locations = b'[{"name":"Central Library","address":{}}]'
        rss = b'<rss><channel><item><title>Today</title><pubDate>Wed, 28 Oct 2026 12:00:00 -0500</pubDate></item></channel></rss>'
        with patch.object(build, 'fetch', side_effect=[TimeoutError('timeout'), locations, rss]) as fetch, \
                patch.object(build, 'library_event', return_value={'type': 'Feature'}), patch('calendar_http.time.sleep'):
            self.assertEqual(build.library(NOW, []), ([{'type': 'Feature'}], 0))
        self.assertEqual(fetch.call_args_list[0].args[0], build.BRANCHES)
        self.assertEqual(fetch.call_args_list[1].args[0], build.BRANCHES)
        self.assertEqual(fetch.call_args_list[0].kwargs['timeout'], 45)

    def test_partial_failure_publishes_healthy_data_then_signals_failure(self):
        fields = dict(title='Example', url='https://example.org/event', venue='Venue', address='Austin',
                      lng=-97.75, lat=30.27, start=NOW+timedelta(hours=1), end=NOW+timedelta(days=2),
                      cost=0, price_label='Free', checked=NOW)
        old = build.feature(**fields, source='Austin Public Library')
        fresh = build.feature(**fields, source='UT Austin')
        with TemporaryDirectory() as temp, patch.object(build, 'ROOT', Path(temp)), \
                patch.object(build, 'OUT', Path(temp)/'feed.json'), \
                patch.object(build, 'datetime', wraps=datetime) as clock, \
                patch.object(build, 'library', side_effect=TimeoutError('timed out')), \
                patch.object(build, 'university', return_value=([fresh], 0)), \
                patch.object(build, 'curated', return_value=([], 0)):
            clock.now.return_value = NOW + timedelta(hours=2)
            # A distinct occurrence prevents deduplication with the fresh UT row.
            old['properties']['title'] = 'Library event'
            build.OUT.write_text(json.dumps({'features': [old]}))
            with self.assertRaisesRegex(RuntimeError, 'Austin Public Library'):
                build.build()
            build.build(allow_partial=True)
            output = json.loads(build.OUT.read_text())
            self.assertEqual(len(output['features']), 2)
            self.assertEqual(output['features'][0]['properties']['expires'], old['properties']['expires'])
            self.assertFalse(output['sources'][0]['ok'])
            self.assertEqual(output['sources'][0]['error'], 'timed out')
            with patch.object(build, 'university', side_effect=TimeoutError('offline')):
                before = build.OUT.read_bytes()
                with self.assertRaisesRegex(RuntimeError, 'Both live sources failed'):
                    build.build(allow_partial=True)
                self.assertEqual(build.OUT.read_bytes(), before)

    def test_library_metadata_retries_an_incomplete_page(self):
        event = {'@type': 'Event', 'startDate': '2026-10-28T12:00:00-05:00', 'endDate': '2026-10-28T13:00:00-05:00',
                 'isAccessibleForFree': True, 'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode'}
        item = ET.fromstring('<item><title>Workshop</title><link>https://library.austintexas.gov/event/test</link><description>Central Library - Workshop</description></item>')
        branches = {'Central Library': {'address': {'longitude': '-97.75', 'latitude': '30.27', 'human_address': '{"address":"710 W Cesar Chavez"}'}}}
        html = ('<script type="application/ld+json">'+json.dumps(event)+'</script>Free and open to the public').encode()
        with patch.object(build, 'fetch', side_effect=[b'<html>Unavailable</html>', html]), patch('calendar_http.time.sleep'):
            self.assertIsNotNone(build.library_event(item, branches, NOW))

    def test_ut_public_price_and_occurrences(self):
        e = dict(status='live', title='Concert', localist_url='https://calendar.utexas.edu/event/test', ticket_cost='$15',
                 filters={'event_target_audience':[{'name':'General Public'}]},
                 geo={'city':'Austin','latitude':'30.28','longitude':'-97.73'},
                 event_instances=[{'event_instance':{'start':'2026-10-29T19:00:00-05:00','end':'2026-10-29T21:00:00-05:00'}},
                                  {'event_instance':{'start':'2026-10-27T19:00:00-05:00','end':'2026-10-27T21:00:00-05:00'}}])
        def run(event):
            with patch.object(build, 'fetch', return_value=json.dumps({'page':{'total':1},'events':[{'event':event}]}).encode()):
                return build.university(NOW)[0]
        self.assertEqual(len(run(e)),1)
        self.assertEqual(run(e)[0]['properties']['price'],15)
        self.assertEqual(run(e | {'ticket_cost': None}),[])
        self.assertEqual(run(e | {'filters': {'event_target_audience':[{'name':'Students'}]}}),[])
        self.assertEqual(run(e | {'description_text':'Requires UT ID'}),[])

if __name__ == '__main__':
    unittest.main()
