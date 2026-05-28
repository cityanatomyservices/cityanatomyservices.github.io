"""Local sports lane — TheSportsDB free tier (no key signup; test key).

Best-effort: resolves each team by name, then asks for its next event.
Several TheSportsDB endpoints are premium-gated, so this fails soft and
simply contributes nothing if the free tier doesn't return data. Swap in
your preferred source / team IDs here if you want guaranteed coverage.
"""

from __future__ import annotations

import urllib.parse

from tools.austin_feed.common import FeedItem, get_json

# TheSportsDB public test key. Replace with a real key for reliability.
KEY = "3"
TEAMS = ["Austin FC", "Texas Longhorns", "Round Rock Express", "Texas Stars"]


def _next_event_for(team: str):
    base = f"https://www.thesportsdb.com/api/v1/json/{KEY}"
    q = urllib.parse.quote(team)
    search = get_json(f"{base}/searchteams.php?t={q}")
    teams = (search or {}).get("teams") or []
    if not teams:
        return None
    tid = teams[0].get("idTeam")
    if not tid:
        return None
    nxt = get_json(f"{base}/eventsnext.php?id={tid}")
    events = (nxt or {}).get("events") or []
    return events[0] if events else None


def scrape() -> list[FeedItem]:
    items: list[FeedItem] = []
    for team in TEAMS:
        try:
            ev = _next_event_for(team)
        except Exception as e:
            print(f"  sports: {team} skipped ({e})")
            continue
        if not ev:
            continue
        name = ev.get("strEvent") or f"{team} game"
        date = ev.get("dateEvent") or ""
        time = (ev.get("strTime") or "")[:5]
        when = (date + (" " + time if time else "")).strip()
        items.append(FeedItem(
            id=f"sports-{ev.get('idEvent', team)}",
            lane="sports",
            headline=f"{name}" + (f"  ·  {when}" if when else ""),
            link=ev.get("strVideo") or "https://www.thesportsdb.com/",
            published=date,
        ))
    return items
