"""Registry-driven lane — the curated canonical source list.

Reads staging/feed_registry.json: a map of topic → list of source rows.
Each row is fetched by `type` and turned into FeedItems tagged with that
topic. This is the no-code path: to add a site to a topic, add a row to
the JSON — no Python change needed.

Row shapes:
  RSS:  { "type": "rss",  "url": "...", "source": "KUT", "max": 2 }
  JSON: { "type": "json", "url": "...", "source": "...", "max": 3,
          "items_path": "data.articles",          # dotted path to the list
          "map": { "headline": "title", "link": "url",
                   "published": "date", "detail": "summary" } }

Every row is fetched independently and fail-soft: one dead URL only drops
that row, so a topic just gets lighter that day (per-topic best-effort).
"""

from __future__ import annotations

import json

from tools.austin_feed.common import (
    FeedItem, STAGING, http_get, get_json, parse_feed,
)

REGISTRY = STAGING / "feed_registry.json"


def _stable_id(lane: str, source: str, link: str) -> str:
    tag = (source or "src").lower().replace(" ", "")
    return f"{lane}-{tag}-{abs(hash(link)) % 10**8}"


def _dig(obj, dotted: str):
    cur = obj
    for part in (dotted or "").split("."):
        if not part:
            continue
        if isinstance(cur, dict):
            cur = cur.get(part)
        else:
            return None
    return cur


def _from_rss(lane: str, row: dict) -> list[FeedItem]:
    raw = http_get(row["url"], accept="application/rss+xml, application/xml, text/xml")
    items = []
    for e in parse_feed(raw, limit=int(row.get("max", 3))):
        items.append(FeedItem(
            id=_stable_id(lane, row.get("source", ""), e["link"]),
            lane=lane,
            headline=e["title"],
            link=e["link"],
            source=row.get("source", ""),
            published=e.get("published", ""),
        ))
    return items


def _from_json(lane: str, row: dict) -> list[FeedItem]:
    data = get_json(row["url"])
    rows = _dig(data, row.get("items_path", "")) or (data if isinstance(data, list) else [])
    mapping = row.get("map", {})
    out = []
    for r in rows[: int(row.get("max", 3))]:
        headline = str(_dig(r, mapping.get("headline", "")) or "").strip()
        link = str(_dig(r, mapping.get("link", "")) or "").strip()
        if not headline or not link:
            continue
        out.append(FeedItem(
            id=_stable_id(lane, row.get("source", ""), link),
            lane=lane,
            headline=headline,
            link=link,
            source=row.get("source", ""),
            detail=str(_dig(r, mapping.get("detail", "")) or ""),
            published=str(_dig(r, mapping.get("published", "")) or ""),
        ))
    return out


def scrape() -> list[FeedItem]:
    if not REGISTRY.exists():
        return []
    try:
        reg = json.loads(REGISTRY.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"  registry: could not parse {REGISTRY.name} ({e})")
        return []

    items: list[FeedItem] = []
    seen: set[str] = set()
    for lane, rows in reg.items():
        if not isinstance(rows, list):
            continue
        for row in rows:
            url = (row or {}).get("url", "")
            if not url or url.startswith("REPLACE") or "example.com" in url:
                continue  # placeholder row — skip until a real URL is set
            kind = row.get("type", "rss")
            try:
                batch = _from_rss(lane, row) if kind == "rss" else _from_json(lane, row)
            except Exception as e:
                print(f"  registry: {lane}/{row.get('source', url)} skipped ({e})")
                continue
            for it in batch:
                key = (it.lane, it.headline.lower())
                if key in seen:
                    continue
                seen.add(key)
                items.append(it)
    return items
