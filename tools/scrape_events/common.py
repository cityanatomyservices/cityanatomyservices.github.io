"""Shared types + helpers for event scrapers.

Each scraper in `sources/` exposes a `scrape() -> list[Event]` function.
`run.py` calls every scraper, groups events by `category_slug`, and
merges them into the matching `data/<slug>/hotspots.json`.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

REPO = Path(__file__).resolve().parent.parent.parent
DATA = REPO / "data"


@dataclass
class Session:
    start: str  # YYYY-MM-DDTHH:MM (local wall time in tz)
    end: str    # YYYY-MM-DDTHH:MM

    def asdict(self) -> dict:
        return {"start": self.start, "end": self.end}


@dataclass
class Event:
    title: str
    subtitle: str
    category_slug: str         # data/<slug>/hotspots.json target
    venue_name: str            # key into venues.py lookup
    sessions: list[Session]
    source: str                # short scraper id, e.g. "palmer"
    source_id: str             # stable id within source (event slug / GUID)
    source_url: str            # canonical URL on the source site
    description: str = ""
    website: str = ""
    timezone: str = "America/Chicago"
    radius_meters: int = 100

    def hotspot_id(self) -> str:
        """Stable kebab-case id for the resulting hotspot."""
        base = self.title.lower()
        for ch in " ·:'\"&/()+,.":
            base = base.replace(ch, "-")
        while "--" in base:
            base = base.replace("--", "-")
        return base.strip("-")[:80] + "-" + self.source_id[:6]

    def gid(self) -> str:
        """10-char alphanumeric id stable for the (source, source_id) pair."""
        h = hashlib.sha1(f"{self.source}|{self.source_id}".encode()).hexdigest()
        # Map hex (0-9, a-f) into 0-9 + a-z for variety.
        alphabet = "abcdefghijkmnopqrstuvwxyz23456789"  # no l, 0, 1 (look-alikes)
        out = []
        n = int(h[:16], 16)
        while len(out) < 10 and n > 0:
            out.append(alphabet[n % len(alphabet)])
            n //= len(alphabet)
        while len(out) < 10:
            out.append("x")
        return "".join(out)


def merge_into_data_file(events: Iterable[Event], venues: dict[str, tuple[float, float]]) -> dict:
    """Merge a batch of Events into the corresponding data/<slug>/hotspots.json.

    Replaces any existing hotspot whose `info.source` + `info.sourceId`
    matches an incoming event (so an event whose dates change updates in
    place). Hand-curated hotspots without `info.source` are never
    touched. Returns a summary dict for the action log.
    """
    summary = {}
    by_slug: dict[str, list[Event]] = {}
    for e in events:
        by_slug.setdefault(e.category_slug, []).append(e)

    for slug, batch in by_slug.items():
        target = DATA / slug / "hotspots.json"
        if not target.exists():
            print(f"  [{slug}] WARN: data file missing, skipping {len(batch)} events")
            summary[slug] = {"added": 0, "updated": 0, "skipped_no_coords": 0}
            continue

        doc = json.loads(target.read_text())
        existing = doc.get("hotspots") or []
        by_sid = {
            (h.get("info", {}).get("source"), h.get("info", {}).get("sourceId")): i
            for i, h in enumerate(existing)
            if h.get("info", {}).get("source")
        }

        added = updated = skipped = 0
        for ev in batch:
            coords = venues.get(ev.venue_name)
            if not coords:
                print(f"  [{slug}] no venue coords for '{ev.venue_name}', skipping '{ev.title}'")
                skipped += 1
                continue
            hotspot = {
                "id": ev.hotspot_id(),
                "gid": ev.gid(),
                "title": ev.title,
                "subtitle": ev.subtitle,
                "geofence": {
                    "center": [coords[0], coords[1]],
                    "radiusMeters": ev.radius_meters,
                },
                "schedule": {
                    "timezone": ev.timezone,
                    "sessions": [s.asdict() for s in ev.sessions],
                },
                "info": {
                    "description": ev.description,
                    "website": ev.website or ev.source_url,
                    "source": ev.source,
                    "sourceId": ev.source_id,
                    "sourceUrl": ev.source_url,
                },
            }
            key = (ev.source, ev.source_id)
            if key in by_sid:
                existing[by_sid[key]] = hotspot
                updated += 1
            else:
                existing.append(hotspot)
                added += 1

        doc["hotspots"] = existing
        target.write_text(json.dumps(doc, indent=2) + "\n")
        summary[slug] = {"added": added, "updated": updated, "skipped_no_coords": skipped}

    return summary
