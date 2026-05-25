"""Import the Creative Workspaces / Performance Venues / Galleries CSV
into the events hotspots.json files.

Routes rows by AssetType to the right `data/<slug>/hotspots.json`:
  Gallery/ Museum            -> artgalleries
  Theater / Performance Venue -> concertsshows
  Bar/Club/Venue             -> concertsshows
  Restaurant                 -> concertsshows (city's live-music dataset)
  Event/ Festival / Event Venue -> festivals
  Artist Studios/ Workshops  -> meetupsclasses (or artgalleries when notes mention Gallery)
  Everything else            -> skipped

Coordinate format in CSV `Location 1` column is "<address> (lat, lng)";
GeoJSON uses [lng, lat] so we flip. Rows without valid coords are skipped.

Dedup: existing hotspots with a title that matches an incoming row
(normalised: lowercase, alphanumeric only) are replaced in place. Their
`schedule` block — if any — is preserved, since the CSV doesn't carry
opening hours.

One-off script, but committed for reproducibility next time the dataset
ships an update.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
CSV_PATH = REPO / "staging" / "Creative_Workspaces,_Performance_Venues,_Galleries_&_Museums_20260525.csv"
DATA = REPO / "data"

SOURCE = "atx_creative_spaces_csv"

# AssetType -> (slug, default_radius_meters)
ASSET_TO_SLUG = {
    "Gallery/ Museum": ("artgalleries", 70),
    "Theater": ("concertsshows", 100),
    "Performance Venue": ("concertsshows", 120),
    "Bar/Club/Venue": ("concertsshows", 70),
    "Restaurant": ("concertsshows", 70),
    "Event/ Festival": ("festivals", 150),
    "Event Venue": ("festivals", 120),
    "Artist Studios/ Workshops": ("meetupsclasses", 60),
}

_COORDS_RE = re.compile(r"\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s*$")
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _clean(text: str) -> str:
    if not text:
        return ""
    text = _TAG_RE.sub("", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'")
    text = _WS_RE.sub(" ", text).strip()
    return text


def _parse_location(loc: str) -> tuple[str, tuple[float, float] | None]:
    """Return (address, (lng, lat)) from a "address (lat, lng)" string."""
    if not loc:
        return "", None
    m = _COORDS_RE.search(loc)
    if not m:
        return loc.strip(), None
    lat = float(m.group(1))
    lng = float(m.group(2))
    if abs(lat) < 1 and abs(lng) < 1:
        return loc[: m.start()].strip(), None
    address = loc[: m.start()].strip()
    # Some addresses end with stray "0" placeholder zip — drop trailing zeros.
    address = re.sub(r"\s+0\s*$", "", address)
    return address, (lng, lat)


def _slugify(text: str, max_len: int = 60) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s[:max_len] or "venue"


def _normalize_title(text: str) -> str:
    """Aggressive key used for dedup. Strips punctuation and case."""
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _gid_for(*parts: str) -> str:
    h = hashlib.sha1("|".join(parts).encode()).hexdigest()
    alphabet = "abcdefghijkmnopqrstuvwxyz23456789"
    n = int(h[:16], 16)
    out = []
    while len(out) < 10 and n > 0:
        out.append(alphabet[n % len(alphabet)])
        n //= len(alphabet)
    while len(out) < 10:
        out.append("x")
    return "".join(out)


def _classify(row: dict) -> tuple[str, int] | None:
    asset = row.get("AssetType", "").strip()
    notes = row.get("AssetType_notes", "").strip()
    if asset == "Artist Studios/ Workshops":
        # Studio-galleries belong with galleries; everything else maps to
        # meetups/classes (dance studios, workshops, etc.).
        if "Gallery" in notes or notes == "Studio Complex":
            return ("artgalleries", 60)
        if notes in ("Film Studio", "Recording Studio", "Video Production"):
            return None  # not public-facing
        return ("meetupsclasses", 60)
    return ASSET_TO_SLUG.get(asset)


def _build_hotspot(row: dict, slug: str, radius: int) -> dict | None:
    name = _clean(row.get("Name_common", ""))
    if not name:
        return None
    address, coords = _parse_location(row.get("Location 1", ""))
    if not coords:
        return None

    discipline = _clean(row.get("Discipline", ""))
    asset_notes = _clean(row.get("AssetType_notes", ""))
    sub_bits = [b for b in [address, asset_notes or discipline] if b and b.lower() != "none"]
    subtitle = " · ".join(sub_bits)[:160]

    description = _clean(row.get("Web_notes", ""))
    website = _clean(row.get("Website", ""))
    if website and not website.lower().startswith(("http://", "https://")):
        website = ""

    source_id = (row.get("CAMP_ID") or "").strip() or _slugify(name)
    hot_id = _slugify(name, max_len=70) + "-" + str(source_id)[:8]

    info = {}
    if description:
        info["description"] = description
    if website:
        info["website"] = website

    hot = {
        "id": hot_id,
        "gid": _gid_for(SOURCE, str(source_id), name),
        "title": name,
        "subtitle": subtitle,
        "geofence": {"center": [coords[0], coords[1]], "radiusMeters": radius},
        "info": info,
        "source": SOURCE,
        "sourceId": str(source_id),
    }
    return hot


def main() -> int:
    with CSV_PATH.open(encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    bucket: dict[str, list[dict]] = {}
    skipped_no_coords = 0
    skipped_no_category = 0
    for row in rows:
        cls = _classify(row)
        if not cls:
            skipped_no_category += 1
            continue
        slug, radius = cls
        hot = _build_hotspot(row, slug, radius)
        if not hot:
            skipped_no_coords += 1
            continue
        bucket.setdefault(slug, []).append(hot)

    summary = {}
    for slug, items in bucket.items():
        target = DATA / slug / "hotspots.json"
        doc = json.loads(target.read_text())
        existing = doc.get("hotspots") or []

        by_key = {_normalize_title(h.get("title", "")): i for i, h in enumerate(existing)}
        added = replaced = 0
        for hot in items:
            key = _normalize_title(hot["title"])
            if key in by_key:
                idx = by_key[key]
                old = existing[idx]
                # Preserve curator-added schedule + gid for stability.
                if old.get("schedule"):
                    hot["schedule"] = old["schedule"]
                if old.get("gid"):
                    hot["gid"] = old["gid"]
                if old.get("id"):
                    hot["id"] = old["id"]
                existing[idx] = hot
                replaced += 1
            else:
                existing.append(hot)
                by_key[key] = len(existing) - 1
                added += 1

        doc["hotspots"] = existing
        target.write_text(json.dumps(doc, indent=2) + "\n")
        summary[slug] = {"added": added, "replaced": replaced, "total_now": len(existing)}

    print(f"Skipped (no coords): {skipped_no_coords}")
    print(f"Skipped (out-of-scope category): {skipped_no_category}")
    print()
    for slug, s in sorted(summary.items()):
        print(f"  {slug:18s} +{s['added']:4d} added, ~{s['replaced']:3d} replaced, total {s['total_now']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
