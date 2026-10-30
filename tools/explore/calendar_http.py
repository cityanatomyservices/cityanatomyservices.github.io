"""Bounded retries for public calendars that sometimes return incomplete pages."""
import time
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def read_calendar(url, parse, fetch):
    """Validate the response before accepting it; never treat an error as zero events.

    Used only for the two WordPress calendars that intermittently return empty
    or non-calendar responses. Retry URLs refresh their public page caches;
    they do not bypass authentication or change the requested date range.
    """
    for attempt in range(3):
        request_url = url
        if attempt:
            time.sleep(2 * attempt)
            parts = urlsplit(url)
            query = parse_qsl(parts.query, keep_blank_values=True)
            query.append(('austinchat_refresh', f'{int(time.time())}-{attempt}'))
            request_url = urlunsplit(parts._replace(query=urlencode(query)))
        body = None
        try:
            body = fetch(request_url)
            result = parse(body)
            if attempt:
                print(f'{url}: recovered on attempt {attempt + 1}', flush=True)
            return result
        except (ValueError, URLError, TimeoutError, OSError) as error:
            # Do not retry permanent client errors, including access denials.
            if isinstance(error, HTTPError) and 400 <= error.code < 500 and error.code not in (408, 429):
                raise
            detail = str(error)
            if body is not None:
                text = body.decode('utf-8', errors='replace') if isinstance(body, bytes) else body
                kind = 'empty' if not text.strip() else 'HTML' if text.lstrip().startswith('<') else 'text/JSON'
                detail += f' ({len(body)} bytes, {kind} response)'
            if attempt == 2:
                raise ValueError(f'{url}: unavailable after 3 attempts: {detail}') from error
            print(f'{url}: attempt {attempt + 1} failed: {detail}; retrying', flush=True)
