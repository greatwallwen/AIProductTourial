import copy
import json
import unittest
from pathlib import Path

from extract_tide_14day import parse_source_title, recover, validate


ROOT = Path(__file__).resolve().parent


class FourteenDayExtractionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pdf = ROOT / 'source-14day-browser-print.pdf'
        cls.document, cls.audit = recover(cls.pdf)

    def test_complete_verified_14_day_source(self):
        self.assertEqual(self.audit['count'], 3360)
        self.assertEqual(self.audit['days'], 14)
        self.assertEqual(self.audit['start'], '2025-04-01 00:00')
        self.assertEqual(self.audit['end'], '2025-04-14 23:54')
        self.assertEqual(self.audit['pdf_sha256'], '7263feafed630b808a2e52d3e404ea680549653f96693cbaba95cac46a8813f3')
        self.assertEqual(self.document['data'][:480], json.loads((ROOT / 'recovered-from-pdf.json').read_text())['data'])

    def test_source_title_is_the_requested_station_and_period(self):
        self.assertEqual(parse_source_title(self.audit['request_url'])['end_date'], '20250414')
        with self.assertRaisesRegex(ValueError, 'query'):
            parse_source_title(self.audit['request_url'].replace('station=9414290', 'station=0000000'))

    def test_rejects_missing_observation_and_false_quality(self):
        changed = copy.deepcopy(self.document)
        changed['data'].pop(120)
        with self.assertRaisesRegex(ValueError, 'count'):
            validate(changed)
        changed = copy.deepcopy(self.document)
        changed['data'][120]['q'] = 'p'
        with self.assertRaisesRegex(ValueError, 'quality'):
            validate(changed)

    def test_rejects_wrong_timestamp_even_when_count_matches(self):
        changed = copy.deepcopy(self.document)
        changed['data'][120]['t'] = changed['data'][121]['t']
        with self.assertRaisesRegex(ValueError, 'interval'):
            validate(changed)


if __name__ == '__main__':
    unittest.main()
