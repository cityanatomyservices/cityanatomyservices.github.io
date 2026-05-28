"""Alerts lane — active NWS alerts for the Austin point (no API key).

Empty on most days; that's expected. Severe/extreme alerts sort ahead
of everything else via a low priority number.
"""

from __future__ import annotations

from tools.austin_feed.common import FeedItem, get_json

LAT, LNG = 30.2672, -97.7431

# NWS severity → numeric (lower = more urgent = earlier in the ticker).
SEVERITY_RANK = {
    "Extreme": 0,
    "Severe": 1,
    "Moderate": 2,
    "Minor": 3,
    "Unknown": 4,
}


def scrape() -> list[FeedItem]:
    data = get_json(f"https://api.weather.gov/alerts/active?point={LAT},{LNG}")
    items: list[FeedItem] = []
    for feat in data.get("features", []):
        p = feat.get("properties") or {}
        event = p.get("event") or "Weather Alert"
        sev = p.get("severity") or "Unknown"
        rank = SEVERITY_RANK.get(sev, 4)
        headline = p.get("headline") or event
        # Headlines can be long; trim to ticker size.
        if len(headline) > 110:
            headline = headline[:107] + "…"
        items.append(FeedItem(
            id="alert-" + (p.get("id") or event).split("/")[-1][:40],
            lane="alerts",
            headline=headline,
            link=p.get("@id") or "https://www.weather.gov/ewx/",
            detail=(p.get("description") or "")[:280],
            severity=rank,
            priority=rank,                 # 0–4, ahead of every other lane
            published=p.get("sent") or "",
            expires=p.get("expires") or p.get("ends") or "",
        ))
    return items
