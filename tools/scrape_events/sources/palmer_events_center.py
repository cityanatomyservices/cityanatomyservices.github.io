"""Scrape Palmer Events Center upcoming events.

Strategy: Palmer's /events page lists each event as a `<div>` with a
title, date range, and detail link. We fetch the page, walk the
structure, and emit Event objects. Multi-day events become a single
Session whose start/end span the published date range.

Heuristics here may need updating when the site changes. Fail loudly
in the logs but don't crash the run — the manager catches exceptions.
"""

from __future__ import annotations

import re
import urllib.request
from datetime import datetime, timedelta

from ..common import Event, Session

URL = "https://www.palmereventscenter.com/events"
SOURCE = "palmer"

# Mapping from event-title keyword → category_slug. Add to taste as the
# Palmer calendar surfaces more event types. Anything that doesn't
# match a keyword falls back to "festivals".
CATEGORY_HINTS = [
    ("vintage",   "temporarymarkets"),
    ("market",    "temporarymarkets"),
    ("makers",    "temporarymarkets"),
    ("bazaar",    "popupshops"),
    ("art",       "artgalleries"),
    ("comedy",    "comedymics"),
    ("concert",   "concertsshows"),
    ("symphony",  "concertsshows"),
]


def _categorize(title: str) -> str:
    t = title.lower()
    for kw, slug in CATEGORY_HINTS:
        if kw in t:
            return slug
    return "festivals"


def _fetch_html(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "austin.chat-events-bot/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", errors="replace")


_DATE_RE = re.compile(
    r"(?P<m1>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+"
    r"(?P<d1>\d{1,2})(?:\s*[-–]\s*(?:(?P<m2>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+)?(?P<d2>\d{1,2}))?"
    r",\s*(?P<y>20\d{2})",
)

_MONTHS = {"Jan":1,"Feb":2,"Mar":3,"Apr":4,"May":5,"Jun":6,"Jul":7,"Aug":8,"Sep":9,"Oct":10,"Nov":11,"Dec":12}


def _parse_session(date_text: str) -> Session | None:
    """Return a single Session spanning the published date range.

    Times default to 09:00-23:00 since Palmer's listings don't always
    publish hours. Event-detail pages would have them but that's a
    second fetch per event; deferred to v2.
    """
    m = _DATE_RE.search(date_text)
    if not m:
        return None
    g = m.groupdict()
    y = int(g["y"])
    m1 = _MONTHS[g["m1"][:3]]
    d1 = int(g["d1"])
    if g["d2"]:
        m2 = _MONTHS[(g["m2"] or g["m1"])[:3]]
        d2 = int(g["d2"])
    else:
        m2, d2 = m1, d1
    start = datetime(y, m1, d1, 9, 0)
    end   = datetime(y, m2, d2, 23, 0)
    if end < start:
        end = start + timedelta(hours=12)
    return Session(
        start=start.strftime("%Y-%m-%dT%H:%M"),
        end=end.strftime("%Y-%m-%dT%H:%M"),
    )


def _extract_events_from_html(html: str) -> list[tuple[str, str, str]]:
    """Return [(title, date_text, detail_url), …] from the Palmer page.

    Palmer renders each event as a card; we use a generous regex that
    pulls anchor+heading+date triples. If the site refactors, the parse
    falls back to an empty list rather than crashing.
    """
    # The site has been observed to use markup like:
    #   <a href="/event/<slug>"><h3>Title</h3></a>
    #   <p class="date">Apr 25, 2026 - Apr 26, 2026</p>
    # ... but the exact tags shift. We pull all <h3>+nearby-date pairs.
    out: list[tuple[str, str, str]] = []
    rows = re.findall(
        r'<a[^>]+href="(?P<href>/[^"]+)"[^>]*>\s*<h3[^>]*>(?P<title>[^<]+)</h3>',
        html, re.IGNORECASE,
    )
    for href, title in rows:
        # Look for a date line near the heading. Crude: search the next
        # 600 chars after the title's position in the document.
        idx = html.find(title)
        chunk = html[idx : idx + 600] if idx >= 0 else ""
        m = _DATE_RE.search(chunk)
        if not m:
            continue
        out.append((title.strip(), m.group(0), "https://www.palmereventscenter.com" + href))
    return out


def scrape() -> list[Event]:
    try:
        html = _fetch_html(URL)
    except Exception as e:
        print(f"  palmer: fetch failed: {e}")
        return []

    events: list[Event] = []
    for title, date_text, url in _extract_events_from_html(html):
        sess = _parse_session(date_text)
        if not sess:
            continue
        slug = _categorize(title)
        events.append(Event(
            title=title,
            subtitle=f"Palmer Events Center · {date_text}",
            category_slug=slug,
            venue_name="Palmer Events Center",
            sessions=[sess],
            source=SOURCE,
            source_id=url.rsplit("/", 1)[-1] or title.lower().replace(" ", "-"),
            source_url=url,
            description=f"Event at Palmer Events Center. See source for details, hours, and ticketing.",
            website="https://www.palmereventscenter.com",
        ))
    return events
