"""Live-value fetchers for the daily feed.

Each module here is named after a `fetch.type` in staging/sources.json and
exposes one function:

    def fetch(config: dict) -> list[dict]:
        '''Return a list of feed-item field dicts (headline / link / detail /
        source / published / ...). The builder stamps lane / label / icon /
        priority / id from the topic when a field is absent.

        Raise on failure (or return []) — build_feed.py catches it and falls
        back to the topic's curated links, so a dead feed never blanks a card.
        '''

Adding a live value to a topic = drop one module here and point the topic's
`fetch.type` at it with `"enabled": true`. Keep fetchers stdlib-only.
"""
