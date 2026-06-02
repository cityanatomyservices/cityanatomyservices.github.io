"""Build feed/feed.json from the curated directory in staging/sources.json.

The feed is the strip of cards at the bottom of austin.chat. Each topic in
sources.json becomes one or more cards:

  • Curated links (always): every topic lists 1+ official sources
    (title + blurb + url) that render as always-on cards. No API keys.
  • Live enrichment (optional): a topic may carry a `fetch` block naming a
    module in tools/feed_fetchers/ (e.g. "nws", "rss"). When enabled, the
    fetcher's items REPLACE the curated cards for that topic; on ANY error
    (or no network, or an empty result) the builder falls back to the
    curated links — so a card is never blank.

Plus optional hand-pinned cards from staging/feed_overrides.json.

Adding a topic     = one block in staging/sources.json (no code).
Adding a live value = one module in tools/feed_fetchers/ + flip enabled:true.

Hermetic by design: stdlib only. A curated-only build needs no network.

Usage:
    python tools/build_feed.py                # full build → feed/feed.json
    python tools/build_feed.py --dry-run      # print the JSON, write nothing
    python tools/build_feed.py --no-fetch     # skip all fetchers (curated only, offline-safe)

staging/feed_overrides.json shape (pinned cards, optional — a flat list):
    [
      { "lane": "events", "headline": "...", "link": "https://...",
        "detail": "Editor's pick", "expires": "2026-12-31T23:59:59Z" },

      # geo-targeted card (e.g. a local business ad): add "neighborhoods"
      # and it shows only when the visitor is standing in one of them.
      { "lane": "local", "headline": "20% off at Joe's", "link": "https://...",
        "neighborhoods": ["nbhd-bouldin-creek"], "expires": "..." }
    ]
"""

from __future__ import annotations

import argparse
import importlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))

from tools.feed_lib import FeedItem, STAGING, write_feed   # noqa: E402

SOURCES = STAGING / "sources.json"
OVERRIDES = STAGING / "feed_overrides.json"
PIN_PRIORITY = 1   # below alerts (0), ahead of everything else


def _load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _item(topic: dict, fields: dict, idx: int) -> FeedItem:
    """Build a FeedItem from a fetcher row or curated link, stamping the
    topic's lane/label/icon/priority where the row doesn't override them."""
    return FeedItem(
        id=fields.get("id") or f"{topic['id']}-{idx}",
        lane=topic["lane"],
        headline=(fields.get("headline") or "").strip(),
        link=(fields.get("link") or "").strip(),
        label=fields.get("label") or topic.get("label") or "",
        icon=fields.get("icon") or topic.get("icon") or "",
        detail=fields.get("detail") or "",
        source=fields.get("source") or "",
        neighborhoods=fields.get("neighborhoods") or [],
        priority=fields.get("priority", topic.get("priority")),
        published=fields.get("published") or "",
        expires=fields.get("expires") or "",
    )


def _curated_cards(topic: dict) -> list[FeedItem]:
    out = []
    for n, lk in enumerate(topic.get("links") or []):
        it = _item(topic, {
            "headline": lk.get("title"),
            "link": lk.get("url"),
            "detail": lk.get("blurb"),
        }, n)
        if it.headline and it.link:
            out.append(it)
    return out


def _enriched_cards(topic: dict) -> list[FeedItem] | None:
    """Run the topic's fetcher if enabled; return its cards, or None to fall
    back to the curated links."""
    fx = topic.get("fetch") or {}
    if not fx.get("enabled"):
        return None
    ftype = fx.get("type") or ""
    try:
        mod = importlib.import_module(f"tools.feed_fetchers.{ftype}")
    except Exception as e:
        print(f"  [{topic['id']}] no fetcher '{ftype}' ({e}) — using curated")
        return None
    try:
        rows = mod.fetch(fx) or []
    except Exception as e:
        print(f"  [{topic['id']}] fetch '{ftype}' failed: {e} — using curated")
        return None
    cards = [_item(topic, r, i) for i, r in enumerate(rows)]
    cards = [c for c in cards if c.headline and c.link]
    return cards or None


def _overrides() -> list[FeedItem]:
    if not OVERRIDES.exists():
        return []
    try:
        rows = _load_json(OVERRIDES)
    except Exception as e:
        print(f"  overrides: could not parse {OVERRIDES.name} ({e})")
        return []
    if not isinstance(rows, list):
        return []
    out = []
    for i, r in enumerate(rows):
        lane = (r.get("lane") or "").strip()
        headline = (r.get("headline") or "").strip()
        link = (r.get("link") or "").strip()
        if not (lane and headline and link):
            continue
        nbhds = r.get("neighborhoods") or []
        if isinstance(nbhds, str):
            nbhds = [nbhds]
        out.append(FeedItem(
            id=r.get("id") or f"pin-{lane}-{i}",
            lane=lane, headline=headline, link=link,
            detail=r.get("detail") or "", source=r.get("source") or "",
            neighborhoods=[str(x) for x in nbhds],
            priority=r.get("priority", PIN_PRIORITY),
            published=r.get("published") or "", expires=r.get("expires") or "",
        ))
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="print the feed JSON instead of writing it")
    ap.add_argument("--no-fetch", action="store_true",
                    help="skip all live fetchers (curated links only, offline-safe)")
    args = ap.parse_args()

    src = _load_json(SOURCES)
    items: list[FeedItem] = []
    for topic in src.get("topics", []):
        if not topic.get("id") or not topic.get("lane"):
            continue
        curated = _curated_cards(topic)
        enriched = None if args.no_fetch else _enriched_cards(topic)
        chosen = enriched if enriched is not None else curated
        print(f"  [{topic['id']}] {len(chosen)} card(s)"
              + (" (live)" if enriched is not None else " (curated)"))
        items.extend(chosen)

    pins = _overrides()
    if pins:
        print(f"  [overrides] {len(pins)} pinned")
        items.extend(pins)

    doc = write_feed(items, dry_run=args.dry_run)
    print(f"\n{len(doc['items'])} items written (after dedupe + expiry + sort + cap).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
