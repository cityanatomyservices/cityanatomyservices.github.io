import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
import build_movies as movies

NOW = datetime(2026, 10, 28, 17, tzinfo=timezone.utc)
VENUE = dict(name='Cinema', address='Austin', coordinates=[-97.74, 30.28], tags=['dine-in'])


class MovieTests(unittest.TestCase):
    def test_grouping_dates_expiry_and_unknown_price(self):
        def row(start):
            return movies.screening('A Film', VENUE, start, 'https://example.org/tickets', NOW)
        first, second = row('2026-10-29T13:00:00-05:00'), row('2026-10-29T18:00:00-05:00')
        self.assertIsNone(row('2026-10-28T10:00:00-05:00'))
        grouped = movies.group([first, first, second, row('2026-10-30T13:00:00-05:00')], 'Test', NOW)
        self.assertEqual(len(grouped), 2)
        p = grouped[0]['properties']
        self.assertEqual(len(p['showtimes']), 2)
        self.assertIsNone(p['price'])
        self.assertEqual(movies.date(p['expires']), NOW + timedelta(hours=12))
        self.assertFalse(movies.valid_cached(grouped[0], NOW + timedelta(hours=13)))
        self.assertIsNone(movies.screening('Bad', VENUE, '2026-10-29T13:00:00-05:00', 'javascript:alert(1)', NOW))

    def test_alamo_onsale_only_and_austin_timezone_after_dst(self):
        show = dict(id='123', dateTime='2026-11-01T19:00:00', status='onsale', formatName='Digital')
        cinema = dict(id='0004', name='South Lamar', address='1120 S Lamar', city='Austin, TX', timeZoneATE='America/Chicago',
                      longitude=-97.76, latitude=30.25, sessions=[show, show | {'id':'2', 'status':'notonsale'}, show | {'id':'3', 'status':'past'}])
        payload = {'data': {'sessionsGenerated': NOW.isoformat(), 'market': {'films': [dict(slug='film', name='Film', runtime='100',
                            dates=[dict(cinemas=[cinema])])]}}}
        records, _ = movies.alamo_records(payload, NOW)
        self.assertEqual(len(records), 1)
        self.assertTrue(records[0]['start'].endswith('-06:00'))
        self.assertEqual(records[0]['tags'], ['dine-in'])
        payload['data']['sessionsGenerated'] = (NOW-timedelta(days=2)).isoformat()
        with self.assertRaisesRegex(ValueError, 'stale'):
            movies.alamo_records(payload, NOW)

    def test_violet_requires_available_uncancelled_screening(self):
        e = dict(**{'@type':'ScreeningEvent'}, name='Film', startDate='2026-10-29T18:00:00-05:00',
                 url='https://austin.violetcrown.com/checkout/showing/film/123/', offers={'availability':'https://schema.org/InStock'})
        def run(event):
            page = '<script type="application/ld+json">'+json.dumps(event)+'</script>'
            return movies.violet_records(page, NOW, VENUE)[0]
        self.assertEqual(len(run(e)), 1)
        self.assertEqual(run(e | {'offers': {'availability':'https://schema.org/SoldOut'}}), [])
        self.assertEqual(run(e | {'eventStatus':'https://schema.org/EventCancelled'}), [])
        self.assertEqual(run(e | {'url':'https://unrelated.example/tickets'}), [])

    def test_imax_calendar_excludes_spirit_and_rejects_wrong_date(self):
        card = '<li class="Listing-item type-showtime"><article>IMAX Theatre<a class="Listing-title-link " href="https://www.thestoryoftexas.com/films/example/">Example <span>3D</span></a><time class="Listing-times-item" datetime="2026-10-29T13:00:00"></time></article></li>'
        settings = '<script>window.FWP_JSON = '+json.dumps({'preload_data': {'settings': {'pager': {'total_rows': 1, 'total_pages': 2}}}})+';</script>'
        day = datetime(2026,10,29).date()
        rows, pages = movies.bullock_page(card+settings, day, NOW)
        self.assertEqual(pages, 2)
        self.assertEqual(rows[0]['format'], 'IMAX 3D')
        self.assertEqual(movies.bullock_page(card.replace('IMAX Theatre','Texas Spirit Theater')+settings, day, NOW)[0], [])
        with self.assertRaisesRegex(ValueError, 'date filter'):
            movies.bullock_page(card+settings, day+timedelta(days=1), NOW)
        with self.assertRaisesRegex(ValueError, 'markup'):
            movies.bullock_page(settings, day, NOW)

    def test_source_failure_keeps_only_unexpired_data_without_renewing(self):
        row = movies.screening('Film', VENUE, NOW + timedelta(hours=2), 'https://example.org/tickets', NOW)
        prior = movies.group([row], 'Alamo Drafthouse', NOW - timedelta(hours=3))[0]
        expired = json.loads(json.dumps(prior))
        expired['properties'].update(id='expired', expires=(NOW-timedelta(seconds=1)).isoformat())
        with TemporaryDirectory() as folder, patch.object(movies, 'datetime') as clock:
            clock.now.return_value = NOW
            path = Path(folder)/'movies.geojson'
            path.write_text(json.dumps({'features': [prior, expired]}))
            with patch.object(movies, 'OUT', path), patch.object(movies, 'alamo', side_effect=ValueError('offline')), patch.object(movies, 'violet', side_effect=ValueError('offline')), patch.object(movies, 'bullock', return_value=([], 0, [])):
                movies.build()
                output = json.loads(path.read_text())
                self.assertEqual(output['features'], [prior])
                self.assertFalse(output['sources'][0]['ok'])
                before = path.read_text()
                with patch.object(movies, 'bullock', side_effect=ValueError('offline')):
                    with self.assertRaisesRegex(RuntimeError, 'All movie sources failed'):
                        movies.build()
                self.assertEqual(path.read_text(), before)


if __name__ == '__main__':
    unittest.main()
