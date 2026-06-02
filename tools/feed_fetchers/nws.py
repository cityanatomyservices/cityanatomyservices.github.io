"""National Weather Service fetcher (no API key) — reference example.

config (in a topic's "fetch" block):
    { "type": "nws", "enabled": true, "lat": 30.2672, "lon": -97.7431 }

Flow: /points/<lat,lon> returns a forecast URL; that forecast returns 12-hour
periods. We surface the current/next period as one headline. Raises on any
failure, so the builder falls back to the topic's curated forecast link.

Shipped disabled (`"enabled": false` in sources.json) so a curated-only launch
needs no network — flip it on when you want the live value in the card.
"""

from __future__ import annotations

from tools.feed_lib import get_json, now_utc_iso


def fetch(config: dict) -> list[dict]:
    lat = config.get("lat", 30.2672)
    lon = config.get("lon", -97.7431)
    points = get_json(f"https://api.weather.gov/points/{lat},{lon}")
    fc = get_json(points["properties"]["forecast"])
    periods = fc["properties"]["periods"]
    if not periods:
        return []
    p = periods[0]
    headline = f"{p['name']}: {p['shortForecast']}, {p['temperature']}°{p['temperatureUnit']}"
    detail_bits = [p.get("detailedForecast", "")]
    if len(periods) > 1:
        n = periods[1]
        detail_bits.append(f"{n['name']}: {n['shortForecast']}, {n['temperature']}°{n['temperatureUnit']}.")
    return [{
        "headline": headline,
        "link": f"https://forecast.weather.gov/MapClick.php?lat={lat}&lon={lon}",
        "detail": " ".join(b for b in detail_bits if b),
        "published": now_utc_iso(),
    }]
