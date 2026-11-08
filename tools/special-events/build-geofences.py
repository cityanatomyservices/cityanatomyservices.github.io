#!/usr/bin/env python3
"""Build disjoint studio chat zones from the City's 2023 building footprints.

Usage: python build-geofences.py <building-cache-directory> [--fetch]
Requires shapely>=2.1 and pyproj. Raw source responses stay outside the repo.
"""
import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

from pyproj import Transformer
from shapely import voronoi_polygons, make_valid
from shapely.geometry import Polygon, MultiPoint, LineString, shape, mapping
from shapely.ops import transform, unary_union, nearest_points

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'special-events/data/austin-studio-tour-2026.geojson'
SOURCE = 'https://maps.austintexas.gov/arcgis/rest/services/Shared/PlanimetricsSurvey_1/MapServer/0'
PROJECT = Transformer.from_crs(4326, 32614, always_xy=True).transform
UNPROJECT = Transformer.from_crs(32614, 4326, always_xy=True).transform


def fetch(cache, features):
    cache.mkdir(parents=True, exist_ok=True)
    def one(pair):
        i, f = pair
        file = cache / f'{i}.json'
        if file.exists():
            return
        params = dict(f='geojson', geometry=','.join(map(str, f['geometry']['coordinates'])),
                      geometryType='esriGeometryPoint', inSR=4326, spatialRel='esriSpatialRelIntersects',
                      distance=60, units='esriSRUnit_Meter', outSR=4326, outFields='OBJECTID', returnGeometry='true')
        with urlopen(SOURCE + '/query?' + urlencode(params), timeout=60) as response:
            data = json.load(response)
        if 'features' not in data or data.get('exceededTransferLimit'):
            raise ValueError(f'Incomplete building response for stop {i+1}')
        file.write_text(json.dumps(data), encoding='utf8')
    with ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(one, enumerate(features)))


def solid(g):
    """Courtyards are part of the venue's chat zone too."""
    if g.geom_type == 'Polygon':
        return Polygon(g.exterior)
    return unary_union([Polygon(p.exterior) for p in g.geoms])


def halfplane(a, b):
    """Half-plane nearer a; generous extent for this city-sized dataset."""
    dx, dy = b.x-a.x, b.y-a.y
    length = (dx*dx+dy*dy)**.5
    if length < .01:
        raise ValueError('Coincident stops need reviewed, distinct entrance coordinates.')
    nx, ny = dx/length, dy/length
    tx, ty = -ny, nx
    mx, my = (a.x+b.x)/2, (a.y+b.y)/2
    size = 100000
    return Polygon([(mx+tx*size, my+ty*size), (mx-tx*size, my-ty*size),
                    (mx-tx*size-nx*size, my-ty*size-ny*size), (mx+tx*size-nx*size, my+ty*size-ny*size)])


def build(event, cache):
    features = event['features']
    pins = [transform(PROJECT, shape(f['geometry'])) for f in features]
    buildings, cores, meta = [], [], []
    for i, (f, pin) in enumerate(zip(features, pins)):
        raw = json.loads((cache / f'{i}.json').read_text(encoding='utf8'))
        choices = [(transform(PROJECT, shape(b['geometry'])), b['properties']['OBJECTID']) for b in raw['features']]
        choices.sort(key=lambda b: (pin.distance(b[0]), b[0].area, b[1]))
        match = choices[0] if choices and pin.distance(choices[0][0]) <= 40 else None
        building = solid(match[0]) if match else pin.buffer(5)
        buildings.append(building)
        # Include the organizer's pin and the path to the matched footprint.
        connector = LineString([pin, nearest_points(pin, building)[1]]).buffer(.5)
        cores.append(unary_union([building, connector, pin.buffer(.5)]))
        meta.append(dict(method='building' if match else 'pin-approximation', buildingId=match[1] if match else None,
                         pinToBuildingMetres=round(pin.distance(building), 1) if match else None))

    # Separate shared buildings first. Full overlapping footprints cannot each
    # be exclusive, so the organizer's stop pins divide the shared interior.
    original = cores[:]
    shared = []
    for i, core in enumerate(original):
        competitors = [j for j, other in enumerate(original) if i != j and core.intersection(other).area > .01]
        if competitors:
            shared.append(features[i]['properties']['number'])
            meta[i]['sharedBuilding'] = True
            for j in competitors:
                core = core.intersection(halfplane(pins[i], pins[j]))
        cores[i] = core.buffer(-.05)
        if not cores[i].covers(pins[i]):
            raise ValueError(f'Stop {features[i]["properties"]["number"]}: pin excluded from building division')

    # Voronoi seeds along building edges allocate outdoor space by proximity
    # to the building, rather than shrinking an entire large venue to a circle.
    seeds, owners, seen = [], [], set()
    for i, core in enumerate(cores):
        polygons = [core] if core.geom_type == 'Polygon' else list(core.geoms)
        for polygon in polygons:
            ring = polygon.exterior
            count = max(4, int(ring.length/4)+1)
            for k in range(count):
                pt = ring.interpolate(k/count, normalized=True)
                key = (round(pt.x, 5), round(pt.y, 5))
                if key not in seen:
                    seen.add(key); seeds.append(pt); owners.append(i)
    cells = voronoi_polygons(MultiPoint(seeds), ordered=True)
    grouped = defaultdict(list)
    for owner, cell in zip(owners, cells.geoms):
        grouped[owner].append(cell)
    all_cores = unary_union(cores)
    zones = []
    for i, core in enumerate(cores):
        desired = core.buffer(20) if meta[i]['method'] == 'building' else pins[i].buffer(40)
        outdoor = unary_union(grouped[i]).intersection(desired).difference(all_cores)
        zone = unary_union([outdoor, core])
        # Simplification may never expand a zone into its neighbor. A small
        # neutral seam also prevents ambiguity after GeoJSON rounding.
        zone = zone.simplify(.15, preserve_topology=True).intersection(zone).buffer(-.05)
        if zone.is_empty or not zone.is_valid or not zone.contains(pins[i]):
            raise ValueError(f'Invalid chat zone for stop {features[i]["properties"]["number"]}')
        if not meta[i].get('sharedBuilding') and buildings[i].difference(zone.buffer(.2)).area > .1:
            raise ValueError(f'Building coverage lost at stop {features[i]["properties"]["number"]}')
        zones.append(zone)

    for i, zone in enumerate(zones):
        for j in range(i):
            if zone.intersects(zones[j]):
                raise ValueError(f'Overlapping zones: {features[i]["properties"]["number"]}, {features[j]["properties"]["number"]}')
    for f, zone, detail in zip(features, zones, meta):
        # Eight decimals retain the neutral seam; validate the serialized data.
        geometry = json.loads(json.dumps(mapping(transform(UNPROJECT, zone)), default=float))
        def rounded(value):
            return [rounded(v) for v in value] if isinstance(value, (tuple, list)) else round(value, 8)
        geometry['coordinates'] = rounded(geometry['coordinates'])
        cleaned = make_valid(shape(geometry))
        if cleaned.geom_type == 'GeometryCollection':
            cleaned = unary_union([g for g in cleaned.geoms if g.geom_type in ('Polygon', 'MultiPolygon')])
        geometry = mapping(cleaned)
        f['properties']['chatBoundary'] = geometry
        f['properties']['chatBoundaryDetails'] = detail
    published = [shape(f['properties']['chatBoundary']) for f in features]
    for i, zone in enumerate(published):
        assert zone.is_valid and zone.contains(shape(features[i]['geometry'])), f'Invalid serialized zone {features[i]["properties"]["number"]}'
        assert all(not zone.intersects(other) for other in published[:i]), 'Serialized zones overlap'
    event['chat'] = dict(buildingSource=SOURCE, buildingSourceTitle='City of Austin · Building Footprints 2023',
                         generated=datetime.now(timezone.utc).isoformat(), buildingBufferMetres=20, fallbackRadiusMetres=40,
                         method='Building footprints and surrounding space, divided into non-overlapping zones. Shared buildings are divided between stop pins; unmatched pins use approximate zones.',
                         buildingMatched=sum(m['method']=='building' for m in meta), sharedBuildingStops=shared)
    print(json.dumps(dict(stops=len(zones), buildingMatched=event['chat']['buildingMatched'], sharedBuildingStops=shared,
                          approximations=[f['properties']['number'] for f,m in zip(features,meta) if m['method']!='building'],
                          minimumAreaMetres=round(min(z.area for z in zones),1)), indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('cache', type=Path)
    parser.add_argument('--fetch', action='store_true')
    args = parser.parse_args()
    event = json.loads(DATA.read_text(encoding='utf8'))
    if args.fetch:
        fetch(args.cache, event['features'])
    build(event, args.cache)
    # Compact each derived geometry; keep the artist/address source readable.
    geometries = {}
    for f in event['features']:
        key = '__chat_boundary_' + f['properties']['id'] + '__'
        geometries[key] = f['properties']['chatBoundary']
        f['properties']['chatBoundary'] = key
    serialized = json.dumps(event, ensure_ascii=False, indent=2)
    for key, geometry in geometries.items():
        serialized = serialized.replace(json.dumps(key), json.dumps(geometry, separators=(',', ':')))
    DATA.write_text(serialized+'\n', encoding='utf8')
