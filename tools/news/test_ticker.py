import importlib.util
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('ticker', Path(__file__).with_name('build-ticker.py'))
ticker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ticker)


class TickerTests(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 28, 22, tzinfo=timezone.utc)

    def feed(self, items):
        return ('<rss><channel>' + ''.join(items) + '</channel></rss>').encode()

    def item(self, title='A headline', url='https://example.com/a', day='Wed, 28 Oct 2026 20:00:00 +0000', tags=''):
        return f'<item><title>{title}</title><link>{url}</link><pubDate>{day}</pubDate>{tags}</item>'

    def test_titles_are_plain_and_dated(self):
        found = ticker.rss(self.feed([self.item('Austin &amp; &lt;b&gt;news&lt;/b&gt;')]), 'News', 'headlines', self.now)
        self.assertEqual(found[0]['title'], 'Austin & news')
        self.assertEqual(ticker.date(found[0]['expires']) - ticker.date(found[0]['published']), timedelta(days=7))

    def test_missing_old_future_dates_and_unsafe_links_are_omitted(self):
        data = self.feed([self.item(day=''), self.item(day='Thu, 01 Oct 2026 20:00:00 GMT'),
                          self.item(day='Thu, 29 Oct 2026 20:00:00 GMT'), self.item(url='javascript:alert(1)')])
        self.assertEqual(ticker.rss(data, 'News', 'headlines', self.now), [])

    def test_error_page_is_a_failure_not_empty_success(self):
        with self.assertRaises(ValueError):
            ticker.rss(b'<html><body>Temporarily unavailable</body></html>', 'News', 'headlines', self.now)

    def test_promotions_excluded_and_chronicle_news_not_repeated_as_culture(self):
        data = self.feed([self.item(tags='<category>Contests</category>'),
                          self.item(tags='<category>Sponsored Content</category>'),
                          self.item(tags='<category>News</category>'),
                          self.item(title='Austin film premiere', tags='<category>Screens</category>')])
        found = ticker.rss(data, 'Austin Chronicle culture', 'culture', self.now)
        self.assertEqual([i['title'] for i in found], ['Austin film premiere'])

    def test_national_requires_local_and_federal_relevance(self):
        data = self.feed([self.item('Congress debates spending'), self.item('Austin festival opens'),
                          self.item('Federal funding for Austin transit')])
        found = ticker.rss(data, 'Texas Tribune', 'national', self.now)
        self.assertEqual([i['title'] for i in found], ['Federal funding for Austin transit'])

    def test_partial_failure_retains_only_own_unexpired_items_with_publisher(self):
        with tempfile.TemporaryDirectory() as directory:
            out = Path(directory) / 'feed.json'
            future = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
            out.write_text(json.dumps({'items': [
                {'title':'Keep', 'source':'Failed', 'category':'headlines','url':'https://example.com/keep','expires':future},
                {'title':'Drop', 'source':'Failed', 'category':'headlines','url':'https://example.com/old','expires':'2020-01-01T00:00:00Z'},
                {'title':'Removed source', 'source':'Removed', 'category':'headlines','url':'https://example.com/removed','expires':future},
            ]}))
            feeds = [('Failed','chronicle','headlines','https://example.com/fail'),('Works','kut','headlines','https://example.com/works')]
            def fetch(url):
                if url.endswith('fail'):
                    raise OSError('Unavailable')
                return self.feed([])
            with patch.object(ticker,'OUT',out), patch.object(ticker,'FEEDS',feeds), patch.object(ticker,'fetch',fetch):
                ticker.build()
                result=json.loads(out.read_text())
                self.assertEqual([i['title'] for i in result['items']],['Keep'])
                self.assertEqual(result['items'][0]['publisher'],'chronicle')
                self.assertEqual(result['items'][0]['expires'],future)
                before=out.read_text()
                with patch.object(ticker,'fetch',side_effect=OSError('All unavailable')):
                    with self.assertRaises(RuntimeError):
                        ticker.build()
                self.assertEqual(out.read_text(),before)


if __name__ == '__main__':
    unittest.main()
