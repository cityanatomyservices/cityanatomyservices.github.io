#!/usr/bin/env python3
"""
place.py - works out WHERE each 3D model sits on the map and writes
models/data/placements.json. Run it from anywhere:

    python3 tools/models/place.py            (uses the cached OSM answer)
    python3 tools/models/place.py --refresh  (asks OpenStreetMap again)

WHY THIS SCRIPT EXISTS
The five models in C:\\Dev\\Austin_Models_Transfer_Batch were built in Blender
in local metres around a pivot. Only the drainage model carries real survey
coordinates; the other four were traced from plan drawings and come with a
geocoded search point at best. Nobody wants to drag models around by hand, so
this script derives every anchor, heading and height offset from things that
can be looked up: OpenStreetMap street and building geometry, the packages'
own notes, and the public elevation tiles. Every number it writes is
accompanied by a plain-language `derivation` so the next person can see
where it came from and redo it.

WHAT A PLACEMENT MEANS (read by models/js/model-layer.js)
  anchor          [lon, lat] where the model's local (0, 0) goes
  heading_deg     how far the model's +Y axis ("model north") is turned
                  clockwise from true north
  ground_offset_m metres added to the model's z so that its ground meets the
                  flat map plane (the map has no terrain: z = 0 is the ground
                  everywhere, so a model whose zero is "lake level" or
                  "NAVD88 100 m" needs lifting or sinking by one number)
  bounds          the model's footprint as a lon/lat box, for fitBounds

Needs: python3 with `requests`; GDAL's gdallocationinfo from OSGeo4W for the
elevation tiles (C:\\OSGeo4W, read from WSL at /mnt/c/OSGeo4W). No pyproj: the
one projection fact needed (state-plane grid convergence) is a short formula.
"""
import json
import math
import os
import subprocess
import sys
from datetime import date

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
BATCH = '/mnt/c/Dev/Austin_Models_Transfer_Batch/unpacked'
CACHE = os.path.join(HERE, 'osm-cache', 'overpass.json')
OUT = os.path.join(REPO, 'models', 'data', 'placements.json')

OVERPASS = 'https://overpass-api.de/api/interpreter'
# Terrarium elevation tiles (the same ones the report pages use for hillshade).
DEM_TILE = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
GDALLOCATIONINFO = '/mnt/c/OSGeo4W/bin/gdallocationinfo.exe'

# ---------------------------------------------------------------------------
# 1. The OpenStreetMap features we lean on. One query, cached to disk, so a
#    re-run does not depend on the Overpass server being up.
# ---------------------------------------------------------------------------
QUERY = """[out:json][timeout:60];
(
  way(187392350);                                                       // Austin Convention Center building
  way["name"="Trinity Street"]["highway"](30.255,-97.750,30.272,-97.735);
  way["name"~"Cesar Chavez"]["highway"](30.258,-97.750,30.268,-97.730);
  way["highway"="motorway"](30.293,-97.724,30.302,-97.712);             // I-35 mainlanes at 41st
  way["name"~"41st"]["highway"](30.293,-97.724,30.302,-97.712);
  way(183977275);                                                       // Barbara Jordan Terminal, AUS
);
out body; >; out skel qt;
"""


def fetch_osm(refresh):
    if os.path.exists(CACHE) and not refresh:
        with open(CACHE) as f:
            return json.load(f)
    r = requests.post(OVERPASS, data={'data': QUERY}, timeout=120,
                      headers={'User-Agent': 'austin.chat models page placement script'})
    r.raise_for_status()
    data = r.json()
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    with open(CACHE, 'w') as f:
        json.dump(data, f)
    return data


class OSM:
    """The Overpass answer as node and way lookups, with ways as lon/lat lists."""

    def __init__(self, data):
        self.nodes = {e['id']: (e['lon'], e['lat']) for e in data['elements'] if e['type'] == 'node'}
        self.ways = {e['id']: e for e in data['elements'] if e['type'] == 'way'}

    def coords(self, way_id):
        return [self.nodes[n] for n in self.ways[way_id]['nodes']]

    def find(self, **tags):
        """Ways whose tags contain every given key=value (value may be a substring)."""
        out = []
        for w in self.ways.values():
            t = w.get('tags', {})
            if all(k in t and v in t[k] for k, v in tags.items()):
                out.append(w['id'])
        return out


# ---------------------------------------------------------------------------
# 2. Small flat-earth geometry. Everything here is within a few hundred metres
#    of its anchor, so metres east/north around a reference point are exact
#    enough (centimetres), and far easier to read than spherical formulas.
# ---------------------------------------------------------------------------
M_PER_DEG_LAT = 111320.0


def to_xy(lonlat, ref):
    m_per_deg_lon = M_PER_DEG_LAT * math.cos(math.radians(ref[1]))
    return ((lonlat[0] - ref[0]) * m_per_deg_lon, (lonlat[1] - ref[1]) * M_PER_DEG_LAT)


def to_lonlat(xy, ref):
    m_per_deg_lon = M_PER_DEG_LAT * math.cos(math.radians(ref[1]))
    return (ref[0] + xy[0] / m_per_deg_lon, ref[1] + xy[1] / M_PER_DEG_LAT)


def bearing(a, b):
    """Compass bearing from a to b (both metres east/north), clockwise from north."""
    return math.degrees(math.atan2(b[0] - a[0], b[1] - a[1])) % 360


def northish(deg):
    """Fold a bearing into (-90, 90]: a street's direction regardless of which way it is drawn."""
    deg = deg % 180
    return deg - 180 if deg > 90 else deg


def centroid(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def seg_intersection(p1, p2, p3, p4):
    """Where the infinite line p1-p2 crosses the SEGMENT p3-p4, or None."""
    d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0])
    if abs(d) < 1e-9:
        return None
    u = ((p1[0] - p3[0]) * (p1[1] - p2[1]) - (p1[1] - p3[1]) * (p1[0] - p2[0])) / d
    if u < 0 or u > 1:
        return None
    return (p3[0] + u * (p4[0] - p3[0]), p3[1] + u * (p4[1] - p3[1]))


def line_crossings(line, polyline):
    """Every point where the infinite `line` (two points) crosses `polyline`, with the local bearing."""
    hits = []
    for a, b in zip(polyline, polyline[1:]):
        p = seg_intersection(line[0], line[1], a, b)
        if p:
            hits.append((p, bearing(a, b)))
    return hits


def mean_bearing(degs):
    """Average of bearings that all point roughly the same way (within 90°)."""
    x = sum(math.sin(math.radians(d)) for d in degs)
    y = sum(math.cos(math.radians(d)) for d in degs)
    return math.degrees(math.atan2(x, y)) % 360


def principal_axis(pts):
    """Bearing of the long axis of a cloud of points (2D PCA), folded north-ish."""
    c = centroid(pts)
    sxx = sum((p[0] - c[0]) ** 2 for p in pts)
    syy = sum((p[1] - c[1]) ** 2 for p in pts)
    sxy = sum((p[0] - c[0]) * (p[1] - c[1]) for p in pts)
    theta = 0.5 * math.atan2(2 * sxy, sxx - syy)   # angle of the long axis from +x (east)
    return (90 - math.degrees(theta)) % 360        # as a compass bearing


# ---------------------------------------------------------------------------
# 3. Ground height from the elevation tiles, through GDAL (no Python imaging
#    library needed). Terrarium encodes metres as (R*256 + G + B/256) - 32768.
# ---------------------------------------------------------------------------
def ground_m(lon, lat, z=14):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    url = DEM_TILE.format(z=z, x=int(x), y=int(y))
    px, py = int((x - int(x)) * 256), int((y - int(y)) * 256)
    out = subprocess.run([GDALLOCATIONINFO, '-valonly', '/vsicurl/' + url, str(px), str(py)],
                         capture_output=True, text=True, timeout=120)
    r, g, b = [float(v) for v in out.stdout.split()[:3]]
    return round(r * 256 + g + b / 256 - 32768, 1)


# ---------------------------------------------------------------------------
# 4. State-plane grid convergence for the drainage model. Texas Central is a
#    Lambert conformal conic with standard parallels 30°07' and 31°53' and
#    central meridian 100°20' W. Grid north and true north agree only on the
#    central meridian; east of it grid north leans clockwise by
#    gamma = n * (lon - lon0), where n is the cone constant. ~1.3° in Austin,
#    which over the model's 10 km reach would otherwise be a 230 m error.
# ---------------------------------------------------------------------------
def texas_central_convergence_deg(lon):
    phi1, phi2, lon0 = math.radians(30 + 7 / 60), math.radians(31 + 53 / 60), -(100 + 20 / 60)
    n = (math.log(math.cos(phi1) / math.cos(phi2)) /
         math.log(math.tan(math.pi / 4 + phi2 / 2) / math.tan(math.pi / 4 + phi1 / 2)))
    return n * (lon - lon0)


# ---------------------------------------------------------------------------
# 5. Reading the packages.
# ---------------------------------------------------------------------------
def load_json(*parts):
    with open(os.path.join(BATCH, *parts)) as f:
        return json.load(f)


def bounds_to_lonlat_box(bounds_m, anchor, heading_deg):
    """The model's local bounding box, turned by the heading and put on the map, as [w, s, e, n]."""
    (x0, x1), (y0, y1) = bounds_m[0], bounds_m[1]
    h = math.radians(heading_deg)
    corners = []
    for x, y in [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]:
        # turning model axes clockwise by the heading: +Y goes to (sin h, cos h)
        e = x * math.cos(h) + y * math.sin(h)
        nn = -x * math.sin(h) + y * math.cos(h)
        corners.append(to_lonlat((e, nn), anchor))
    lons = [c[0] for c in corners]
    lats = [c[1] for c in corners]
    return [round(min(lons), 6), round(min(lats), 6), round(max(lons), 6), round(max(lats), 6)]


def main():
    refresh = '--refresh' in sys.argv
    osm = OSM(fetch_osm(refresh))
    placements = {}

    # ---- Drainage: the one model with real coordinates --------------------
    geo = load_json('Austin_Drainage', 'Austin_Drainage', 'finished', 'georeference.json')
    val = load_json('Austin_Drainage', 'Austin_Drainage', 'finished', 'validation_report.json')
    anchor = (geo['origin_longitude'], geo['origin_latitude'])
    heading = texas_central_convergence_deg(anchor[0])
    ground = ground_m(*anchor)
    placements['drainage'] = {
        'anchor': [round(anchor[0], 8), round(anchor[1], 8)],
        'heading_deg': round(heading, 3),
        'ground_offset_m': round(geo['origin_navd88_m'] - ground, 1),
        'bounds': bounds_to_lonlat_box(val['source_bounds_m'], anchor, heading),
        'derivation': {
            'anchor': 'origin_longitude/latitude from the package georeference.json: the state-plane '
                      'origin E 3,117,000 / N 10,069,000 ft (EPSG:6578), converted by the package author.',
            'heading': 'Model +Y is state-plane grid north. Grid north leans clockwise from true north by the '
                       'Texas Central grid convergence at this longitude, computed here as %.3f degrees.' % heading,
            'ground_offset': 'Model z = 0 is NAVD88 100 m. The elevation tiles give %.1f m at the origin, so the '
                             'model is sunk by the difference and the tunnels sit at true depth below the map '
                             'plane. Ground rises to the north-east along the route, so the depth reads shallow there.' % ground,
            'scale': 'Model metres are surface (ground) metres already; no scale change.'
        },
        'accuracy': 'Route and shaft positions from 2024 TxDOT contract drawings; the package calls the '
                    'station-anchored route "survey check required". Metres, not tens of metres.'
    }

    # ---- Convention Center: the block it replaces -------------------------
    cc = osm.coords(187392350)
    ref = centroid(cc)
    cc_xy = [to_xy(p, ref) for p in cc]
    anchor = to_lonlat(centroid(cc_xy), ref)
    # Trinity Street between Cesar Chavez and 4th gives the downtown grid's "north"
    trinity = [osm.coords(w) for w in osm.find(name='Trinity Street')]
    grid = [bearing(to_xy(a, ref), to_xy(b, ref))
            for way in trinity for a, b in zip(way, way[1:])
            if 30.2620 < a[1] < 30.2665 and 30.2620 < b[1] < 30.2665]
    heading = mean_bearing([g % 180 for g in grid])
    ccv = load_json('Austin_Convention_Center', 'Austin_Convention_Center', 'export_validation.json')
    placements['convention-center'] = {
        'anchor': [round(anchor[0], 8), round(anchor[1], 8)],
        'heading_deg': round(heading, 2),
        'ground_offset_m': 0,
        'bounds': bounds_to_lonlat_box(ccv['variants']['cesium']['bounds_blender_m'], anchor, heading),
        'derivation': {
            'anchor': 'Centroid of the existing Austin Convention Center building in OpenStreetMap (way 187392350). '
                      'The model pivot is its "approximate site center" and the proposal fills the same block.',
            'heading': 'Model +Y is downtown-grid north. Measured as the bearing of Trinity Street between '
                       'Cesar Chavez and 4th in OpenStreetMap: %.2f degrees (the package estimated 17).' % heading,
            'ground_offset': 'Model z = 0 is ground at the site.'
        },
        'accuracy': 'Package: "approximate visual registration only". Expect the footprint to be off by '
                    'up to a few tens of metres against the real block.'
    }

    # ---- I-35 stitches: the mainlane centreline at 41st Street ------------
    motorways = [osm.coords(w) for w in osm.find(highway='motorway')]
    e41 = [osm.coords(w) for w in osm.find(name='41st')]
    ref = (-97.7182, 30.2977)
    # The 41st Street axis: the street stops on each side of the highway, so take
    # its nodes nearest the corridor on the west and on the east and run a line through them.
    pts = [to_xy(p, ref) for way in e41 for p in way]
    west = max((p for p in pts if p[0] < 0), key=lambda p: p[0])
    east = min((p for p in pts if p[0] > 0), key=lambda p: p[0])
    hits = []
    for way in motorways:
        hits += line_crossings((west, east), [to_xy(p, ref) for p in way])
    centre = centroid([h[0] for h in hits])
    heading = northish(mean_bearing([h[1] % 180 for h in hits]))
    anchor = to_lonlat(centre, ref)
    i35v = load_json('I35_Northern_Stitches', 'I35_Northern_Stitches', 'export_validation.json')
    placements['i35-stitches'] = {
        'anchor': [round(anchor[0], 8), round(anchor[1], 8)],
        'heading_deg': round(heading, 2),
        'ground_offset_m': 0,
        'bounds': bounds_to_lonlat_box(i35v['variants']['both_stitches']['source_bounds_m'], anchor, heading),
        'derivation': {
            'anchor': 'Midpoint of where the line of East 41st Street (joined across the highway) crosses the '
                      'I-35 mainlane carriageways in OpenStreetMap (%d crossings averaged). The package pivot is '
                      '"the approximate future 41st Street crossing center".' % len(hits),
            'heading': 'Model +Y runs along the corridor. Mean bearing of the mainlanes at the crossing: %.2f degrees.' % heading,
            'ground_offset': 'Model z = 0 is the deck top, at street grade; the depressed highway sits at -10 m in the model.'
        },
        'accuracy': 'Deck extents were traced from a presentation raster at 0.46 m per pixel; the package has '
                    'no survey control. Tens of metres.'
    }

    # ---- Lady Bird Lake rail: Trinity meets Cesar Chavez ------------------
    trinity_ids = osm.find(name='Trinity Street')
    chavez_ids = osm.find(name='Cesar Chavez')
    trinity_nodes = {n for w in trinity_ids for n in osm.ways[w]['nodes']}
    chavez_nodes = {n for w in chavez_ids for n in osm.ways[w]['nodes']}
    shared = [osm.nodes[n] for n in trinity_nodes & chavez_nodes]
    anchor = centroid(shared)      # Trinity is one-way pairs; several shared nodes may exist
    ref = anchor
    # Trinity north of the anchor towards 3rd Street: the model's +Y
    grid = [bearing(to_xy(a, ref), to_xy(b, ref))
            for w in trinity_ids for a, b in zip(osm.coords(w), osm.coords(w)[1:])
            if anchor[1] <= a[1] < anchor[1] + 0.0025 and anchor[1] <= b[1] < anchor[1] + 0.0025]
    heading = mean_bearing([g % 180 for g in grid])
    street = ground_m(*anchor)
    lake = 428 * 0.3048
    lbv = load_json('Lady_Bird_Lake_Light_Rail', 'Lady_Bird_Lake_Light_Rail', 'export_validation.json')
    placements['lady-bird-rail'] = {
        'anchor': [round(anchor[0], 8), round(anchor[1], 8)],
        'heading_deg': round(heading, 2),
        'ground_offset_m': round(lake - street, 1),
        'bounds': bounds_to_lonlat_box(lbv['variants']['all_infrastructure']['source_bounds_m'], anchor, heading),
        'derivation': {
            'anchor': 'The OpenStreetMap node(s) shared by Trinity Street and East Cesar Chavez Street (%d found, '
                      'averaged). This settles the package\'s two geocode candidates 56 m apart.' % len(shared),
            'heading': 'Model +Y follows Trinity towards 3rd Street. Bearing of Trinity north of the anchor in '
                       'OpenStreetMap: %.2f degrees (the package estimated 18.01).' % heading,
            'ground_offset': 'Model z = 0 is the lake at 428 ft (%.1f m). Street grade at the anchor from the '
                             'elevation tiles is %.1f m, so the model is sunk by the difference: streets on the '
                             'map plane, the lake surface below it, the rail deck above.' % (lake, street)
        },
        'accuracy': 'Alignment traced from the FEIS conceptual plan sheets at 0.23 m per pixel. Tens of metres.'
    }

    # ---- AUS Concourse B: south of the terminal, parallel to it -----------
    term = osm.coords(183977275)
    ref = centroid(term)
    term_xy = [to_xy(p, ref) for p in term]
    tc = centroid(term_xy)
    axis = principal_axis(term_xy)
    # The model's own stand-in for the terminal sits at local y 277..339, so the
    # concourse centre is 308 m from the terminal centre along the model's +Y,
    # and +Y points AT the terminal. The airfield is the south side of the terminal.
    away_candidates = [(axis + 90) % 360, (axis - 90) % 360]
    south = min(away_candidates, key=lambda b: abs(((b - 180) + 180) % 360 - 180))
    d = 308.0
    centre = (tc[0] + d * math.sin(math.radians(south)), tc[1] + d * math.cos(math.radians(south)))
    heading = (south + 180) % 360            # +Y back towards the terminal
    anchor = to_lonlat(centre, ref)
    ausv = load_json('AUS_Concourse_B', 'AUS_Concourse_B', 'export_validation.json')
    placements['aus-concourse-b'] = {
        'anchor': [round(anchor[0], 8), round(anchor[1], 8)],
        'heading_deg': round(heading, 2),
        'ground_offset_m': 0,
        'bounds': bounds_to_lonlat_box(ausv['variants']['concourse_and_bridges']['source_bounds_m'], anchor, heading),
        'derivation': {
            'anchor': 'The package has no coordinates at all. Taken as the centroid of the Barbara Jordan Terminal '
                      'footprint in OpenStreetMap (way 183977275) moved 308 m towards the airfield, perpendicular to '
                      'the terminal\'s long axis: 308 m is the distance between the concourse and the terminal '
                      'stand-in inside the model itself.',
            'heading': 'Terminal long axis from OpenStreetMap: %.2f degrees. Model +Y points at the terminal, so '
                       'the heading is %.2f.' % (axis, heading),
            'ground_offset': 'Model z = 0 is apron level.'
        },
        'accuracy': 'Conceptual: "no surveyed pivot or reliable georeferencing recovered". The position is a '
                    'documented guess from the terminal footprint, not a site plan. Expect 50 m or more.'
    }

    out = {
        'generated': str(date.today()),
        'generated_by': 'tools/models/place.py',
        'heading_convention': 'degrees clockwise from true north that the model +Y axis is turned',
        'projects': placements
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(out, f, indent=2)
    print('wrote', os.path.relpath(OUT, REPO))
    for k, p in placements.items():
        print('%-18s anchor %s  heading %7.2f  ground_offset %6.1f' % (k, p['anchor'], p['heading_deg'], p['ground_offset_m']))


if __name__ == '__main__':
    main()
