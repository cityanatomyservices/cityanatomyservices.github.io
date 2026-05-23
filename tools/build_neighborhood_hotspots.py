#!/usr/bin/env python3
"""Generate data/neighborhoods/hotspots.json from staging/Neighborhoods_*.geojson.

One hotspot per Austin neighborhood. Each hotspot stores a representative
center point (used for popup placement) and the full MultiPolygon
coordinates (used by the engine's point-in-polygon test). Re-runnable;
gids are seeded by neighborhood name so the output is stable.

Mirrors tools/build_zipcode_hotspots.py — pull both into a shared
helper if a third polygon-app shows up.
"""

from __future__ import annotations

import json
import random
import re
import string
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SRC_GLOB = "Neighborhoods_*.geojson"
DST = REPO / "data" / "neighborhoods" / "hotspots.json"

GID_ALPHABET = string.ascii_lowercase + string.digits


def find_source() -> Path:
    matches = sorted((REPO / "staging").glob(SRC_GLOB))
    if not matches:
        raise SystemExit(f"no source matching staging/{SRC_GLOB}")
    return matches[-1]


def gid_for(name: str) -> str:
    rng = random.Random(f"neighborhood:{name}")
    return "".join(rng.choices(GID_ALPHABET, k=10))


def slug_for(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "neighborhood"


def title_case(name: str) -> str:
    # "EAST CESAR CHAVEZ" -> "East Cesar Chavez", but keep short
    # acronyms like "MLK" all-caps and "Mc"-style names sensible.
    parts = []
    for word in name.split():
        if len(word) <= 3 and word.isalpha():
            parts.append(word)  # MLK, UT, NW, etc.
        else:
            parts.append(word.capitalize())
    return " ".join(parts)


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


def centroid(coords: list) -> list[float]:
    # Vertex average of the largest outer ring; if that lands outside
    # a concave polygon, grid-scan the bbox for an interior point.
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
    src = find_source()
    with src.open() as f:
        gj = json.load(f)

    seen_ids = set()
    hotspots = []
    for feat in gj["features"]:
        raw_name = (feat["properties"].get("neighname") or "").strip()
        if not raw_name:
            continue
        title = title_case(raw_name)
        base_slug = slug_for(raw_name)
        slug = base_slug
        n = 2
        while slug in seen_ids:
            slug = f"{base_slug}-{n}"
            n += 1
        seen_ids.add(slug)
        coords = feat["geometry"]["coordinates"]
        if feat["geometry"]["type"] == "Polygon":
            coords = [coords]
        hotspots.append({
            "id": f"nbhd-{slug}",
            "gid": gid_for(raw_name),
            "title": title,
            "subtitle": "Austin neighborhood",
            "geofence": {
                "center": centroid(coords),
                "polygon": coords,
            },
            "info": {"description": f"{title} neighborhood, Austin TX."},
        })

    hotspots.sort(key=lambda h: h["title"])

    out = {
        "cityId": "atx",
        "title": "Neighborhoods · Austin",
        "initialCamera": {"center": [-97.7431, 30.2672], "zoom": 11.5},
        "hotspots": hotspots,
    }

    DST.parent.mkdir(parents=True, exist_ok=True)
    with DST.open("w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {DST} ({len(hotspots)} hotspots) from {src.name}")


if __name__ == "__main__":
    main()
