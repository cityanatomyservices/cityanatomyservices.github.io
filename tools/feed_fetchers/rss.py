"""Generic RSS/Atom fetcher.

config (in a topic's "fetch" block):
    {
      "type": "rss",
      "enabled": true,
      "feeds": [
        { "url": "https://www.kut.org/news.rss", "source": "KUT", "max": 2 },
        ...
      ]
    }

Returns the combined headlines as feed-item field dicts. Per-feed fail-soft:
a dead/blocked feed is skipped and the rest still return. If every feed fails
(e.g. no network), returns [] and the builder falls back to the topic's
curated link.
"""

from __future__ import annotations

from tools.feed_lib import http_get, parse_feed


def fetch(config: dict) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for f in config.get("feeds") or []:
        url = (f or {}).get("url")
        if not url:
            continue
        try:
            raw = http_get(url, accept="application/rss+xml, application/xml, text/xml")
            entries = parse_feed(raw, limit=int(f.get("max", 3)))
        except Exception as e:
            print(f"    rss: {f.get('source', url)} skipped ({e})")
            continue
        for e in entries:
            key = e["title"].strip().lower()
            if not key or key in seen:
                continue
            seen.add(key)
            out.append({
                "headline": e["title"],
                "link": e["link"],
                "source": f.get("source", ""),
                "published": e.get("published", ""),
            })
    return out
