"""Prepare a conservative car-planning graph from build_network.py's output.

Keeps intermediate-way restrictions, blocks unresolved restricted approaches,
applies conditional prohibitions at all times, and records these limitations.
Output is portable JSONL, used by the local and Supabase loaders.
"""
import argparse
from collections import defaultdict, Counter
import csv
import json
import re
from pathlib import Path


class Components:
    def __init__(self):
        self.parents = {}

    def root(self, node):
        p = self.parents.setdefault(node, node)
        if p != node:
            self.parents[node] = self.root(p)
        return self.parents[node]

    def join(self, a, b):
        a, b = self.root(a), self.root(b)
        if a != b:
            self.parents[max(a, b)] = min(a, b)


def directed(edge):
    if edge['fwd'] >= 0:
        yield (edge['id'], edge['source'], edge['target'])
    if edge['rev'] >= 0:
        yield (edge['id'], edge['target'], edge['source'])


def largest_strong_component(roads):
    """Snapping must allow both arrival and departure, not just an undirected path."""
    graph, reverse = defaultdict(list), defaultdict(list)
    for road in roads.values():
        if road['blocked']:
            continue
        for _, source, target in directed(road):
            graph[source].append(target)
            reverse[target].append(source)
    seen, order = set(), []
    vertices = set(graph) | set(reverse)
    for start in vertices:
        if start in seen:
            continue
        seen.add(start)
        stack = [(start, iter(graph[start]))]
        while stack:
            node, children = stack[-1]
            child = next(children, None)
            if child is None:
                order.append(node)
                stack.pop()
            elif child not in seen:
                seen.add(child)
                stack.append((child, iter(graph[child])))
    seen, largest = set(), set()
    for start in reversed(order):
        if start in seen:
            continue
        component, stack = set(), [start]
        seen.add(start)
        while stack:
            node = stack.pop()
            component.add(node)
            for child in reverse[node]:
                if child not in seen:
                    seen.add(child)
                    stack.append(child)
        if len(component) > len(largest):
            largest = component
    return largest


def restriction_paths(restriction, roads, by_way, exits):
    """All directed approaches matching the actual relation members."""
    starts = [d for way in restriction['from_ways'] for eid in by_way.get(way, []) for d in directed(roads[eid])]
    targets = set(restriction['to_ways'])
    paths = []
    if restriction['via_nodes'] and not restriction['via_ways']:
        if len(restriction['via_nodes']) != 1:
            return []
        via = restriction['via_nodes'][0]
        for start in starts:
            if start[2] != via:
                continue
            for end in exits[via]:
                if roads[end[0]]['way'] not in targets:
                    continue
                if restriction['kind'] == 'no_u_turn' and restriction['from_ways'] == restriction['to_ways'] and start[0] != end[0]:
                    continue
                paths.append([start, end])
        return paths
    via = restriction['via_ways']
    if not via:
        return []
    # A bound prevents malformed/cyclic relations from exhausting a build.
    calls = 0

    def walk(node, index, used, path, entered):
        nonlocal calls
        calls += 1
        if calls > 20000 or len(path) > 128:
            return
        if entered:
            if index == len(via) - 1:
                for end in exits[node]:
                    if roads[end[0]]['way'] in targets and end[0] not in used:
                        paths.append(path + [end])
            else:
                walk(node, index + 1, used, path, False)
        for edge in exits[node]:
            if roads[edge[0]]['way'] == via[index] and edge[0] not in used:
                walk(edge[2], index, used | {edge[0]}, path + [edge], True)

    for start in starts:
        if any(roads[e[0]]['way'] == via[0] for e in exits[start[2]]):
            walk(start[2], 0, {start[0]}, [start], False)
    return [] if calls > 20000 else paths


def prepare(build, output):
    from shapely import from_wkt
    output.mkdir(parents=True, exist_ok=True)
    controls = {int(k): v for k, v in json.loads((build / 'controls.json').read_text()).items()}
    roads, by_way, neighbors, exits = {}, defaultdict(list), defaultdict(set), defaultdict(list)
    for row in csv.DictReader((build / 'edges.csv').open()):
        eid, source, target = int(row['edge_id']), int(row['source']), int(row['target'])
        road = {
            'id': eid, 'way': int(row['osm_way_id']), 'source': source, 'target': target,
            'length': float(row['length_m']), 'fwd': float(row['seconds_fwd']) if row['seconds_fwd'] else -1,
            'rev': float(row['seconds_bwd']) if row['seconds_bwd'] else -1,
            'highway': row['highway'], 'toll': row['toll'] == 't', 'access': row['access_kind'],
            'estimated': row['speed_estimated'] == 't', 'name': row['name'],
            'geom': from_wkt(row['wkt']).wkb_hex,
            'blocked': any(controls.get(n, {}).get('blocked', False) for n in (source, target)),
        }
        roads[eid] = road
        by_way[road['way']].append(eid)
        if not road['blocked']:
            neighbors[source].add(target)
            neighbors[target].add(source)
            for direction in directed(road):
                exits[direction[1]].append(direction)

    restrictions = json.loads((build / 'raw_restrictions.json').read_text())
    forbidden = set()
    counts = Counter()
    for restriction in restrictions:
        paths = restriction_paths(restriction, roads, by_way, exits)
        conditional_kinds = set(re.findall(r'(?:^|;)\s*((?:no_|only_)[a-z_]+)\s*@', restriction['conditional']))
        if conditional_kinds - {restriction['kind']}:
            paths = []                  # conflicting conditional forms: block the approach
        if not paths:
            # An omitted restriction must not silently become permission to turn.
            for way in restriction['from_ways']:
                for eid in by_way.get(way, []):
                    roads[eid]['blocked'] = True
            counts['unresolved_restrictions'] += 1
            continue
        counts['resolved_restrictions'] += 1
        if restriction['via_ways']:
            counts['resolved_via_way'] += 1
        if restriction['conditional']:
            counts['conditional_applied_conservatively'] += 1
        if restriction['kind'].startswith('only_'):
            allowed = defaultdict(set)
            ends = {}
            for path in paths:
                for size in range(1, len(path)):
                    prefix = tuple(d[0] for d in path[:size])
                    allowed[prefix].add(path[size][0])
                    ends[prefix] = path[size - 1][2]
            for prefix, next_edges in allowed.items():
                for candidate in exits[ends[prefix]]:
                    if candidate[0] not in next_edges:
                        forbidden.add(prefix + (candidate[0],))
        elif restriction['kind'].startswith('no_'):
            forbidden.update(tuple(d[0] for d in path) for path in paths)

    connected, destinations = Components(), Components()
    for road in roads.values():
        if road['blocked']:
            continue
        connected.join(road['source'], road['target'])
        if road['access'] == 'destination':
            destinations.join(road['source'], road['target'])
    main = largest_strong_component(roads)
    zone_ids = {}
    for road in roads.values():
        road['main'] = not road['blocked'] and road['source'] in main and road['target'] in main
        road['zone'] = 0
        if road['access'] == 'destination':
            root = destinations.root(road['source'])
            road['zone'] = zone_ids.setdefault(root, len(zone_ids) + 1)
        # Average free-flow planning speeds, not traffic observations. No charge
        # for a mere OSM way boundary. Signals/stops and real junctions add delay.
        factor = 0.90 if road['highway'] in ('motorway', 'trunk') else 0.85

        def delay(node):
            control = controls.get(node, {}).get('control')
            if control == 'traffic_signals':
                return 12
            if control == 'stop':
                return 6
            return 3 if len(neighbors[node]) >= 3 and road['highway'] not in ('motorway', 'motorway_link', 'trunk') else 0

        road['fwd'] = round(road['fwd'] / factor + delay(road['target']), 2) if road['fwd'] >= 0 else -1
        road['rev'] = round(road['rev'] / factor + delay(road['source']), 2) if road['rev'] >= 0 else -1
        counts['blocked_edges'] += road['blocked']
        counts['main_edges'] += road['main']

    with (output / 'roads.jsonl').open('w') as f:
        for road in roads.values():
            f.write(json.dumps(road, separators=(',', ':')) + '\n')
    with (output / 'turns.jsonl').open('w') as f:
        for path in sorted(forbidden):
            f.write(json.dumps({'path': path}) + '\n')
    info = json.loads((build / 'build.json').read_text()) | dict(counts)
    info.update({'profile': 'car-planning-v1', 'turn_paths': len(forbidden), 'live_traffic': False,
                 'restriction_policy': 'conditional prohibitions always applied; unresolved approaches blocked'})
    (output / 'network.json').write_text(json.dumps(info, indent=2) + '\n')
    print(json.dumps(info, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('build', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    prepare(args.build, args.output)
