#!/usr/bin/env python3
"""Match current parks/hotspots.json entries against canonical Austin
parks GeoJSON and replace each matched circle with its real polygon.

Usage:
    python3 tools/replace_parks_with_polygons.py --dry-run     # report only
    python3 tools/replace_parks_with_polygons.py               # writes data/parks/hotspots.json in place

Strategy:
- Normalize names on both sides (lower, strip punctuation, drop common
  suffixes like "Park", "Metro Park", "Greenbelt", "Trail").
- Try exact normalized match first.
- Fall back to difflib fuzzy match with a 0.86 cutoff.
- Anything still unmatched stays as a circle — the user said don't lose
  parks that aren't on the canonical list.

Replacement leaves every other field on the hotspot intact (id, gid,
title, subtitle, schedule, info). Only `geofence` is rewritten — from
`{center, radiusMeters}` to `{polygon: <MultiPolygon coords>}`.
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HOTSPOTS = REPO / "data" / "parks" / "hotspots.json"
CANONICAL = REPO / "staging" / "BOUNDARIES_city_of_austin_parks_20260525.geojson"

# Tokens we strip when normalizing so "Zilker Park" matches "Zilker".
SUFFIX_TOKENS = {
    "park", "parks", "metro", "metropolitan", "district", "neighborhood",
    "pocket", "greenbelt", "preserve", "wilderness", "nature", "trail",
    "trails", "playground", "plaza", "square", "garden", "gardens",
    "center", "centre", "field", "fields", "complex", "the", "of", "at",
    "and",
}

_punct = re.compile(r"[^\w\s]+")
_ws = re.compile(r"\s+")


def normalize(name: str) -> str:
    s = (name or "").lower()
    s = s.replace("&", " and ")
    s = _punct.sub(" ", s)
    s = _ws.sub(" ", s).strip()
    return s


def stem(name: str) -> str:
    """Aggressive stem: drop common park suffix tokens."""
    s = normalize(name)
    parts = [t for t in s.split() if t not in SUFFIX_TOKENS]
    return " ".join(parts).strip() or s  # fall back to plain normalized form


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="don't write the file; just report what would happen")
    ap.add_argument("--cutoff", type=float, default=0.86,
                    help="fuzzy-match threshold (0..1, higher = stricter)")
    args = ap.parse_args()

    hotspots_doc = json.loads(HOTSPOTS.read_text())
    canonical = json.loads(CANONICAL.read_text())

    # Build canonical index: list of (name, stem, normalized, multipolygon_coords)
    canon = []
    for f in canonical.get("features", []):
        props = f.get("properties") or {}
        name = props.get("location_name") or ""
        if not name:
            continue
        geom = f.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates")
        if gtype == "Polygon":
            multi = [coords]
        elif gtype == "MultiPolygon":
            multi = coords
        else:
            continue
        canon.append({
            "name": name,
            "norm": normalize(name),
            "stem": stem(name),
            "polygon": multi,
            "park_type": props.get("park_type"),
        })

    # Index by normalized and stemmed name. Some stems collide (e.g. two
    # "Pease" parks); we keep a list per key.
    by_norm: dict[str, list[dict]] = {}
    by_stem: dict[str, list[dict]] = {}
    for c in canon:
        by_norm.setdefault(c["norm"], []).append(c)
        by_stem.setdefault(c["stem"], []).append(c)

    norm_keys = list(by_norm.keys())
    stem_keys = list(by_stem.keys())

    hotspots = hotspots_doc.get("hotspots", [])
    replaced = []  # (hotspot title, canonical name, match strategy)
    kept_as_circle = []  # current parks with no canonical match
    canonical_unused = set(c["name"] for c in canon)

    for h in hotspots:
        title = h.get("title") or ""
        norm = normalize(title)
        stm = stem(title)
        match = None
        how = None

        # 1) exact normalized
        if norm in by_norm and len(by_norm[norm]) == 1:
            match = by_norm[norm][0]; how = "exact-norm"
        # 2) exact stem (drop "Park", "Metro Park", etc.)
        elif stm in by_stem and len(by_stem[stm]) == 1:
            match = by_stem[stm][0]; how = "exact-stem"
        else:
            # 3) fuzzy on full normalized name
            best = difflib.get_close_matches(norm, norm_keys, n=1, cutoff=args.cutoff)
            if best:
                cs = by_norm[best[0]]
                if len(cs) == 1:
                    match = cs[0]; how = f"fuzzy-norm({difflib.SequenceMatcher(None, norm, best[0]).ratio():.2f})"
            if not match:
                # 4) fuzzy on stemmed name (lower cutoff because stem is shorter)
                best = difflib.get_close_matches(stm, stem_keys, n=1, cutoff=max(0.80, args.cutoff - 0.04))
                if best:
                    cs = by_stem[best[0]]
                    if len(cs) == 1:
                        match = cs[0]; how = f"fuzzy-stem({difflib.SequenceMatcher(None, stm, best[0]).ratio():.2f})"

        if match:
            replaced.append((title, match["name"], how))
            canonical_unused.discard(match["name"])
            if not args.dry_run:
                h["geofence"] = {"polygon": match["polygon"]}
        else:
            kept_as_circle.append(title)

    print(f"\nCurrent parks in data/parks/hotspots.json: {len(hotspots)}")
    print(f"Canonical parks in staging file:            {len(canon)}")
    print(f"\nReplaced (circle → polygon): {len(replaced)}")
    for t, c, how in replaced:
        marker = "  =" if t == c else "  ~"
        print(f"{marker} {t}  ->  {c}    [{how}]")

    print(f"\nKept as circle (no canonical match — DO NOT lose): {len(kept_as_circle)}")
    for t in kept_as_circle:
        print(f"  ! {t}")

    # Show a sampling of canonical parks NOT in the current hotspot list.
    # These aren't added automatically; user can decide.
    print(f"\nCanonical parks not currently in hotspots.json: {len(canonical_unused)}")
    print("  (not added automatically; sample of 12 below)")
    for n in sorted(canonical_unused)[:12]:
        print(f"  + {n}")

    if args.dry_run:
        print("\nDRY RUN — no files changed.")
        return 0

    HOTSPOTS.write_text(json.dumps(hotspots_doc, indent=2, ensure_ascii=False))
    print(f"\nWrote {HOTSPOTS.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
