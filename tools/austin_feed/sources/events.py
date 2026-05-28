"""Upcoming-events lane — reuses already-scraped data (no network).

Scans every data/<category>/hotspots.json plus data/events/events.json
for entries whose schedule has a session starting within the next 7
days, and surfaces them as feed items. Because scrape_events already
populates those files nightly, this lane needs no extra fetching.
"""

from __future__ import annotations

import json
from datetime import date, timedelta

from tools.austin_feed.common import FeedItem, DATA

HORIZON_DAYS = 7


def _iter_hotspot_files():
    for sub in sorted(DATA.iterdir()):
        if not sub.is_dir():
            continue
        f = sub / "hotspots.json"
        if f.exists():
            yield f
    ev = DATA / "events" / "events.json"
    if ev.exists():
        yield ev


def _entries(doc: dict):
    # hotspots.json uses "hotspots"; events.json uses "events".
    return doc.get("hotspots") or doc.get("events") or []


def _first_upcoming_start(schedule: dict, today: date, horizon: date) -> str | None:
    if not schedule:
        return None
    for s in schedule.get("sessions") or []:
        start = (s.get("start") or "")[:10]
        if not start:
            continue
        try:
            d = date.fromisoformat(start)
        except ValueError:
            continue
        if today <= d <= horizon:
            return s.get("start")
    return None


def scrape() -> list[FeedItem]:
    today = date.today()
    horizon = today + timedelta(days=HORIZON_DAYS)
    items: list[FeedItem] = []
    seen: set[str] = set()

    for f in _iter_hotspot_files():
        try:
            doc = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"  events: {f.name} skipped ({e})")
            continue

        for h in _entries(doc):
            start = _first_upcoming_start(h.get("schedule") or {}, today, horizon)
            if not start:
                continue
            title = h.get("title") or h.get("id") or "Event"
            if title in seen:
                continue
            seen.add(title)
            info = h.get("info") or {}
            link = info.get("website") or info.get("sourceUrl") or "https://austin.chat/"
            day_label = start[:10]
            items.append(FeedItem(
                id="event-" + (h.get("id") or title)[:48],
                lane="events",
                headline=f"{title}  ·  {day_label}",
                link=link,
                detail=h.get("subtitle") or "",
                published=start,
            ))

    return items
