import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from build import DATA, prior_places, save_json, validate
from model import Neighborhoods, PlaceIndex, address_key, match_score, merge, safe_website
from sources import city_places, osm_places, overture_places


def place(name='Example Shop', address='100 Main Street', lng=-97.74, lat=30.27, **kwargs):
    return dict(id='n1', name=name, address=address, lng=lng, lat=lat, **kwargs)


class GeometryTests(unittest.TestCase):
    def test_holes_and_multipolygons(self):
        outer = [[0,0],[10,0],[10,10],[0,10],[0,0]]
        hole = [[2,2],[4,2],[4,4],[2,4],[2,2]]
        second = [[20,20],[30,20],[30,30],[20,30],[20,20]]
        n = Neighborhoods([{'properties': {'id':'area'}, 'geometry': {'type':'MultiPolygon', 'coordinates':[[outer,hole],[second]]}}])
        self.assertEqual(n.find(1, 1), 'area')
        self.assertIsNone(n.find(3, 3))
        self.assertEqual(n.find(25, 25), 'area')
        self.assertIsNone(n.find(15, 15))


class MatchingTests(unittest.TestCase):
    def test_punctuation_and_street_abbreviations(self):
        self.assertGreater(match_score(place("Papa John's", '100 Main St'), place('Papa Johns', '100 Main Street')), 0)

    def test_nearby_chain_branches_not_merged(self):
        self.assertEqual(match_score(place('Starbucks', '100 Main St'), place('Starbucks', '102 Main St')), 0)

    def test_distinct_suites_not_merged(self):
        self.assertEqual(match_score(place(address='100 Main St #100'), place(address='100 Main St Ste 200')), 0)

    def test_distinct_tenants_not_merged(self):
        self.assertEqual(match_score(place('Alpha Cafe'), place('Beta Cafe')), 0)

    def test_same_website_not_enough(self):
        self.assertEqual(match_score(place('Alpha Clinic', website='https://hospital.org', category='Clinics'), place('Beta Clinic', website='https://hospital.org', category='Clinics')), 0)

    def test_branch_suffix_matches(self):
        self.assertGreater(match_score(place('Toy Joy'), place('Toy Joy - Downtown')), 0)

    def test_distant_same_business_not_merged(self):
        self.assertEqual(match_score(place(), place(lat=30.28)), 0)

    def test_ambiguous_match_not_chosen(self):
        self.assertIsNone(PlaceIndex([place(), place()]).match(place()))

    def test_preserves_id_and_source_evidence(self):
        p = place(sources={'osm':['node/1']})
        other = place(sources={'overture':['abc']}, website='https://example.com')
        other['id'] = 'ov-abc'
        merge(p, other)
        self.assertEqual(p['id'], 'n1')
        self.assertEqual(p['aliases'], ['ov-abc'])
        self.assertEqual(p['sources']['overture'], ['abc'])
        self.assertEqual(p['website'], 'https://example.com')


class SourceTests(unittest.TestCase):
    def test_latest_inspection_per_facility(self):
        rows = [dict(facility_id='1', restaurant_name='Example', inspection_date=d, lat='30', lng='-97') for d in ['2026-01-02', '2026-02-01', '2026-01-15']]
        result = list(city_places(rows))
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['sources']['city'][0]['inspected'], '2026-02-01')

    def test_no_guessed_city_coordinates(self):
        self.assertEqual(list(city_places([{'facility_id':'1','restaurant_name':'Example','inspection_date':'2026-02-01'}])), [])

    def test_partial_overpass_refused(self):
        with self.assertRaises(ValueError):
            list(osm_places({'remark':'timeout','elements':[{}] * 2000}, {}))

    def test_closed_and_private_osm_filtered(self):
        elements = [{'type':'node','id':i,'lon':-97.7,'lat':30.2,'tags':dict(name='Shop',shop='books',**extra)} for i,extra in enumerate([{}, {'disused':'yes'}, {'access':'private'}, {'opening_hours':'closed'}])]
        result = list(osm_places({'elements':elements + [{}] * 2000}, {'shop':{'books':'Bookstores'}}))
        self.assertEqual([p['id'] for p in result], ['n0'])

    def test_overture_uses_current_taxonomy_and_requires_evidence(self):
        base = {'id':'abc','geometry':{'type':'Point','coordinates':[-97.7,30.2]}, 'properties':{'operating_status':'open','confidence':.99,'taxonomy':{'primary':'bookstore','hierarchy':['shopping','bookstore']},'names':{'primary':'Shop'},'addresses':[{'freeform':'100 Main St'}],'websites':['https://example.com']}}
        def parse(overrides):
            f = dict(base, properties=dict(base['properties'], **overrides))
            return list(overture_places({'features':[f]*2000}, {'bookstore':'Bookstores'}))
        self.assertEqual(parse({})[0]['category'], 'Bookstores')
        for overrides in [{'operating_status':'permanently_closed'}, {'confidence':.5}, {'addresses':[]}, {'websites':[]}, {'taxonomy':{'primary':'residence'}}]:
            self.assertEqual(parse(overrides), [])

    def test_unsafe_urls(self):
        for url in ['javascript:alert(1)', 'https://example.com/" onclick="bad', 'https://user:pass@example.com', 'data:text/html,bad']:
            self.assertIsNone(safe_website(url))
        self.assertEqual(safe_website('example.com'), 'https://example.com')

    def test_all_category_labels_have_a_group(self):
        categories = json.loads((DATA / 'categories.json').read_text())
        labels = {label for items in categories['groups'].values() for label in items}
        for key, mapping in categories.items():
            if key not in ('groups', '_comment'):
                self.assertLessEqual(set(mapping.values()), labels)
        self.assertLessEqual(set(json.loads((DATA / 'overture-categories.json').read_text()).values()), labels)

    def test_manual_exclusions_have_evidence(self):
        for item in json.loads((DATA / 'place-overrides.json').read_text())['exclude']:
            self.assertTrue(item['reason'] and item['reviewed'] and safe_website(item['source']))


class PublicationTests(unittest.TestCase):
    def test_large_loss_refused(self):
        with self.assertRaises(ValueError):
            validate({'area': {'id':'area','count':0,'groups':[]}}, [])

    def test_atomic_write_leaves_valid_json(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'test.json'
            path.write_text('{"old":true}')
            save_json(path, {'count':3})
            self.assertEqual(json.loads(path.read_text()), {'count':3})
            self.assertEqual(len(list(Path(folder).iterdir())), 1)


if __name__ == '__main__':
    unittest.main()
