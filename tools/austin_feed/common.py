"""Shared types + helpers for the Austin daily feed.

Each scraper in `sources/` exposes a `scrape() -> list[FeedItem]`
function. `run.py` calls every scraper, sorts the combined items, drops
expired ones, and writes a single `data/austinfeed/feed.json` that the
bottom-of-map ticker renders.

Hermetic by design: stdlib only (urllib + xml.etree), no API keys.
"""

from __future__ import annotations

import json
import urllib.request
import urllib.error
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

REPO = Path(__file__).resolve().parent.parent.parent
DATA = REPO / "data"
STAGING = REPO / "staging"
OUTPUT = DATA / "austinfeed" / "feed.json"

USER_AGENT = "austin.chat-feed-bot/1.0 (+https://austin.chat)"

# Per-lane display defaults + base sort priority (ascending = earlier in
# the ticker). Individual items may override label/icon/priority.
LANES = {
    "alerts":  {"label": "Alert",    "icon": "⚠️", "priority": 0},
    "weather": {"label": "Weather",  "icon": "☀️", "priority": 10},
    "events":  {"label": "Event",    "icon": "📅", "priority": 20},
    "deals":   {"label": "Deal",     "icon": "🏷️", "priority": 25},
    "news":    {"label": "News",     "icon": "📰", "priority": 30},
    "sports":  {"label": "Sports",   "icon": "🏆", "priority": 40},
    "lunch":   {"label": "Lunch",    "icon": "🍎", "priority": 50},
}


@dataclass
class FeedItem:
    id: str
    lane: str                 # one of LANES
    headline: str             # short, ticker-sized (≤ ~80 chars)
    link: str                 # source URL (opens in a new tab)
    label: str = ""           # falls back to LANES[lane]["label"]
    icon: str = ""            # falls back to LANES[lane]["icon"]
    detail: str = ""          # optional longer text (stored, not shown yet)
    severity: int | None = None   # alerts only
    priority: int | None = None   # falls back to LANES[lane]["priority"]
    published: str = ""       # ISO 8601 UTC
    expires: str = ""         # ISO 8601 UTC; item dropped after this

    def normalized(self) -> dict:
        lane_def = LANES.get(self.lane, {"label": self.lane.title(), "icon": "•", "priority": 60})
        d = asdict(self)
        d["label"] = self.label or lane_def["label"]
        d["icon"] = self.icon or lane_def["icon"]
        d["priority"] = self.priority if self.priority is not None else lane_def["priority"]
        # Drop empty optionals to keep the file tidy.
        for k in ("detail", "published", "expires"):
            if not d.get(k):
                d.pop(k, None)
        if d.get("severity") is None:
            d.pop("severity", None)
        return d


def now_utc_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def http_get(url: str, accept: str = "application/json", timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": accept,
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def get_json(url: str, timeout: int = 30):
    return json.loads(http_get(url, accept="application/geo+json, application/json", timeout=timeout))


def _parse_iso(s: str) -> datetime | None:
    if not s:
        return None
    try:
        # Accept trailing Z and offset forms.
        s2 = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s2)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def drop_expired(items: Iterable[FeedItem], now: datetime | None = None) -> list[FeedItem]:
    now = now or datetime.now(timezone.utc)
    kept = []
    for it in items:
        exp = _parse_iso(it.expires)
        if exp and exp < now:
            continue
        kept.append(it)
    return kept


def sort_items(items: list[FeedItem]) -> list[FeedItem]:
    def key(it: FeedItem):
        lane_def = LANES.get(it.lane, {"priority": 60})
        pri = it.priority if it.priority is not None else lane_def["priority"]
        pub = _parse_iso(it.published) or datetime.min.replace(tzinfo=timezone.utc)
        # ascending priority, then most-recent first
        return (pri, -pub.timestamp())
    return sorted(items, key=key)


def write_feed(items: list[FeedItem], dry_run: bool = False) -> dict:
    items = drop_expired(items)
    items = sort_items(items)
    doc = {
        "cityId": "atx",
        "generated": now_utc_iso(),
        "items": [it.normalized() for it in items],
    }
    payload = json.dumps(doc, indent=2, ensure_ascii=False) + "\n"
    if dry_run:
        print(payload)
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(payload, encoding="utf-8")
    return doc
