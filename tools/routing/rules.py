"""Driving rules for turning OpenStreetMap tags into a car network.

This file is deliberately the ONLY place that decides:
  * which roads a normal car may use,
  * which direction(s) it may travel,
  * how fast we assume it goes when no speed limit is tagged.
Everything in here is a small pure function on a tag dictionary so it can be
read, argued with and changed without touching the importer.

Speeds are in mph because that is what Austin signs say and what the owner will
check against. OSM stores maxspeed as "45 mph" (or a bare number meaning km/h).
"""

# highway=<value> a car may drive, and the speed (mph) we ASSUME when the way has
# no usable maxspeed tag. These are estimates, flagged speed_estimated=true in the
# output so they can be calibrated later against real drive times.
DRIVABLE_DEFAULT_MPH = {
    'motorway': 65,        # I-35, MoPac, 183 main lanes, SH 130 (posted 70-85; maxspeed usually tagged)
    'motorway_link': 40,   # ramps
    'trunk': 55,           # US 290, US 183 outside the freeway parts, SH 71
    'trunk_link': 35,
    'primary': 40,         # Lamar, Burnet Rd, Ben White frontage etc. (OSM class, not speed)
    'primary_link': 30,
    'secondary': 35,
    'secondary_link': 25,
    'tertiary': 30,
    'tertiary_link': 25,
    'unclassified': 25,
    'residential': 25,     # planning fallback; not a claim about the posted limit
    'living_street': 10,
    'service': 15,         # parking aisles, driveways, alleys: needed to reach venues
    'road': 20,            # unknown class
}

# access=<value> meanings. Anything not listed is treated as allowed.
ACCESS_FORBIDDEN = {'no', 'private', 'agricultural', 'forestry', 'delivery', 'military', 'emergency'}
ACCESS_DESTINATION = {'destination', 'customers'}

# Relation tags that are turn restrictions for a car. restriction:hgv etc. are ignored.
RESTRICTION_KEYS = ('restriction:motorcar', 'restriction:motor_vehicle', 'restriction:vehicle', 'restriction')
RESTRICTION_KINDS = {'no_left_turn', 'no_right_turn', 'no_straight_on', 'no_u_turn',
                     'no_entry', 'no_exit', 'only_left_turn', 'only_right_turn', 'only_straight_on'}


def drivable(tags):
    """Return the highway class if a normal car may use this way, else None."""
    hw = tags.get('highway')
    if hw not in DRIVABLE_DEFAULT_MPH:
        return None                      # footways, cycleways, tracks, construction, proposed, bus guideways...
    if tags.get('area') == 'yes':
        return None                      # a plaza drawn as a closed way is not a road
    # A static planning profile must not invent a direction/access window.
    if tags.get('oneway') in ('reversible', 'alternating') or tags.get('oneway:conditional'):
        return None
    if hw == 'motorway_link' and tags.get('junction') != 'roundabout' and not any(tags.get(k) for k in ('oneway', 'oneway:motorcar', 'oneway:motor_vehicle')):
        return None                      # an ambiguous ramp direction is not inferred
    for key in ('motorcar:conditional', 'motor_vehicle:conditional', 'vehicle:conditional', 'access:conditional'):
        if tags.get(key):
            return None
    # Vehicle-specific tags win over the general access tag (OSM access hierarchy).
    for key in ('motorcar', 'motor_vehicle', 'vehicle', 'access'):
        if key in tags:
            if tags[key] in ACCESS_FORBIDDEN:
                return None
            break                        # the most specific tag present decides; stop looking
    if tags.get('service') in ('emergency_access',):
        return None
    return hw


def access_kind(tags):
    """'destination' when the road is for local access only, else 'public'."""
    for key in ('motorcar', 'motor_vehicle', 'vehicle', 'access'):
        if key in tags:
            return 'destination' if tags[key] in ACCESS_DESTINATION else 'public'
    return 'public'


def oneway(tags, hw):
    """1 = travel only in the way's drawn direction, -1 = only against it, 0 = both ways."""
    v = tags.get('oneway:motorcar', tags.get('oneway:motor_vehicle', tags.get('oneway')))
    if v in ('yes', 'true', '1'):
        return 1
    if v in ('-1', 'reverse'):
        return -1
    if v in ('no', 'false', '0'):
        return 0
    if tags.get('junction') == 'roundabout':
        return 1                         # roundabouts are one-way by definition
    if hw == 'motorway':
        return 1                         # OSM convention: motorways imply oneway=yes
    return 0


def parse_maxspeed(value):
    """'45 mph' -> 45.0, '70' -> 43.5 (km/h to mph), anything else -> None."""
    if not value:
        return None
    v = value.strip().lower()
    if v.endswith('mph'):
        v = v[:-3].strip()
        unit = 1.0
    elif v.endswith('km/h') or v.endswith('kmh'):
        v = v.rstrip('h/').rstrip('km').strip()
        unit = 0.621371
    else:
        unit = 0.621371                  # OSM default unit is km/h
    try:
        mph = float(v) * unit
    except ValueError:
        return None                      # 'signals', 'none', 'variable', 'TX:urban' ...
    return mph if 3 <= mph <= 90 else None


def speed_mph(tags, hw):
    """(speed in mph, True if it is an estimate rather than a tagged limit).

    A posted limit is not an average speed, so this is the OPTIMISTIC free-flow
    number. Junction delay and traffic are added separately in SQL where they can
    be tuned without rebuilding the network."""
    posted = parse_maxspeed(tags.get('maxspeed'))
    if posted is not None:
        return posted, False
    return float(DRIVABLE_DEFAULT_MPH[hw]), True


def is_toll(tags):
    return any(tags.get(key) == 'yes' for key in ('toll', 'toll:motorcar', 'toll:motor_vehicle')) or 'yes' in tags.get('toll:conditional', '')


def node_passable(tags):
    for key in ('motorcar', 'motor_vehicle', 'vehicle', 'access'):
        if key in tags:
            if tags[key] in ACCESS_FORBIDDEN:
                return False
            if tags[key] in ('yes', 'permissive', 'designated'):
                return True
            break
    return tags.get('barrier') not in {'bollard', 'block', 'cycle_barrier', 'bus_trap',
                                     'stile', 'fence', 'gate', 'lift_gate', 'chain'}


def restriction_kind(tags):
    """Return (kind, conditional_text) for a car turn restriction relation, else (None, None)."""
    if tags.get('type') != 'restriction':
        return None, None
    if {'motorcar', 'motor_vehicle', 'vehicle'}.intersection(tags.get('except', '').replace(' ', '').split(';')):
        return None, None
    for key in RESTRICTION_KEYS:
        kind = tags.get(key)
        if kind in RESTRICTION_KINDS:
            return kind, tags.get(key + ':conditional')
    for key in RESTRICTION_KEYS:
        cond = tags.get(key + ':conditional')
        if cond:                         # e.g. "no_left_turn @ (Mo-Fr 07:00-09:00)"
            return cond.split('@')[0].strip(), cond
    return None, None
