"""Weather lane — National Weather Service (no API key).

Flow: /points/<lat,lng> returns a forecast URL; that forecast returns
12-hour periods. We surface the current/next period as one headline.
"""

from __future__ import annotations

from tools.austin_feed.common import FeedItem, get_json, now_utc_iso

# Downtown Austin. NWS rounds to its grid; this resolves to the EWX office.
LAT, LNG = 30.2672, -97.7431
FORECAST_LINK = f"https://forecast.weather.gov/MapClick.php?lat={LAT}&lon={LNG}"


def scrape() -> list[FeedItem]:
    points = get_json(f"https://api.weather.gov/points/{LAT},{LNG}")
    forecast_url = points["properties"]["forecast"]
    fc = get_json(forecast_url)
    periods = fc["properties"]["periods"]
    if not periods:
        return []
    p = periods[0]
    headline = f"{p['name']}: {p['shortForecast']}, {p['temperature']}°{p['temperatureUnit']}"
    detail_bits = [p.get("detailedForecast", "")]
    if len(periods) > 1:
        n = periods[1]
        detail_bits.append(f"{n['name']}: {n['shortForecast']}, {n['temperature']}°{n['temperatureUnit']}.")
    return [FeedItem(
        id="weather-now",
        lane="weather",
        headline=headline,
        link=FORECAST_LINK,
        detail=" ".join(b for b in detail_bits if b),
        published=now_utc_iso(),
    )]
