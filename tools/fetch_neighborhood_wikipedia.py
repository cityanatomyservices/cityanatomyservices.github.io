#!/usr/bin/env python3
"""Backfill neighborhood descriptions from Wikipedia.

For each entry in data/neighborhoods/hotspots.json, queries the
Wikipedia REST summary API (which follows redirects and dehydrates
disambiguation pages) under a couple of URL patterns. When a match is
found, writes the lead paragraph into info.description and the canonical
desktop URL into info.wikipedia. Neighborhoods with no match keep their
existing description and have any stale info.wikipedia stripped.

Idempotent. Re-run whenever the neighborhoods file is regenerated.
"""

from __future__ import annotations

import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
NBHD_FILE = REPO / "data" / "neighborhoods" / "hotspots.json"
SRC_GLOB = "Neighborhoods_*.geojson"

# Downtown Austin (Congress Ave at the Capitol/lake), used as the anchor
# for the "<distance> miles <direction> of downtown" fallback blurb.
DOWNTOWN = (-97.7431, 30.2672)

API = "https://en.wikipedia.org/api/rest_v1/page/summary/"
HEADERS = {
    "User-Agent": "city-anatomy-bot/1.0 (https://austin.chat; atxlora@gmail.com)",
    "Accept": "application/json",
}


def _haversine_miles(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
    r = 3958.7613  # Earth radius in miles
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _bearing(lng1: float, lat1: float, lng2: float, lat2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lng2 - lng1)
    x = math.sin(dl) * math.cos(p2)
    y = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def _compass(bearing: float) -> str:
    names = ["north", "northeast", "east", "southeast",
             "south", "southwest", "west", "northwest"]
    return names[round(bearing / 45) % 8]


def load_sqmi_index() -> dict[str, float]:
    matches = sorted((REPO / "staging").glob(SRC_GLOB))
    if not matches:
        return {}
    with matches[-1].open() as f:
        gj = json.load(f)
    out: dict[str, float] = {}
    for feat in gj["features"]:
        name = (feat["properties"].get("neighname") or "").strip()
        sq = feat["properties"].get("sqmiles")
        if not name or sq is None:
            continue
        try:
            out[name.upper()] = float(sq)
        except (TypeError, ValueError):
            pass
    return out


def compose_fallback(title: str, raw_name: str, center: list[float] | None,
                     sqmi_index: dict[str, float]) -> str:
    """Build a data-only description for neighborhoods with no Wikipedia hit."""
    sqmi = sqmi_index.get(raw_name.upper())
    sqmi_phrase = ""
    if sqmi is not None:
        # 0.05 sq mi shows as "0.1" — clearer than "0.0".
        if sqmi >= 1:
            sqmi_phrase = f"{sqmi:.1f}-square-mile "
        elif sqmi >= 0.1:
            sqmi_phrase = f"{sqmi:.1f}-square-mile "
        else:
            sqmi_phrase = "small "
    loc_phrase = ""
    if center and len(center) == 2:
        dist_mi = _haversine_miles(center[0], center[1], *DOWNTOWN)
        direction = _compass(_bearing(DOWNTOWN[0], DOWNTOWN[1], center[0], center[1]))
        if dist_mi < 0.7:
            loc_phrase = "in downtown Austin"
        elif dist_mi < 1.5:
            loc_phrase = f"just {direction} of downtown Austin"
        else:
            loc_phrase = f"about {dist_mi:.1f} miles {direction} of downtown Austin"
    if sqmi_phrase and loc_phrase:
        return f"{title} is a {sqmi_phrase}neighborhood {loc_phrase}."
    if loc_phrase:
        return f"{title} is a neighborhood {loc_phrase}."
    if sqmi_phrase:
        return f"{title} is a {sqmi_phrase}neighborhood in Austin, TX."
    return f"{title} neighborhood, Austin TX."


def fetch_summary(title_part: str) -> dict | None:
    url = API + title_part
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        if e.code != 404:
            print(f"  HTTP {e.code} for {url}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  ERR for {url}: {e}", file=sys.stderr)
        return None
    if data.get("type") != "standard":
        return None
    canonical_title = (data.get("title") or "").strip()
    # Reject generic index pages that Wikipedia falls back to when the
    # exact neighborhood doesn't have its own article (e.g. "Windsor
    # Hills" → "List of Austin neighborhoods").
    if canonical_title.lower().startswith("list of"):
        return None
    extract = (data.get("extract") or "").strip()
    if not extract:
        return None
    if "austin" not in extract.lower():
        # Guard against false positives from bare-name lookups (e.g. a
        # neighborhood called "Mueller" hitting the Mueller car company
        # page). We always want an Austin-specific article.
        return None
    canonical = data.get("content_urls", {}).get("desktop", {}).get("page")
    return {"extract": extract, "url": canonical, "title": canonical_title}


def candidates(title: str) -> list[str]:
    enc = urllib.parse.quote(title.replace(" ", "_"), safe=",_()'")
    return [
        f"{enc},_Austin,_Texas",
        f"{enc}_(Austin,_Texas)",
        f"{enc},_Austin",
    ]


def main() -> int:
    with NBHD_FILE.open() as f:
        data = json.load(f)
    sqmi_index = load_sqmi_index()
    found = 0
    skipped: list[str] = []
    for h in data["hotspots"]:
        title = h["title"]
        result = None
        for pat in candidates(title):
            result = fetch_summary(pat)
            if result:
                break
            time.sleep(0.05)
        info = h.setdefault("info", {})
        if result:
            info["description"] = result["extract"]
            info["wikipedia"] = result["url"]
            found += 1
            print(f"  ✓ {title:30s} -> {result['title']}")
        else:
            # No Wikipedia article — fall back to a data-only blurb
            # composed from sqmiles (from the source geojson) and the
            # hotspot's centroid relative to downtown Austin. Better
            # than the bare "X neighborhood, Austin TX." placeholder.
            center = (h.get("geofence") or {}).get("center")
            info["description"] = compose_fallback(title, title, center, sqmi_index)
            info.pop("wikipedia", None)
            skipped.append(title)
    NBHD_FILE.write_text(json.dumps(data, separators=(",", ":")))
    print()
    print(f"found wikipedia entries: {found}/{len(data['hotspots'])}")
    print(f"composed fallback blurb: {len(skipped)}")
    if skipped:
        print("  " + ", ".join(skipped))
    return 0


if __name__ == "__main__":
    sys.exit(main())
