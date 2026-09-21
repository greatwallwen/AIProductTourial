import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("asset_verifier", Path(__file__).parents[1] / "verify_agent_skill_runtime.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ReceiptPaths(unittest.TestCase):
    def test_receipts_do_not_hash_themselves(self):
        with tempfile.TemporaryDirectory(dir=module.ROOT) as directory:
            folder = Path(directory)
            for name in ["receipt.json", "runtime-receipt.json", "result.json"]:
                (folder / name).write_text("{}", encoding="utf-8")
            rows = module.artifact_rows(folder)
            self.assertEqual([Path(row["path"]).name for row in rows], ["result.json"])

    def test_report_has_separate_location(self):
        self.assertEqual(module.REPORT_JSON.parent, module.ROOT / "assets" / "skill-results")
