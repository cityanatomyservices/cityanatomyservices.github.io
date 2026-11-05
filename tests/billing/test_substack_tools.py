import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools/billing'))
spec = importlib.util.spec_from_file_location('substack_tools', ROOT / 'tools/billing/substack-members.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PrivateTools(unittest.TestCase):
    def test_reports_cannot_be_written_in_source_or_another_git_repository(self):
        with self.assertRaises(ValueError):
            module.report_path(str(ROOT / 'members.csv'))
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / '.git').mkdir()
            with self.assertRaises(ValueError):
                module.report_path(str(root / 'exports/members.csv'))

    def test_report_refuses_overwrite_and_protects_spreadsheet_formulas(self):
        with tempfile.TemporaryDirectory() as temp:
            target = module.report_path(str(Path(temp) / 'members.csv'))
            module.write_report(target, [{'site_email': '=danger@example.invalid', 'site_paid_active': True}])
            text = target.read_text(encoding='utf-8-sig')
            self.assertIn("'=danger@example.invalid", text)
            with self.assertRaises(ValueError):
                module.report_path(str(target))
            with self.assertRaises(FileExistsError):
                module.write_report(target, [])

    def test_dates_require_verified_future_timestamp_and_timezone(self):
        for invalid in ['tomorrow', '2026-01-01', '2020-01-01T00:00:00Z', '2099-01-01T12:00:00']:
            with self.assertRaises(ValueError):
                module.paid_through(invalid)
        future = datetime.now(timezone.utc) + timedelta(days=30)
        self.assertEqual(module.paid_through(future.isoformat()), future.isoformat())

    def test_email_literal_quotes_cannot_escape_sql(self):
        self.assertEqual(module.literal("o'brien@example.invalid"), "'o''brien@example.invalid'")


if __name__ == '__main__':
    unittest.main()
