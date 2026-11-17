"""Bounded retries for public calendars that sometimes return incomplete pages."""
import time
import re
from html import unescape
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


def read_calendar(url, parse, fetch, *, refresh_query=True):
    """Validate the response before accepting it; never treat an error as zero events.

    Used only for public calendar pages that intermittently return empty
    or non-calendar responses. Retry URLs refresh their public page caches;
    they do not bypass authentication or change the requested date range.
    """
    for attempt in range(3):
        request_url = url
        if attempt:
            time.sleep(2 * attempt)
            if refresh_query:
                parts = urlsplit(url)
                query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
                         if k != 'austinchat_refresh']
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
                # Tiny error pages can return HTTP 200. Their public visible
                # text distinguishes an outage from a schema or access error.
                # Never dump full source pages into logs.
                if kind == 'HTML' and len(body) < 1500:
                    visible = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', '', text, flags=re.I | re.S)
                    visible = unescape(re.sub(r'<[^>]*>', ' ', visible))
                    visible = re.sub(r'\s+', ' ', visible).strip()[:250]
                    if visible:
                        detail += ': ' + visible
                    else:
                        # Script/meta-only responses have no visible text.
                        # Include only the short public markup, with token-like
                        # query values redacted, to identify redirects/challenges.
                        markup = re.sub(r'([?&](?:token|key|nonce|signature|__cf[^=]*)=)[^&\s"\'<>]+',
                                        r'\1[redacted]', text, flags=re.I)
                        detail += ': markup ' + re.sub(r'\s+', ' ', markup).strip()[:400]
            if attempt == 2:
                raise ValueError(f'{url}: unavailable after 3 attempts: {detail}') from error
            print(f'{url}: attempt {attempt + 1} failed: {detail}; retrying', flush=True)
