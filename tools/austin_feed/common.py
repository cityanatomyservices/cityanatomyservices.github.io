"""Shared types + helpers for the Austin daily feed.

Each scraper in `sources/` exposes a `scrape() -> list[FeedItem]`
function. `run.py` calls every scraper, sorts + caps the combined items,
drops expired ones, and writes a single `feed/feed.json` that the
bottom-of-map feed renders.

Hermetic by design: stdlib only (urllib + xml.etree), no API keys.
"""

from __future__ import annotations

import json
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

REPO = Path(__file__).resolve().parent.parent.parent
DATA = REPO / "data"
STAGING = REPO / "staging"
# The feed lives at the repo-root /feed/ so the UI fetches /feed/feed.json.
OUTPUT = REPO / "feed" / "feed.json"

# How many entries we keep per topic so the UI can rotate through a pool.
PER_LANE = 5

USER_AGENT = "austin.chat-feed-bot/1.0 (+https://austin.chat)"

# Per-lane display defaults + base sort priority (ascending = earlier in
# the ticker). Individual items may override label/icon/priority. Lanes
# without a source module yet (reports/realestate/stocks/gossip) are
# listed so the UI's topic pills and any future scraper share one
# vocabulary.
LANES = {
    "alerts":     {"label": "Alert",          "icon": "⚠️", "priority": 0},
    "weather":    {"label": "Weather",        "icon": "☀️", "priority": 10},
    "events":     {"label": "Event",          "icon": "📅", "priority": 20},
    "deals":      {"label": "Deal",           "icon": "🏷️", "priority": 25},
    "news":       {"label": "Local News",     "icon": "📰", "priority": 30},
    "sports":     {"label": "Local Sports",   "icon": "🏆", "priority": 40},
    "lunch":      {"label": "School Lunch",   "icon": "🍎", "priority": 50},
    "reports":    {"label": "Special Report", "icon": "📋", "priority": 35},
    "realestate": {"label": "Real Estate",    "icon": "🏠", "priority": 45},
    "stocks":     {"label": "Stocks",         "icon": "📈", "priority": 55},
    "gossip":     {"label": "Gossip",         "icon": "💬", "priority": 60},
}


@dataclass
class FeedItem:
    id: str
    lane: str                 # one of LANES
    headline: str             # short, ticker-sized (≤ ~80 chars)
    link: str                 # source URL (opens in a new tab)
    label: str = ""           # falls back to LANES[lane]["label"]
    icon: str = ""            # falls back to LANES[lane]["icon"]
    detail: str = ""          # optional longer text (shown as card subtitle)
    source: str = ""          # curated outlet name, e.g. "KUT"
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
        # A curated entry with a source but no detail shows the source as
        # its subtitle.
        if not d.get("detail") and d.get("source"):
            d["detail"] = d["source"]
        # Drop empty optionals to keep the file tidy.
        for k in ("detail", "source", "published", "expires"):
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


def cap_per_lane(items: list[FeedItem], n: int = PER_LANE) -> list[FeedItem]:
    """Keep at most `n` items per lane, preserving the incoming order
    (callers pass already-sorted items, so this keeps each lane's best)."""
    counts: dict[str, int] = {}
    kept: list[FeedItem] = []
    for it in items:
        c = counts.get(it.lane, 0)
        if c >= n:
            continue
        counts[it.lane] = c + 1
        kept.append(it)
    return kept


# ── Shared RSS/Atom parsing (used by the registry source) ─────────────
def _rss_text(node, tag) -> str:
    el = node.find(tag)
    return (el.text or "").strip() if el is not None and el.text else ""


def parse_feed(raw: bytes, limit: int = 5) -> list[dict]:
    """Parse RSS 2.0 or Atom bytes into [{title, link, published}], newest
    as they appear in the document, up to `limit`."""
    root = ET.fromstring(raw)
    out: list[dict] = []
    entries = root.findall(".//item")
    atom = False
    if not entries:
        ns = {"a": "http://www.w3.org/2005/Atom"}
        entries = root.findall(".//a:entry", ns)
        atom = True
    for e in entries:
        if atom:
            ns = {"a": "http://www.w3.org/2005/Atom"}
            title = (e.findtext("a:title", default="", namespaces=ns) or "").strip()
            link_el = e.find("a:link", ns)
            link = link_el.get("href") if link_el is not None else ""
            pub = (e.findtext("a:updated", default="", namespaces=ns) or "").strip()
        else:
            title = _rss_text(e, "title")
            link = _rss_text(e, "link")
            pub = _rss_text(e, "pubDate")
        if not title or not link:
            continue
        out.append({"title": title, "link": link, "published": pub})
        if len(out) >= limit:
            break
    return out


def write_feed(items: list[FeedItem], dry_run: bool = False) -> dict:
    items = drop_expired(items)
    items = sort_items(items)
    items = cap_per_lane(items)
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
