#!/usr/bin/env python3
"""Step 3: turn an OSM extract into routing tables (edges, nodes, turn restrictions).

    python tools/03-build-network.py <extract.osm.pbf> <output-folder>

Reads the PBF twice (pyosmium streams it, so memory stays small):
  pass 1  count how many drivable ways touch each node, and collect turn-restriction relations
  pass 2  walk every drivable way and SPLIT it where another drivable road shares a node.

Why split only at SHARED NODES and not at every place two lines cross:
  an overpass and the road under it cross on the map but share no node in OSM,
  so they must NOT become a junction. Splitting at shared nodes gets bridges and
  tunnels right for free, which is the point of building the network from the
  raw OSM data instead of from a drawn street layer.

Outputs (CSV, loaded into PostgreSQL by tools/04-load.sh, and a GeoPackage for QGIS):
  edges.csv         one row per road segment between two junctions
  nodes.csv         one row per junction / dead end
  restrictions.csv  turn restrictions, resolved to edge ids where possible
  build.json        counts and the OSM file timestamp, becomes the network version record
  review.gpkg       the same three as layers for QGIS inspection
"""
import csv, json, os, sys, time
from collections import Counter
import osmium
from pyproj import Geod
from shapely.geometry import LineString, Point
from shapely import to_wkt, to_wkb
import pyogrio
from pyogrio.raw import write as write_layer
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))  # so "import rules" works with python -I
import rules

GEOD = Geod(ellps='WGS84')
MPH_TO_MPS = 0.44704


class Pass1(osmium.SimpleHandler):
    """Count node usage across drivable ways; remember restriction relations."""
    def __init__(self):
        super().__init__()
        self.use = Counter()          # node id -> number of drivable ways using it
        self.ends = set()             # first/last node of every drivable way
        self.restrictions = []        # raw restriction relations
        self.way_count = 0
        self.timestamp = None
        self.controls = {}

    def node(self, n):
        tags = dict(n.tags)
        if tags.get('barrier') or tags.get('highway') in ('traffic_signals', 'stop') or not rules.node_passable(tags):
            self.controls[n.id] = {'blocked': not rules.node_passable(tags), 'control': tags.get('highway', '')}

    def way(self, w):
        if w.timestamp and (self.timestamp is None or w.timestamp > self.timestamp):
            self.timestamp = w.timestamp
        if not rules.drivable(dict(w.tags)):
            return
        self.way_count += 1
        refs = [n.ref for n in w.nodes]
        if len(refs) < 2:
            return
        self.use.update(refs)
        self.ends.add(refs[0]); self.ends.add(refs[-1])

    def relation(self, r):
        kind, cond = rules.restriction_kind(dict(r.tags))
        if not kind:
            return
        rec = {'relation_id': r.id, 'kind': kind, 'conditional': cond or '',
               'except': r.tags.get('except', ''), 'from_ways': [], 'to_ways': [], 'via_nodes': [], 'via_ways': []}
        for m in r.members:
            if m.role == 'from' and m.type == 'w': rec['from_ways'].append(m.ref)
            elif m.role == 'to' and m.type == 'w': rec['to_ways'].append(m.ref)
            elif m.role == 'via' and m.type == 'n': rec['via_nodes'].append(m.ref)
            elif m.role == 'via' and m.type == 'w': rec['via_ways'].append(m.ref)
        self.restrictions.append(rec)


class Pass2(osmium.SimpleHandler):
    """Emit one edge per stretch of drivable way between junction nodes."""
    def __init__(self, junctions, edges_csv, interesting_ways):
        super().__init__()
        self.junctions = junctions
        self.w = edges_csv
        self.edge_id = 0
        self.nodes = {}               # junction node id -> (lon, lat)
        self.way_edges = {}           # osm way id -> [(edge_id, first_node, last_node)] for restrictions
        self.interesting = interesting_ways
        self.skipped_missing_location = 0
        self.zero_length = 0

    def way(self, w):
        tags = dict(w.tags)
        hw = rules.drivable(tags)
        if not hw:
            return
        pts = []
        for n in w.nodes:
            if not n.location.valid():
                self.skipped_missing_location += 1
                return                # the extract did not carry this node; drop the whole way
            pts.append((n.ref, n.lon, n.lat))
        if len(pts) < 2:
            return
        one = rules.oneway(tags, hw)
        mph, estimated = rules.speed_mph(tags, hw)
        toll = rules.is_toll(tags)
        kind = rules.access_kind(tags)
        name = tags.get('name', ''); ref = tags.get('ref', ''); service = tags.get('service', '')
        posted = rules.parse_maxspeed(tags.get('maxspeed'))
        start = 0
        for i in range(1, len(pts)):
            if i == len(pts) - 1 or pts[i][0] in self.junctions:
                seg = pts[start:i + 1]
                self._emit(w.id, seg, hw, one, mph, estimated, posted, toll, kind, name, ref, service)
                start = i

    def _emit(self, way_id, seg, hw, one, mph, estimated, posted, toll, kind, name, ref, service):
        lons = [p[1] for p in seg]; lats = [p[2] for p in seg]
        length = GEOD.line_length(lons, lats)
        if length <= 0:
            self.zero_length += 1
            return
        self.edge_id += 1
        seconds = length / (mph * MPH_TO_MPS)
        fwd = round(seconds, 1) if one >= 0 else ''
        bwd = round(seconds, 1) if one <= 0 else ''
        src, dst = seg[0][0], seg[-1][0]
        self.nodes[src] = (seg[0][1], seg[0][2]); self.nodes[dst] = (seg[-1][1], seg[-1][2])
        if way_id in self.interesting:
            self.way_edges.setdefault(way_id, []).append((self.edge_id, src, dst))
        self.w.writerow([self.edge_id, way_id, src, dst, round(length, 1), fwd, bwd, hw, name, ref,
                         '' if posted is None else round(posted), round(mph, 1), 't' if estimated else 'f',
                         one, 't' if toll else 'f', kind, service,
                         to_wkt(LineString(list(zip(lons, lats))), rounding_precision=7)])


def resolve_restrictions(raw, way_edges):
    """Map each restriction's from/to OSM ways onto the split edges that meet at the via node."""
    rows = []
    for r in raw:
        note = ''
        from_edge = to_edge = via = ''
        complex_ = bool(r['via_ways']) or len(r['from_ways']) != 1 or len(r['to_ways']) > 1 or len(r['via_nodes']) != 1
        if r['via_ways']:
            note = 'via is a way; not enforced yet'
        elif len(r['via_nodes']) != 1 or len(r['from_ways']) != 1 or not r['to_ways']:
            note = 'unexpected member set'
        else:
            via = r['via_nodes'][0]
            cand_from = [e for e in way_edges.get(r['from_ways'][0], []) if via in (e[1], e[2])]
            cand_to = [e for e in way_edges.get(r['to_ways'][0], []) if via in (e[1], e[2])]
            if len(cand_from) == 1 and len(cand_to) == 1:
                from_edge, to_edge = cand_from[0][0], cand_to[0][0]
            else:
                note = ('from or to way passes through the via node (ambiguous)' if len(cand_from) > 1 or len(cand_to) > 1 else 'from or to way not found at via node (not drivable, or outside the extract)')
        rows.append([r['relation_id'], r['kind'], r['from_ways'][0] if r['from_ways'] else '', via,
                     r['to_ways'][0] if r['to_ways'] else '', from_edge, to_edge,
                     't' if r['conditional'] else 'f', r['conditional'], r['except'],
                     't' if complex_ else 'f', note])
    return rows


def write_gpkg(out, edges_csv, nodes, restriction_rows):
    """Review layers for QGIS. Geometry comes back from the CSV so it matches the DB exactly."""
    path = os.path.join(out, 'review.gpkg')
    if os.path.exists(path):
        os.remove(path)
    from shapely import from_wkt
    with open(edges_csv, newline='') as f:
        rd = csv.reader(f); header = next(rd)
        cols = {h: [] for h in header[:-1]}; geoms = []
        for row in rd:
            for h, v in zip(header, row[:-1]):
                cols[h].append(v)
            geoms.append(to_wkb(from_wkt(row[-1])))
    import numpy as np
    def col(name, typ):
        vals = cols[name]
        if typ is float:
            return np.array([float(v) if v != '' else np.nan for v in vals], dtype='float64')
        if typ is int:
            return np.array([int(v) if v != '' else -1 for v in vals], dtype='int64')
        return np.array(vals, dtype=object)
    types = {'edge_id': int, 'osm_way_id': int, 'source': int, 'target': int, 'length_m': float, 'seconds_fwd': float,
             'seconds_bwd': float, 'maxspeed_mph': float, 'speed_mph': float, 'oneway': int}
    fields = [h for h in header[:-1]]
    write_layer(path, np.array(geoms, dtype=object), [col(h, types.get(h, str)) for h in fields], fields=fields,
                layer='edges', driver='GPKG', geometry_type='LineString', crs='EPSG:4326')
    nid = list(nodes.keys())
    write_layer(path, np.array([to_wkb(Point(*nodes[n])) for n in nid], dtype=object),
                [np.array(nid, dtype='int64')], fields=['node_id'], layer='nodes', driver='GPKG',
                geometry_type='Point', crs='EPSG:4326', append=True)
    rr = [r for r in restriction_rows if r[3] != '' and r[3] in nodes]
    if rr:
        write_layer(path, np.array([to_wkb(Point(*nodes[r[3]])) for r in rr], dtype=object),
                    [np.array([r[0] for r in rr], dtype='int64'), np.array([r[1] for r in rr], dtype=object),
                     np.array([str(r[5]) for r in rr], dtype=object), np.array([str(r[6]) for r in rr], dtype=object),
                     np.array([r[7] for r in rr], dtype=object), np.array([r[10] for r in rr], dtype=object),
                     np.array([r[11] for r in rr], dtype=object)],
                    fields=['relation_id', 'kind', 'from_edge', 'to_edge', 'conditional', 'complex', 'note'],
                    layer='restrictions', driver='GPKG', geometry_type='Point', crs='EPSG:4326', append=True)
    return path


def main(pbf, out):
    os.makedirs(out, exist_ok=True)
    t0 = time.time()
    p1 = Pass1(); p1.apply_file(pbf)
    junctions = {n for n, c in p1.use.items() if c > 1} | p1.ends
    junctions.update(p1.controls)
    for r in p1.restrictions:
        junctions.update(r['via_nodes'])          # a restriction's via node must be a junction
    interesting = set()
    for r in p1.restrictions:
        interesting.update(r['from_ways']); interesting.update(r['to_ways'])
    print(f'pass 1: {p1.way_count} drivable ways, {len(p1.use)} nodes, {len(junctions)} junctions, '
          f'{len(p1.restrictions)} restriction relations, {time.time()-t0:.0f}s')
    del p1.use

    edges_csv = os.path.join(out, 'edges.csv')
    with open(edges_csv, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['edge_id', 'osm_way_id', 'source', 'target', 'length_m', 'seconds_fwd', 'seconds_bwd', 'highway',
                    'name', 'ref', 'maxspeed_mph', 'speed_mph', 'speed_estimated', 'oneway', 'toll', 'access_kind',
                    'service', 'wkt'])
        p2 = Pass2(junctions, w, interesting)
        p2.apply_file(pbf, locations=True, idx='flex_mem')
    print(f'pass 2: {p2.edge_id} edges, {len(p2.nodes)} nodes, {p2.zero_length} zero-length dropped, '
          f'{p2.skipped_missing_location} ways missing node locations, {time.time()-t0:.0f}s')

    with open(os.path.join(out, 'nodes.csv'), 'w', newline='') as f:
        w = csv.writer(f); w.writerow(['node_id', 'lon', 'lat'])
        for n, (lon, lat) in p2.nodes.items():
            w.writerow([n, round(lon, 7), round(lat, 7)])
    rrows = resolve_restrictions(p1.restrictions, p2.way_edges)
    with open(os.path.join(out, 'restrictions.csv'), 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['relation_id', 'kind', 'from_way', 'via_node', 'to_way', 'from_edge', 'to_edge', 'conditional',
                    'conditional_text', 'except_text', 'complex', 'note'])
        w.writerows(rrows)
    resolved = sum(1 for r in rrows if r[5] != '')
    print(f'restrictions: {len(rrows)} total, {resolved} resolved to edges, {time.time()-t0:.0f}s')

    gp = write_gpkg(out, edges_csv, p2.nodes, rrows)
    info = {'osm_file': os.path.basename(pbf), 'osm_file_bytes': os.path.getsize(pbf),
            'osm_latest_timestamp': p1.timestamp.isoformat() if p1.timestamp else None,
            'edges': p2.edge_id, 'nodes': len(p2.nodes), 'restrictions': len(rrows), 'restrictions_resolved': resolved,
            'built_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'review_gpkg': gp}
    with open(os.path.join(out, 'build.json'), 'w') as f:
        json.dump(info, f, indent=2)
    with open(os.path.join(out, 'controls.json'), 'w') as f:
        json.dump(p1.controls, f)
    with open(os.path.join(out, 'raw_restrictions.json'), 'w') as f:
        json.dump(p1.restrictions, f)
    print(f'wrote {gp}; done in {time.time()-t0:.0f}s')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
