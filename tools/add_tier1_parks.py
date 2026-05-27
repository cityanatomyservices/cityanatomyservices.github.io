#!/usr/bin/env python3
"""Add Tier-1 missing parks from the canonical City of Austin
boundary file into data/parks/hotspots.json as new polygon hotspots.

Tier-1 inclusion rule (matches what we discussed):
  - missing from current hotspots.json
  - park_type is Metropolitan, District, or Nature Preserve (any size),
    OR shape_area ≥ 10 acres
  - EXCLUDE park_type == "Golf Course" (covered by the golf category)

Each new entry gets:
  - id: "park-<kebab-case-title>"
  - gid: stable 10-char a-z0-9 hash of the canonical record id
  - title: the canonical `location_name`
  - subtitle: "<address> · <park_type> · <acres> acres"
  - schedule: 5am-10pm every day (matches existing parks)
  - geofence.polygon: MultiPolygon coords from the canonical geometry
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HOTSPOTS = REPO / "data" / "parks" / "hotspots.json"
CANONICAL = REPO / "staging" / "BOUNDARIES_city_of_austin_parks_20260525.geojson"

TIER1_TYPES = {"Metropolitan", "District", "Nature Preserve"}
EXCLUDE_TYPES = {"Golf Course"}
MIN_ACRES = 10.0

SCHEDULE = {
    "timezone": "America/Chicago",
    "windows": [{
        "days": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        "from": "05:00",
        "to": "22:00",
    }],
}

ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"


def slugify(s: str) -> str:
    s = (s or "").lower()
    s = s.replace("&", "and").replace("'", "")
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"\s+", "-", s.strip())
    s = re.sub(r"-+", "-", s).strip("-")
    return s


def make_gid(seed: str) -> str:
    """10-char a-z0-9 id seeded by the canonical record id — stable
    across re-runs, no random state."""
    h = hashlib.sha256(seed.encode("utf-8")).digest()
    out = []
    for i in range(10):
        out.append(ALPHABET[h[i] % len(ALPHABET)])
    return "".join(out)


def feature_acres(props: dict) -> float:
    a = props.get("acres")
    if a is not None:
        try:
            return float(a)
        except (TypeError, ValueError):
            pass
    # shape_area is in square feet (Texas State Plane); 43560 sq ft / acre
    sa = props.get("shape_area")
    if sa:
        try:
            return float(sa) / 43560.0
        except (TypeError, ValueError):
            pass
    return 0.0


def polygon_from_geometry(geom: dict) -> list | None:
    if not geom:
        return None
    t = geom.get("type")
    coords = geom.get("coordinates")
    if t == "Polygon":
        return [coords]
    if t == "MultiPolygon":
        return coords
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    hotspots_doc = json.loads(HOTSPOTS.read_text())
    canonical = json.loads(CANONICAL.read_text())

    existing_titles = {h.get("title") for h in hotspots_doc["hotspots"]}
    existing_ids = {h.get("id") for h in hotspots_doc["hotspots"]}

    candidates = []  # (title, type, acres, props, geometry)
    for f in canonical.get("features", []):
        props = f.get("properties") or {}
        name = props.get("location_name")
        if not name or name in existing_titles:
            continue
        ptype = (props.get("park_type") or "").strip()
        if ptype in EXCLUDE_TYPES:
            continue
        acres = feature_acres(props)
        if ptype in TIER1_TYPES or acres >= MIN_ACRES:
            candidates.append((name, ptype, acres, props, f.get("geometry")))

    # Sort biggest-first so the report is easy to skim.
    candidates.sort(key=lambda x: -x[2])

    print(f"Existing parks: {len(existing_titles)}")
    print(f"Tier-1 candidates to add (Metro/District/Nature Preserve or ≥{MIN_ACRES} ac, "
          f"no Golf Courses): {len(candidates)}")
    print()
    print(f"{'Acres':>8}  {'Type':<18}  Title")
    print(f"{'-'*8}  {'-'*18}  {'-'*40}")

    new_entries = []
    for name, ptype, acres, props, geom in candidates:
        poly = polygon_from_geometry(geom)
        if not poly:
            print(f"  SKIP (no polygon): {name}")
            continue

        # Build subtitle in the same style as existing parks.
        addr = props.get("address") or ""
        acres_int = int(round(acres)) if acres else 0
        bits = []
        if addr:
            bits.append(addr)
        if ptype:
            bits.append(ptype)
        if acres_int:
            bits.append(f"{acres_int} acres")
        subtitle = " · ".join(bits)

        base_id = "park-" + slugify(name)
        # Disambiguate the rare case where two parks slugify to the same id.
        hid = base_id
        n = 2
        while hid in existing_ids:
            hid = f"{base_id}-{n}"; n += 1
        existing_ids.add(hid)

        seed = props.get(":id") or props.get("globalid") or props.get("objectid") or name
        gid = make_gid(str(seed))

        entry = {
            "id": hid,
            "gid": gid,
            "title": name,
            "subtitle": subtitle,
            "schedule": SCHEDULE,
            "geofence": {"polygon": poly},
        }
        new_entries.append(entry)
        print(f"  {acres:7.1f}  {ptype:<18}  {name}")

    print()
    print(f"Total entries that would be added: {len(new_entries)}")

    if args.dry_run:
        print("\nDRY RUN — no files changed.")
        return 0

    hotspots_doc["hotspots"].extend(new_entries)
    HOTSPOTS.write_text(json.dumps(hotspots_doc, indent=2, ensure_ascii=False))
    print(f"\nWrote {HOTSPOTS.relative_to(REPO)} (total now: {len(hotspots_doc['hotspots'])})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
