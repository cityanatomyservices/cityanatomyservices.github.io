#!/usr/bin/env python3
"""Generate data/zipcodes/hotspots.json from staging/ZipCode.geojson.

One hotspot per Austin ZIP. Each hotspot stores both a representative
center point (used for popup placement) and the full MultiPolygon
coordinates (used by the engine's point-in-polygon test). Re-runnable;
gids are seeded by zipcode so the output is stable.
"""

from __future__ import annotations

import json
import random
import string
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "staging" / "ZipCode.geojson"
DST = REPO / "data" / "zipcodes" / "hotspots.json"

GID_ALPHABET = string.ascii_lowercase + string.digits


def gid_for(zipcode: str) -> str:
    rng = random.Random(f"zipcode:{zipcode}")
    return "".join(rng.choices(GID_ALPHABET, k=10))


def _point_in_ring(lng: float, lat: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _inside_any(lng: float, lat: float, coords: list) -> bool:
    return any(poly and _point_in_ring(lng, lat, poly[0]) for poly in coords)


def centroid(props: dict, coords: list) -> list[float]:
    # Prefer the source file's lat/lng (often a population-weighted
    # center), but verify it falls inside the polygon — concave shapes
    # can push the official center into a notch. Fall back to a vertex
    # average of the largest ring, then to a bbox grid scan that's
    # guaranteed to find an interior point.
    lng, lat = props.get("longitude"), props.get("latitude")
    try:
        plng, plat = float(lng), float(lat)
        if _inside_any(plng, plat, coords):
            return [plng, plat]
    except (TypeError, ValueError):
        pass
    largest = max(coords, key=lambda p: len(p[0]) if p and p[0] else 0)
    ring = largest[0]
    n = len(ring)
    avg = [sum(v[0] for v in ring) / n, sum(v[1] for v in ring) / n]
    if _inside_any(avg[0], avg[1], coords):
        return avg
    xs = [v[0] for v in ring]
    ys = [v[1] for v in ring]
    min_x, max_x, min_y, max_y = min(xs), max(xs), min(ys), max(ys)
    steps = 20
    for i in range(1, steps):
        for j in range(1, steps):
            cx = min_x + (max_x - min_x) * i / steps
            cy = min_y + (max_y - min_y) * j / steps
            if _inside_any(cx, cy, coords):
                return [cx, cy]
    return list(ring[0])


def main() -> None:
    with SRC.open() as f:
        gj = json.load(f)

    features = sorted(gj["features"], key=lambda f: f["properties"]["zipcode"])
    hotspots = []
    for feat in features:
        props = feat["properties"]
        zipc = props["zipcode"]
        coords = feat["geometry"]["coordinates"]
        hotspots.append({
            "id": f"zip-{zipc}",
            "gid": gid_for(zipc),
            "title": zipc,
            "subtitle": f"Austin · ZIP {zipc}",
            "geofence": {
                "center": centroid(props, coords),
                "polygon": coords,
            },
            "info": {
                "description": f"Austin ZIP code {zipc}.",
            },
        })

    out = {
        "cityId": "atx",
        "title": "Zipcodes · Austin",
        "initialCamera": {"center": [-97.7431, 30.2672], "zoom": 10.5},
        "hotspots": hotspots,
    }

    DST.parent.mkdir(parents=True, exist_ok=True)
    with DST.open("w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {DST} ({len(hotspots)} hotspots)")


if __name__ == "__main__":
    main()
