"""Recovery from the incomplete responses seen in scheduled calendar imports."""
from datetime import datetime, timezone
import json
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from urllib.parse import parse_qs, urlsplit

from calendar_http import read_calendar
import culture_sources as c
import music_sources as m

NOW = datetime(2026, 10, 30, 18, tzinfo=timezone.utc)


class CalendarHTTP(unittest.TestCase):
    def setUp(self):
        for target, value in [('calendar_http.time.sleep', None),
                              ('culture_sources.geocode', [-97.74, 30.27])]:
            p = patch(target, return_value=value)
            p.start(); self.addCleanup(p.stop)

    def test_fallout_incomplete_page_recovers_without_losing_midnight_show(self):
        html = b'''<article class="wfea-card-list-item"><h3><a href="https://falloutcomedy.com/show/">Late improv</a></h3>
        <time>October 30, 2026, 11:30 pm - October 31, 2026, 12:30 am</time></article>'''
        with patch.object(c, 'fetch', side_effect=[b'<html>Temporarily unavailable</html>', html]) as get:
            rows = c.fallout(NOW)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['end'].day, 31)
        self.assertEqual((rows[0]['end']-rows[0]['start']).total_seconds(), 3600)
        self.assertIn('austinchat_refresh=', get.call_args_list[1].args[0])

    def test_saxon_retries_only_failed_page_and_preserves_query_and_dst(self):
        event = dict(status='publish', title='A concert', url='https://thesaxonpub.com/event/concert/',
                     utc_start_date='2026-11-02 00:00:00', utc_end_date='2026-11-02 01:30:00')
        responses = [json.dumps(dict(total_pages=2, events=[])), b'', b'<html>Unavailable</html>',
                     json.dumps(dict(total_pages=2, events=[event]))]
        with patch.object(m, 'fetch', side_effect=responses) as get:
            rows = m.saxon(NOW)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['start'].isoformat(), '2026-11-01T18:00:00-06:00')
        queries = [parse_qs(urlsplit(call.args[0]).query) for call in get.call_args_list]
        self.assertNotIn('page', queries[0])
        for query in queries[1:]:
            self.assertEqual(query['page'], ['2'])
            self.assertEqual(query['start_date'], queries[0]['start_date'])
            self.assertEqual(query['end_date'], queries[0]['end_date'])

    def test_persistent_failure_raises_after_bounded_attempts(self):
        get = Mock(return_value=b'')
        with self.assertRaisesRegex(ValueError, 'after 3 attempts.*empty response'):
            read_calendar('https://calendar.example/', json.loads, get)
        self.assertEqual(get.call_count, 3)

    def test_timeout_recovers_but_access_denial_is_not_retried(self):
        get = Mock(side_effect=[TimeoutError('timed out'), b'[]'])
        self.assertEqual(read_calendar('https://calendar.example/', json.loads, get), [])
        self.assertEqual(get.call_count, 2)
        get = Mock(side_effect=HTTPError('https://calendar.example/', 403, 'Forbidden', {}, None))
        with self.assertRaises(HTTPError):
            read_calendar('https://calendar.example/', json.loads, get)
        self.assertEqual(get.call_count, 1)

    def test_saxon_valid_empty_calendar_succeeds_but_error_json_does_not(self):
        with patch.object(m, 'fetch', return_value=b'{"total_pages":0,"events":[]}') as get:
            self.assertEqual(m.saxon(NOW), [])
            self.assertEqual(get.call_count, 1)
        with patch.object(m, 'fetch', return_value=b'{"code":"service_unavailable"}') as get:
            with self.assertRaisesRegex(ValueError, 'after 3 attempts'):
                m.saxon(NOW)
            self.assertEqual(get.call_count, 3)
