import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('tour_import', ROOT/'tools/special-events/enrich-studio-tour.py')
tour = importlib.util.module_from_spec(spec); spec.loader.exec_module(tour)
EVENT = {'dates':['2026-11-14','2026-11-15','2026-11-21','2026-11-22'], 'features':[]}

class OpeningHours(unittest.TestCase):
    def test_all_days_uses_published_hours(self):
        a = tour.opening('Open All Tour Dates Nov 14–15 & 21–22, 11am–5pm', EVENT)
        self.assertEqual(a['status'], 'published'); self.assertEqual(list(a['days']), EVENT['dates'])
        self.assertEqual(a['days']['2026-11-14'], [{'open':'11:00','close':'17:00'}])

    def test_selected_days_and_partial_hours(self):
        a = tour.opening('Open Saturday, Nov. 14th | 12:00pm - 3:00pm Sunday, Nov. 15th | 11:00am -', EVENT)
        self.assertEqual(a['days']['2026-11-14'], [{'open':'12:00','close':'15:00'}])
        self.assertEqual(a['days']['2026-11-15'], [])
        self.assertNotIn('2026-11-21', a['days'])

    def test_overnight_and_suspicious_order(self):
        a = tour.opening('Open Saturday, Nov. 14th | 5:00pm - 1:00am', EVENT)
        self.assertEqual(a['days']['2026-11-14'], [{'open':'17:00','close':'01:00','nextDay':True}])
        a = tour.opening('Open Saturday, Nov. 21st | 11:00pm - 6:00pm', EVENT)
        self.assertEqual(a['days']['2026-11-21'], [])

    def test_no_hours_are_not_all_days(self):
        for text in ('Open', 'Open Contact the artist', 'Open All Tour Dates'):
            a=tour.opening(text, EVENT); self.assertEqual(a['status'],'unknown'); self.assertEqual(a['days'],{})

    def test_other_dates_fail_instead_of_relabeling(self):
        with self.assertRaises(ValueError):tour.opening('Open Nov. 8 | 11am–5pm',EVENT)

    def test_multi_location_profile_keeps_each_schedule(self):
        raw='''<div data-elementor-type="single-post">
        <h2><a href="https://example.com/location/first/">71.</a></h2>
        <div><div><h6>Open</h6></div><div>Nov. 14-15 | 12:00pm–6:00pm</div></div>
        <h2><a href="https://example.com/location/second/">151.</a></h2>
        <div><div><h6>Open</h6></div><div>Nov. 21 | 12:00pm–4:00pm</div></div>
        </div><footer>Other dates must not be parsed.</footer>'''
        locations=tour.locations(raw,EVENT)
        self.assertEqual(list(locations[71]['days']),['2026-11-14','2026-11-15'])
        self.assertEqual(locations[151]['days'],{'2026-11-21':[{'open':'12:00','close':'16:00'}]})

    def test_empty_location_schedule_stays_unknown(self):
        raw='<div data-elementor-type="single-post"><h2><a href="/location/one/">1.</a></h2></div>'
        self.assertEqual(tour.locations(raw,EVENT)[1]['status'],'unknown')

if __name__ == '__main__': unittest.main()
