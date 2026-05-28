"""Local news lane — Austin RSS feeds (stdlib XML, no API key).

RSS is built for syndication, so this is the lowest-risk source. Each
feed contributes its top few headlines; results are de-duped by title.

If a feed URL changes or 404s, that feed is skipped — the others still
contribute. Confirm/extend FEEDS with the outlets you want.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET

from tools.austin_feed.common import FeedItem, http_get

# (source label, RSS url). Verify these against each outlet's site; they
# follow the common WordPress / news-CMS feed conventions.
FEEDS = [
    ("KUT",              "https://www.kut.org/news.rss"),
    ("KXAN",             "https://www.kxan.com/feed/"),
    ("Austin Monitor",   "https://www.austinmonitor.com/feed/"),
    ("Community Impact", "https://communityimpact.com/rss/city/austin/"),
]

PER_FEED = 4


def _text(node, tag):
    el = node.find(tag)
    return (el.text or "").strip() if el is not None and el.text else ""


def scrape() -> list[FeedItem]:
    items: list[FeedItem] = []
    seen_titles: set[str] = set()

    for label, url in FEEDS:
        try:
            raw = http_get(url, accept="application/rss+xml, application/xml, text/xml")
            root = ET.fromstring(raw)
        except Exception as e:
            print(f"  news: {label} skipped ({e})")
            continue

        # RSS 2.0: channel/item. Atom: feed/entry. Handle both.
        entries = root.findall(".//item")
        atom = False
        if not entries:
            ns = {"a": "http://www.w3.org/2005/Atom"}
            entries = root.findall(".//a:entry", ns)
            atom = True

        count = 0
        for e in entries:
            if atom:
                ns = {"a": "http://www.w3.org/2005/Atom"}
                title = (e.findtext("a:title", default="", namespaces=ns) or "").strip()
                link_el = e.find("a:link", ns)
                link = link_el.get("href") if link_el is not None else ""
                pub = (e.findtext("a:updated", default="", namespaces=ns) or "").strip()
            else:
                title = _text(e, "title")
                link = _text(e, "link")
                pub = _text(e, "pubDate")

            if not title or not link:
                continue
            key = title.lower()
            if key in seen_titles:
                continue
            seen_titles.add(key)

            items.append(FeedItem(
                id=f"news-{label.lower().replace(' ', '')}-{abs(hash(link)) % 10**8}",
                lane="news",
                headline=f"{title}  ·  {label}",
                link=link,
                published=pub,
            ))
            count += 1
            if count >= PER_FEED:
                break

    return items
