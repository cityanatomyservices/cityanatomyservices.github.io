import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import json
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
        with patch.object(build, 'fetch', side_effect=[b'[]', stale]) as fetch:
            with self.assertRaisesRegex(ValueError, 'No verified library events'):
                build.library(NOW, [])
        self.assertIn('?austinchat_refresh=', fetch.call_args_list[1].args[0])

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
