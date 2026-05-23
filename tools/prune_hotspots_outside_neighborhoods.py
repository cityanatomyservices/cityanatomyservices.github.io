#!/usr/bin/env python3
"""Prune hotspots whose center is outside every neighborhood polygon.

Walks data/<slug>/hotspots.json (skipping data/neighborhoods/ itself),
removes any hotspot whose geofence.center isn't contained by at least
one neighborhood MultiPolygon in data/neighborhoods/hotspots.json, and
writes each file back preserving its existing on-disk style (compact
vs. indented).

Run once per neighborhoods refresh. Reports per-file counts and a flat
list of removed (title, app, [lng, lat]) so the change is auditable.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DATA = REPO / "data"
NBHD = DATA / "neighborhoods" / "hotspots.json"


def point_in_ring(lng: float, lat: float, ring: list) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def point_in_multipolygon(lng: float, lat: float, coords: list) -> bool:
    for polygon in coords:
        if not polygon or not point_in_ring(lng, lat, polygon[0]):
            continue
        # Holes
        in_hole = False
        for k in range(1, len(polygon)):
            if point_in_ring(lng, lat, polygon[k]):
                in_hole = True
                break
        if not in_hole:
            return True
    return False


def main() -> int:
    nbhd = json.loads(NBHD.read_text())
    nbhd_polys = [n["geofence"]["polygon"] for n in nbhd["hotspots"]]

    def covered(center: list) -> bool:
        lng, lat = center
        return any(point_in_multipolygon(lng, lat, p) for p in nbhd_polys)

    total_kept = 0
    total_removed = 0
    removed_log: list[tuple[str, str, list[float]]] = []

    for hsfile in sorted(DATA.glob("*/hotspots.json")):
        app = hsfile.parent.name
        if app == "neighborhoods":
            continue
        raw_text = hsfile.read_text()
        data = json.loads(raw_text)
        before = data.get("hotspots") or []
        kept = []
        for h in before:
            c = (h.get("geofence") or {}).get("center")
            if c and len(c) == 2 and covered(c):
                kept.append(h)
            else:
                removed_log.append((h.get("title") or h.get("id") or "?", app, c or [None, None]))
        removed = len(before) - len(kept)
        total_kept += len(kept)
        total_removed += removed
        if removed == 0:
            print(f"  {app:18s} kept {len(kept):4d}, removed 0")
            continue
        data["hotspots"] = kept
        # Preserve compact vs. indented style by sniffing the original.
        compact = "\n" not in raw_text.strip() or raw_text.count("\n") < 3
        if compact:
            hsfile.write_text(json.dumps(data, separators=(",", ":")))
        else:
            hsfile.write_text(json.dumps(data, indent=2) + "\n")
        print(f"  {app:18s} kept {len(kept):4d}, removed {removed:3d}")

    print(f"\ntotals: kept {total_kept}, removed {total_removed}\n")
    if removed_log:
        print("Removed hotspots:")
        for title, app, c in removed_log:
            lng, lat = c
            lng_s = f"{lng:.4f}" if isinstance(lng, (int, float)) else "?"
            lat_s = f"{lat:.4f}" if isinstance(lat, (int, float)) else "?"
            print(f"  [{app:14s}] {title}  [{lng_s}, {lat_s}]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
