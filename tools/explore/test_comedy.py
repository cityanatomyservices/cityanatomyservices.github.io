"""Protect showtime, location, availability and calendar-boundary behavior."""
from datetime import datetime, timezone
import json
import unittest
from unittest.mock import patch

import comedy_sources as c
from culture_sources import Page

NOW = datetime(2026, 10, 28, 18, tzinfo=timezone.utc)


def schema_page(events, extra=''):
    return Page('<script type="application/ld+json">'+json.dumps({'@graph':events})+'</script>'+extra).root


def event(**updates):
    return dict(dict({'@type':'ComedyEvent'}, name='A comedy show', startDate='2026-10-30T23:30:00-05:00',
                     endDate='2026-10-31T00:30:00-05:00', url='https://club.example/shows/1',
                     location={'address':{'addressLocality':'Austin'}},
                     offers=[{'availability':'https://schema.org/InStock'}]), **updates)


class Comedy(unittest.TestCase):
    def setUp(self):
        for target in ['comedy_sources.geocode','culture_sources.geocode']:
            p=patch(target,return_value=[-97.74,30.27]);p.start();self.addCleanup(p.stop)

    def test_structured_dates_cancellations_and_ticket_types(self):
        events=[event(), event(name='cancelled',eventStatus='https://schema.org/EventCancelled'),
                event(name='postponed',eventStatus='https://schema.org/EventPostponed'),
                event(name='sold out',offers=[{'availability':'https://schema.org/SoldOut'}]),
                event(name='VIP remains',offers=[{'availability':'https://schema.org/SoldOut'},{'availability':'https://schema.org/InStock'}]),
                event(name='different city',location={'address':{'addressLocality':'Dallas'}}),
                event(name='too far ahead',startDate='2027-01-01T20:00:00-06:00',endDate=None)]
        rows=c.structured_events(schema_page(events),NOW,'Club','1 Main St')
        self.assertEqual([r['title'] for r in rows],['A comedy show','VIP remains'])
        self.assertEqual((rows[0]['end']-rows[0]['start']).total_seconds(),3600)
        self.assertNotIn('price',rows[0],'do not infer free or all-in admission from ticket categories')
        with self.assertRaises(ValueError):c.structured_events(Page('<p>Offline</p>').root,NOW,'Club','Address')

    def test_seatengine_next_month_and_sold_out_sessions(self):
        base='https://club.example/calendar'
        events=[event(),event(name='Next month',startDate='2026-11-05T20:00:00-06:00',endDate=None,url='https://club.example/shows/2'),
                event(name='Sold out',url='https://club.example/shows/3')]
        october=schema_page(events,'<a href="/shows/1">11:30 PM</a><a class="inactive" href="/shows/3">Sold Out</a>')
        november=schema_page(events,'<a href="/shows/2">8:00 PM</a>')
        with patch.object(c,'get_page',side_effect=[october,november]) as get:
            rows=c.seatengine(NOW,base,'Club','Address')
        self.assertEqual([r['title'] for r in rows],['A comedy show','Next month'])
        self.assertEqual(get.call_args_list[1].args[0],base+'?month=11&year=2026')

    def squad_event(self, **updates):
        return dict(dict(id=1,name='Late show',host={'id':9165465},privacy='public',sold_out=False,
                         location_type='In-Person',show_start_date=True,start_at='2026-10-31T23:30:00-05:00',
                         end_at='2026-11-01T01:30:00-05:00',url='https://squadup.com/events/late-show',
                         name_line_2='LITTLE BOY',location={'address_line_1':'320 E 6th St, Austin TX',
                                                        'longitude':'-97.7395','latitude':'30.2674'}), **updates)

    def test_squadup_public_embed_availability_and_rooms(self):
        data={'meta':{'paging':{'total_pages':1}},'events':[
            self.squad_event(), self.squad_event(id=2,sold_out=True),self.squad_event(id=3,privacy='invite-only'),
            self.squad_event(id=4,location_type='Online'),self.squad_event(id=5,show_start_date=False),
            self.squad_event(id=6,privacy='private',name='Public venue embed, unlisted in directory',
                             location={'address_line_1':'320 E 6th St, Austin TX','longitude':'-97.7394','latitude':'30.2673'})]}
        with patch.object(c,'fetch',return_value=json.dumps(data).encode()):
            rows=c.squadup(NOW,9165465,'Comedy Mothership')
        self.assertEqual(len(rows),2)
        self.assertEqual(rows[0]['description'],'Room: Little Boy')
        self.assertEqual(rows[0]['start'].utcoffset().total_seconds(),-5*3600)
        self.assertEqual(rows[0]['end'].date().day,1)
        self.assertEqual(rows[0]['coordinates'],rows[1]['coordinates'],'same address should share a map pin')

    def test_squadup_rejects_wrong_host_and_truncated_feed(self):
        data={'meta':{'paging':{'total_pages':2}},'events':[self.squad_event()]}
        with patch.object(c,'fetch',return_value=json.dumps(data).encode()):
            with self.assertRaisesRegex(ValueError,'partial import'):c.squadup(NOW,9165465,'Club')
        data['meta']['paging']['total_pages']=1
        data['events'][0]['host']['id']=999
        with patch.object(c,'fetch',return_value=json.dumps(data).encode()):
            with self.assertRaisesRegex(ValueError,'another host'):c.squadup(NOW,9165465,'Club')

    def test_coldtowne_local_time_and_non_show_products(self):
        data=[{'title':'Improv','start':'2026-11-05 20:30','end':'2026-11-05 21:30','url':'https://coldtownetheater.com/show/improv/'},
              {'title':'Enroll in class','start':'2026-11-05 20:30','url':'https://coldtownetheater.com/classes/level-one/'}]
        with patch.object(c,'fetch',return_value=json.dumps(data).encode()) as fetch:
            rows=c.coldtowne(NOW)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['start'].isoformat(),'2026-11-05T20:30:00-06:00')
        self.assertIn('tcec_get_events',fetch.call_args.args[0])

    def test_hideout_current_annex_and_explicit_times(self):
        html='''<div class="em-calendar"><div class="em-event">
        <img alt="Late improv"><div class="em-event-date">Fri. Oct 30th, 2026</div>
        <div class="em-event-time">11:30 pm (CDT)-12:30 am (CDT)</div>
        <div class="em-event-location"><a href="https://hideouttheatre.com/locations/hideout-annex/">Hideout Annex – back</a></div>
        <a href="https://hideouttheatre.com/events/categories/shows/">Shows</a>
        <a class="em-item-read-more" href="https://hideouttheatre.com/events/test/">More Info</a>
        </div></div>'''
        with patch.object(c,'get_page',side_effect=[Page(html).root,Page('<div class="em-calendar"></div>').root]):
            rows=c.hideout(NOW)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['address'],'5555 N Lamar Blvd Austin TX')
        self.assertEqual(rows[0]['end'].isoformat(),'2026-10-31T00:30:00-05:00')

    def test_creek_follows_each_published_show_without_guessing_recurrence(self):
        html='''<div class="modal-root" data-modal-id="show-calendar-day-2026-10-30"><time datetime="2026-10-30"></time>
        <li class="show-calendar-day__dialog-show"><a href="/shows/test?from=calendar">Test</a></li></div>'''
        shows=[event(url='https://creekandcave.com/shows/test'),
               event(name='Second performance',startDate='2026-11-01T22:30:00-06:00',endDate=None,url='https://creekandcave.com/shows/test')]
        with patch.object(c,'get_page',side_effect=[Page(html).root,schema_page(shows)]) as get:
            rows=c.creek(NOW)
        self.assertEqual(len(rows),2)
        self.assertEqual(get.call_args_list[1].args[0],'https://creekandcave.com/shows/test')

    def test_east_austin_uses_the_clubs_own_location(self):
        club={'@type':'ComedyClub','address':{'addressLocality':'Austin','streetAddress':'2505 East 6th St. Suite D'},
              'geo':{'longitude':-97.7142182,'latitude':30.2586241}}
        with patch.object(c,'get_page',return_value=schema_page([club,event()])):
            rows=c.east_austin(NOW)
        self.assertEqual(rows[0]['coordinates'],[-97.7142182,30.2586241])
        self.assertEqual(rows[0]['venue'],'East Austin Comedy Club')


if __name__ == '__main__':
    unittest.main()
