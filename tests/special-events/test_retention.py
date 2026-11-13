import importlib.util
from datetime import datetime, timezone
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]

def module(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'tools/special-events'/f'{name}.py')
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result
retention=module('retention');register=module('register')

class RetentionTests(unittest.TestCase):
    def test_last_participant_closing_and_48_hour_boundary(self):
        event=json.loads((ROOT/'special-events/data/austin-studio-tour-2026.geojson').read_text())
        self.assertEqual(register.closing(event).isoformat(),'2026-11-22T22:00:00-06:00')
        self.assertEqual(retention.expired_events(ROOT,datetime(2026,11,25,3,59,59,tzinfo=timezone.utc)),[])
        self.assertEqual(len(retention.expired_events(ROOT,datetime(2026,11,25,4,tzinfo=timezone.utc))),1)

    def test_overnight_closing_counts_next_date(self):
        event={'dates':['2026-11-22'],'utcOffset':'-06:00','hours':{'open':'11:00','close':'17:00'},'features':[{'properties':{'profiles':[{'availability':{'days':{'2026-11-22':[{'open':'18:00','close':'01:00','nextDay':True}]}}}]}}]}
        self.assertEqual(register.closing(event).isoformat(),'2026-11-23T01:00:00-06:00')

    def test_public_build_removes_only_expired_event_assets_and_links(self):
        events=retention.expired_events(ROOT,datetime(2026,11,25,4,tzinfo=timezone.utc));paths=retention.exclusions(events)
        self.assertTrue(retention.excluded('special-events/data/austin-studio-tour-2026.geojson',paths))
        self.assertTrue(retention.excluded('maps/austin-studio-tour/index.html',paths))
        for name in ['maps/austin-studio-tour/stops/index.html', 'maps/austin-studio-tour/stops/47/index.html', 'maps/austin-studio-tour/stops/47/qr.png', 'maps/austin-studio-tour/stops/links.csv']:
            self.assertTrue(retention.excluded(name,paths))
        self.assertFalse(retention.excluded('404.html',paths))
        for name in ['chat/index.html','special-events/map.html','special-events/data/next-event.geojson','special-events/tiles/stamen-watercolor-austin/0/0/0.jpg']:
            self.assertFalse(retention.excluded(name,paths))
        raw=(ROOT/'home.json').read_bytes();home=json.loads(retention.filtered('home.json',raw,events))
        cards=[c for chip in home['chips'] for c in chip.get('cards',[])]
        self.assertFalse(any(c.get('eventId')=='austin-studio-tour-2026' for c in cards))
        self.assertIn('/maps/austin-studio-tour/',home['retiredSpecialEvents'])
        self.assertEqual(json.loads(retention.filtered('special-events/registry.json',(ROOT/'special-events/registry.json').read_bytes(),events)),[])
        original=json.loads(raw);self.assertEqual(sum(len(c.get('cards',[])) for c in original['chips'])-1,len(cards))

    def test_shared_or_traversal_assets_cannot_be_assigned_for_removal(self):
        event=json.loads((ROOT/'special-events/registry.json').read_text())[0]
        for asset in ['/chat/index.html','/special-events/assets/'+event['id']+'/../../shared.js']:
            with self.assertRaises(ValueError):retention.exclusions([{**event,'assets':[asset]}])

if __name__=='__main__':unittest.main()
