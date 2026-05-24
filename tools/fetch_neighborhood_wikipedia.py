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
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
NBHD_FILE = REPO / "data" / "neighborhoods" / "hotspots.json"

API = "https://en.wikipedia.org/api/rest_v1/page/summary/"
HEADERS = {
    "User-Agent": "city-anatomy-bot/1.0 (https://austin.chat; atxlora@gmail.com)",
    "Accept": "application/json",
}


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
            # Reset to the default generic blurb so a prior run's stale
            # text (e.g. a now-filtered "List of..." hit) doesn't linger.
            info["description"] = f"{title} neighborhood, Austin TX."
            info.pop("wikipedia", None)
            skipped.append(title)
    NBHD_FILE.write_text(json.dumps(data, separators=(",", ":")))
    print()
    print(f"found wikipedia entries: {found}/{len(data['hotspots'])}")
    print(f"skipped (no page): {len(skipped)}")
    if skipped:
        print("  " + ", ".join(skipped))
    return 0


if __name__ == "__main__":
    sys.exit(main())
