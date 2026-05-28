"""Deals & specials lane — hand-curated (no API).

No free API exists for local deals, so this lane reads a manually
maintained list at staging/deals.json. Add/remove entries there (or wire
an ad partner's export into that file); the daily run passes them
through and honors per-deal `expires` so stale offers drop off
automatically.

staging/deals.json shape:
[
  {
    "id": "thunderbird-happy-hour",
    "headline": "Thunderbird Coffee · $2 cold brew til noon",
    "link": "https://example.com",
    "detail": "Mon–Fri before noon.",
    "expires": "2026-12-31T23:59:59Z"
  }
]
"""

from __future__ import annotations

import json

from tools.austin_feed.common import FeedItem, STAGING

DEALS_FILE = STAGING / "deals.json"


def scrape() -> list[FeedItem]:
    if not DEALS_FILE.exists():
        return []
    try:
        rows = json.loads(DEALS_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"  deals: could not parse {DEALS_FILE.name} ({e})")
        return []
    if not isinstance(rows, list):
        return []

    items: list[FeedItem] = []
    for i, r in enumerate(rows):
        headline = (r.get("headline") or "").strip()
        link = (r.get("link") or "").strip()
        if not headline or not link:
            continue
        items.append(FeedItem(
            id=r.get("id") or f"deal-{i}",
            lane="deals",
            headline=headline,
            link=link,
            detail=r.get("detail") or "",
            expires=r.get("expires") or "",
            published=r.get("published") or "",
        ))
    return items
