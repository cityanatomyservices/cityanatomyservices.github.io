from datetime import datetime, timedelta
import json
import unittest
from unittest.mock import patch
import build

NOW = datetime(2026, 11, 2, 9, tzinfo=build.TZ)


def card(title='Music Commission - Regular Meeting', when='2026-11-02T23:30:00Z'):
    return f'''<div class="event-listing-data"><time datetime="{when}">November 2</time>
    <div class="views-field-title"><a href="/boards-commissions/events/music">{title}</a></div>
    <p><span class="organization">City Hall</span><br><span class="address-line1">301 W. 2nd</span></p></div>'''


class ImportTests(unittest.TestCase):
    def test_calendar_timezone_board_and_cancellation(self):
        rows, _ = build.listing_page(card(), 'meetings')
        self.assertEqual(rows[0]['date'], '2026-11-02T17:30:00-06:00')
        self.assertEqual(rows[0]['board'], 'Music Commission')
        self.assertEqual(rows[0]['scope'], 'citywide')
        self.assertEqual(rows[0]['districts'], [])
        with patch.object(build, 'fetch', return_value=card('CANCELLED: Music Commission - Regular Meeting')):
            self.assertEqual(build.city_list(build.CITY, 'meetings', NOW), [])

    def test_calendar_pagination_and_structural_failure(self):
        first = card() + '<li class="pager__item--next"><a href="?page=1">Next</a></li>'
        second = card('Planning Commission - Regular Meeting', '2026-11-04T23:00:00Z')
        with patch.object(build, 'fetch', side_effect=[first, second]) as get:
            self.assertEqual(len(build.city_list(build.CITY + '/boards-commissions/events', 'meetings', NOW)), 2)
            self.assertEqual(get.call_args.args[0], build.CITY + '/boards-commissions/events?page=1')
        with self.assertRaises(ValueError):
            build.listing_page('<html>Service unavailable</html>', 'meetings')
        self.assertEqual(build.listing_page('<div class="view-empty">No events</div>', 'meetings'), ([], None))

    def test_council_only_explicit_convening_time(self):
        index = '<a href="/council/2026/20261105-reg">November 5, 2026 Austin City Council Regular Meeting</a>'
        detail = '<h3>9:00 AM – Proclamations</h3><h3>10:00 AM – City Council Convenes</h3><p>Updated 11:00 AM</p>'
        with patch.object(build, 'fetch', side_effect=[index, detail]):
            rows = build.council(NOW)
        self.assertEqual(rows[0]['date'], '2026-11-05T10:00:00-06:00')
        self.assertFalse(rows[0]['dateOnly'])
        with patch.object(build, 'fetch', side_effect=[index, '<p>Updated 11:00 AM</p>']):
            self.assertTrue(build.council(NOW)[0]['dateOnly'])

    def test_source_failure_keeps_only_unexpired_without_renewal(self):
        good = build.record('meetings', 'Test meeting', NOW + timedelta(days=1), build.CITY + '/events/test')
        good.update(source='test', expires=(NOW + timedelta(hours=1)).isoformat())
        old = dict(good, id='old', expires=(NOW - timedelta(hours=1)).isoformat())
        checked = (NOW - timedelta(hours=3)).isoformat()
        previous = {'sources': [{'id': 'test', 'checked': checked}], 'records': [good, old]}
        def fail(_):
            raise ValueError('offline')
        out = build.assemble(NOW, previous, [('test', 'Test', build.CITY, 'meetings', fail)])
        self.assertEqual(out['records'], [good])
        self.assertEqual(out['sources'][0]['checked'], checked)
        self.assertFalse(out['sources'][0]['ok'])

    def test_successful_empty_clears_previous(self):
        out = build.assemble(NOW, {'records': [{'source': 'test'}]}, [('test', 'Test', build.CITY, 'meetings', lambda _: [])])
        self.assertEqual(out['records'], [])
        self.assertTrue(out['sources'][0]['ok'])

    def test_soda_paginates(self):
        with patch.object(build, 'fetch', side_effect=[json.dumps([{'id': i} for i in range(1000)]), '[{"id":1000}]']) as get:
            rows = build.soda('3syk-w9eu', 'id', 'id > 0', 'id')
        self.assertEqual(len(rows), 1001)
        self.assertIn('%24offset=1000', get.call_args.args[0])

    def test_permits_keep_district_and_drop_contact_information(self):
        row = {'permit_number': '2026-123 BP', 'issue_date': '2026-11-01T00:00:00', 'link': {'url': 'https://abc.austintexas.gov/web/permit/test'},
               'council_district': '10', 'applicant_phone': 'private', 'contractor_full_name': 'private'}
        result = build.permit_rows([row])[0]
        self.assertEqual(result['districts'], ['10'])
        self.assertNotIn('private', json.dumps(result))
        self.assertEqual(build.districts('1, 2, 10'), ['1', '2', '10'])
        with self.assertRaises(ValueError):
            build.official_url('https://austintexas.gov.example.com')


if __name__ == '__main__':
    unittest.main()
