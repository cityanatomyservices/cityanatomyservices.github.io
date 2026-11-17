"""Manual read-only diagnostics for the two intermittently invalid calendars."""
from datetime import datetime, timedelta, timezone
import json
import re
import ssl
import sys
from urllib.parse import urlencode
from urllib.request import Request, urlopen

now = datetime.now(timezone.utc).date()
print(json.dumps(dict(python=sys.version, tls=ssl.OPENSSL_VERSION)), flush=True)
urls = [
    'https://falloutcomedy.com/comedy-shows/',
    'https://thesaxonpub.com/wp-json/tribe/events/v1/events?' + urlencode(dict(
        start_date=now-timedelta(days=1), end_date=now+timedelta(days=14), per_page=100)),
]
for url in urls:
    try:
        request = Request(url, headers={'User-Agent': 'AustinChatExplore/1.0 (+https://austin.chat/contact/)'})
        with urlopen(request, timeout=45) as response:
            body = response.read(5_000_001)
            result = dict(url=url, status=response.status, contentType=response.headers.get('Content-Type'), bytes=len(body))
        if len(body) < 1500:
            text = body.decode('utf-8', errors='replace')
            result['shortResponse'] = re.sub(r'([?&](?:token|key|nonce|signature|__cf[^=]*)=)[^&\s"\'<>]+',
                                            r'\1[redacted]', text, flags=re.I)
        print(json.dumps(result, ensure_ascii=True), flush=True)
    except Exception as error:
        print(json.dumps(dict(url=url, error=str(error))), flush=True)
