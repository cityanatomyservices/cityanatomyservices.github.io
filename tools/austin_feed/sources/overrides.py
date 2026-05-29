"""Overrides lane — hand-curated / pinned entries.

Reads staging/feed_overrides.json: a flat list of item dicts, each with a
`lane`. Use it to pin editorial entries (Special Reports you write,
promoted Deals, Gossip blurbs) on top of whatever the registry + bespoke
sources fetch. Pinned items get a very low priority so they sort to the
front of their topic's pool.

staging/feed_overrides.json shape:
[
  { "lane": "reports", "headline": "Austin's 5 best new patios",
    "link": "https://...", "detail": "Editor's pick",
    "expires": "2026-12-31T23:59:59Z" },

  # Geo-targeted card (e.g. a local business ad): add "neighborhoods"
  # with one or more neighborhood ids. The UI shows it only when the
  # visitor is in a matching neighborhood. Omit it for a citywide card.
  { "lane": "local", "headline": "20% off at Joe's Coffee",
    "link": "https://...", "neighborhoods": ["nbhd-bouldin-creek"],
    "expires": "2026-12-31T23:59:59Z" }
]
"""

from __future__ import annotations

import json

from tools.austin_feed.common import FeedItem, STAGING

OVERRIDES = STAGING / "feed_overrides.json"
PIN_PRIORITY = 1   # below alerts (0), ahead of everything fetched


def scrape() -> list[FeedItem]:
    if not OVERRIDES.exists():
        return []
    try:
        rows = json.loads(OVERRIDES.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"  overrides: could not parse {OVERRIDES.name} ({e})")
        return []
    if not isinstance(rows, list):
        return []

    items: list[FeedItem] = []
    for i, r in enumerate(rows):
        lane = (r.get("lane") or "").strip()
        headline = (r.get("headline") or "").strip()
        link = (r.get("link") or "").strip()
        if not lane or not headline or not link:
            continue
        nbhds = r.get("neighborhoods") or []
        if isinstance(nbhds, str):
            nbhds = [nbhds]
        items.append(FeedItem(
            id=r.get("id") or f"pin-{lane}-{i}",
            lane=lane,
            headline=headline,
            link=link,
            detail=r.get("detail") or "",
            source=r.get("source") or "",
            neighborhoods=[str(x) for x in nbhds],
            priority=r.get("priority", PIN_PRIORITY),
            published=r.get("published") or "",
            expires=r.get("expires") or "",
        ))
    return items
