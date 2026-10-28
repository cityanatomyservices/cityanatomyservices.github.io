"""Regression checks for music calendar dates, scope and partial failures."""
from datetime import datetime, timedelta, timezone
import json
import unittest
from unittest.mock import patch

from culture_sources import Page
import music_sources as m
import build_layers as b

NOW = datetime(2026, 10, 28, 18, tzinfo=timezone.utc)


class Music(unittest.TestCase):
    def setUp(self):
        p = patch('culture_sources.geocode', return_value=[-97.74, 30.27])
        p.start(); self.addCleanup(p.stop)

    def test_saxon_utc_dst_missing_venue_and_pagination(self):
        e = dict(status='publish', title='A concert', url='https://thesaxonpub.com/event/concert/',
                 utc_start_date='2026-11-02 00:00:00', utc_end_date='2026-11-02 01:30:00', venue={})
        first = dict(total_pages=2, events=[dict(e, title='Canceled concert'), dict(e, hide_from_listings=True)])
        second = dict(total_pages=2, events=[e])
        with patch.object(m, 'fetch', side_effect=[json.dumps(first), json.dumps(second)]) as get:
            rows = m.saxon(NOW)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['start'].isoformat(), '2026-11-01T18:00:00-06:00')
        self.assertEqual((rows[0]['end']-rows[0]['start']).total_seconds(), 5400)
        self.assertIn('page=2', get.call_args_list[1].args[0])

    def test_timely_unknown_duration_cancellations_and_venue_scope(self):
        e = dict(title='A band', event_status='confirmed', instant_event=True,
                 start_utc_datetime='2026-10-31 03:00:00', end_utc_datetime='2026-10-31 04:59:59',
                 taxonomies={'taxonomy_venue':[{'id':1}]}, url='https://events.timely.fun/test/event/1')
        data = {'has_next':False, 'items':{'2026-10-30':[e, dict(e, event_status='cancelled'), dict(e, allday=True)]}}
        rows = m.timely_rows(data, NOW, {1:('Club','1 Main St')})
        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0]['end'], 'do not show synthetic midnight as a real end time')
        with self.assertRaisesRegex(ValueError, 'truncated'):
            m.timely_rows(dict(data, has_next=True), NOW, {1:('Club','1 Main St')})
        with self.assertRaisesRegex(ValueError, 'Unexpected'):
            m.timely_rows(data, NOW, {2:('Other Club','2 Main St')})

    def band_page(self, title, day, clock, href, next_page=''):
        return Page(f'''<tr><td class="event-name"><a href="{href}">{title}</a></td>
        <td class="date-long"><time class="from"><span class="date">{day}</span>
        <span class="time">{clock}</span></time></td></tr>{next_page}''').root

    def test_bandzoogle_follows_calendar_pages_and_honors_show_time(self):
        one = self.band_page('Band – doors at 4pm, show at 4:30pm', 'Sunday, November 1', '4:00PM', '/event/1',
                             '<a rel="next" href="/calendar/features/load/calendar.turbo_stream?calendar_page=2">Next</a>')
        two = self.band_page('Later band', 'Friday, November 13', '8:00PM', '/event/2')
        with patch.object(m, 'page', side_effect=[one, two]) as get:
            rows = m.bandzoogle(NOW, 'https://club.example/calendar', 'Club', '1 Main St')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['start'].isoformat(), '2026-11-01T16:30:00-06:00')
        self.assertIn('.turbo_stream?calendar_page=2', get.call_args_list[1].args[0])
        self.assertIsNone(rows[0]['end'])
        with patch.object(m, 'page', side_effect=[one, one]):
            with self.assertRaisesRegex(ValueError, 'repeated page'):
                m.bandzoogle(NOW, 'https://club.example/calendar', 'Club', '1 Main St')

    def test_bandzoogle_new_year(self):
        now = datetime(2026, 12, 30, 18, tzinfo=timezone.utc)
        self.assertEqual(m.month_day('Friday, January 1', '8:00PM', now).year, 2027)
        self.assertEqual(m.month_day('Tuesday, December 29', '8:00PM', now).year, 2026)

    def test_mohawk_uses_show_time_and_rejects_sold_out_or_non_music(self):
        e = dict(title='Band', city='Austin', venue='Mohawk Indoor', availability='AVAILABLE', lineup=['Band'],
                 date='11/1/2026', time='8:00pm', doorsTime='7:00pm', thirdPartyLink='https://tickets.example/band')
        data = 'callback('+json.dumps({'events':[e, dict(e, availability='SOLD_OUT'), dict(e, lineup=[])]})+');'
        with patch.object(m, 'fetch', return_value=data.encode()):
            rows = m.mohawk(NOW)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['start'].isoformat(), '2026-11-01T20:00:00-06:00')
        self.assertEqual(rows[0]['description'], 'Mohawk Indoor')

    def test_bangers_uses_separate_local_clock_fields_not_epoch_dates(self):
        e = dict(title='Live Music', description='Brass band', start=0, end=0, startDate='2026-11-01', endDate='2026-11-01',
                 startHour=11, startMinutes=30, endHour=14, endMinutes=30)
        rows = m.bangers_rows({'result':True, 'value':[e, dict(e, title='Beer special'), dict(e, description='Private party')]}, NOW)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['start'].isoformat(), '2026-11-01T11:30:00-06:00')
        self.assertEqual(rows[0]['end'].hour, 14)
        with self.assertRaises(ValueError): m.bangers_rows({'result':False}, NOW)

    def test_whitehorse_keeps_midnight_sets_not_cover_charges_or_lessons(self):
        e = dict(title='Honky tonk band', start_time='2026-10-31T23:55:00-05:00', end_time='2026-11-01T01:45:00-05:00')
        rows = m.whitehorse_rows({'result':True, 'events':[e, dict(e, title='$10 Cover'), dict(e, title='Two Step Lessons'),
                                                       dict(e, title='DJ party')]}, NOW)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['end'].day, 1)
        self.assertEqual(rows[0]['start'].hour, 23)

    def test_sahara_lineup_overrides_incorrect_calendar_time_and_skips_ambiguity(self):
        html = '''<div class="CalEvent"><div class="TimeLabel">9 AM - 10 AM</div><div class="EventLink">
        <a href="JavaScript:PopupWindow ('sahara', '2026/10/31', '1', '', '250', '350')">
        Halloween<br>7p Africa Night Buffet<br>7:30 Afro Jazz<br>9p System Positif<br>11p Zoumountchi<br>12a Late Band
        <br>12p private event<br>1p DJ Party<br>2p Dance Lessons</a></div></div>'''
        rows = m.sahara_rows(Page(html).root, NOW)
        self.assertEqual([r['title'] for r in rows], ['System Positif', 'Zoumountchi', 'Late Band'])
        self.assertEqual(rows[-1]['start'].isoformat(), '2026-11-01T00:00:00-05:00')
        self.assertTrue(all(r['end'] is None for r in rows))

    def test_abgb_excludes_movies_sports_and_doors_only_events(self):
        html = '<div class="day-card" data-date="2026-10-30">'
        details = ''
        for n, title, detail, times in [(1,'A band','Show starts at 8pm','8pm-10pm'),
                                       (2,'Twilight on Halloween','Showing part 1 and last','6pm-10pm'),
                                       (3,'College Football','Watch the game','11am-11pm'),
                                       (4,'Band Jam','Doors 7:30pm','7pm-12am'),
                                       (5,'Latin Dukes','After football','All day')]:
            html += f'<div class="calendar-day-event" data-event-id="{n}"><span class="ev-title">{title}</span><span class="ev-time">{times}</span></div>'
            details += f'<div id="{n}">{title} {detail}</div>'
        with patch.object(m, 'page', return_value=Page(html+'</div>'+details).root): rows = m.abgb(NOW)
        self.assertEqual([r['title'] for r in rows], ['A band'])

    def test_failed_music_source_retains_only_its_unexpired_records(self):
        r = m.row('A band', NOW+timedelta(days=1), None, 'https://club.example/show', 'Club','1 Main St')
        f = b.event_feature(r, 'Saxon Pub', NOW)
        expired = b.event_feature(dict(r, start=NOW+timedelta(hours=1)), 'Saxon Pub', NOW)
        healthy = b.event_feature(r, 'Banger’s', NOW)
        kept = b.retained([f,expired,healthy], {'Saxon Pub'}, NOW+timedelta(hours=2))
        self.assertEqual(kept, [f])
        self.assertEqual(kept[0]['properties']['checked'], NOW.isoformat())


if __name__ == '__main__': unittest.main()
