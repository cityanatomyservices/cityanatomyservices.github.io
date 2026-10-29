import sys
import unittest
from collections import defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import rules
from prepare import directed, largest_strong_component, restriction_paths


def roads_fixture():
    rows=[(1,10,1,2),(2,20,2,3),(3,20,3,4),(4,30,4,5),(5,40,2,6),(6,40,6,4)]
    roads={i:{'id':i,'way':way,'source':a,'target':b,'fwd':10,'rev':-1,'blocked':False} for i,way,a,b in rows}
    by_way,exits=defaultdict(list),defaultdict(list)
    for r in roads.values():
        by_way[r['way']].append(r['id'])
        for d in directed(r):exits[d[1]].append(d)
    return roads,by_way,exits


class RulesTests(unittest.TestCase):
    def test_specific_access_and_destination(self):
        self.assertEqual(rules.drivable({'highway':'service','access':'private','motorcar':'yes'}),'service')
        self.assertIsNone(rules.drivable({'highway':'service','access':'yes','motorcar':'no'}))
        self.assertEqual(rules.access_kind({'access':'customers'}),'destination')

    def test_uncertain_direction_and_access_are_not_invented(self):
        self.assertIsNone(rules.drivable({'highway':'motorway_link'}))
        self.assertEqual(rules.oneway({'oneway':'-1'},'primary'),-1)
        self.assertIsNone(rules.drivable({'highway':'primary','oneway':'reversible'}))
        self.assertIsNone(rules.drivable({'highway':'service','access:conditional':'customers@(Mo-Fr)'}))

    def test_barriers_and_car_exemptions(self):
        self.assertFalse(rules.node_passable({'barrier':'bollard'}))
        self.assertFalse(rules.node_passable({'barrier':'gate','access':'private'}))
        self.assertTrue(rules.node_passable({'barrier':'gate','motorcar':'yes'}))
        self.assertEqual(rules.restriction_kind({'type':'restriction','restriction':'no_left_turn','except':'motorcar;bus'}),(None,None))

    def test_speed_units_and_toll_variants(self):
        self.assertEqual(rules.parse_maxspeed('45 mph'),45)
        self.assertAlmostEqual(rules.parse_maxspeed('70'),43.49597,places=4)
        self.assertIsNone(rules.parse_maxspeed('signals'))
        self.assertTrue(rules.is_toll({'toll:motorcar':'yes'}))
        self.assertTrue(rules.is_toll({'toll:conditional':'yes @ (Mo-Fr 07:00-09:00)'}))

    def test_intermediate_way_expands_all_split_segments(self):
        roads,by_way,exits=roads_fixture()
        relation={'from_ways':[10],'to_ways':[30],'via_nodes':[],'via_ways':[20],'kind':'no_left_turn'}
        paths=restriction_paths(relation,roads,by_way,exits)
        self.assertEqual([[d[0] for d in path] for path in paths],[[1,2,3,4]])

    def test_node_restrictions_use_legal_directions(self):
        roads,by_way,exits=roads_fixture()
        relation={'from_ways':[10],'to_ways':[20],'via_nodes':[2],'via_ways':[],'kind':'no_left_turn'}
        self.assertEqual([[d[0] for d in p] for p in restriction_paths(relation,roads,by_way,exits)],[[1,2]])

    def test_strong_connectivity_excludes_one_way_traps(self):
        roads={1:{'id':1,'source':1,'target':2,'fwd':10,'rev':10,'blocked':False},
               2:{'id':2,'source':2,'target':3,'fwd':10,'rev':-1,'blocked':False}}
        self.assertEqual(largest_strong_component(roads),{1,2})


if __name__=='__main__':unittest.main()
