from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "profile_csv.py"
SPEC = importlib.util.spec_from_file_location("profile_csv", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ProfileCsvTests(unittest.TestCase):
    def test_profile_and_markdown_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "case.csv"
            source.write_text(
                "observed_at,PM2.5,PM10,SO2,NO2,CO,O3,label\n"
                "2024-01-01 00:00:00,10,20,3,4,500,30,a\n"
                "2024-01-01 01:00:00,,21,NA,5,510,31,b\n",
                encoding="utf-8",
            )
            before = source.read_bytes()
            json_output = root / "out" / "profile.json"
            markdown_output = root / "out" / "profile.md"

            completed = subprocess.run(
                [
                    sys.executable,
                    "-B",
                    str(SCRIPT),
                    "--input",
                    str(source),
                    "--allowed-root",
                    str(root),
                    "--json-output",
                    str(json_output),
                    "--markdown-output",
                    str(markdown_output),
                ],
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            profile = json.loads(json_output.read_text(encoding="utf-8"))
            self.assertEqual(profile["rows"], 2)
            self.assertEqual(profile["column_count"], 8)
            self.assertEqual(profile["pollutants"]["PM2.5"]["missing_count"], 1)
            self.assertEqual(profile["pollutants"]["SO2"]["missing_rate"], 0.5)
            self.assertEqual(
                profile["date_ranges"]["observed_at"],
                {"min": "2024-01-01 00:00:00", "max": "2024-01-01 01:00:00"},
            )
            self.assertIn("六项污染物缺失", markdown_output.read_text(encoding="utf-8"))
            self.assertEqual(source.read_bytes(), before)

    def test_blocks_input_outside_allowed_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            allowed = base / "allowed"
            allowed.mkdir()
            source = base / "outside.csv"
            source.write_text("x\n1\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "input_outside_allowed_root"):
                MODULE.profile_file(source, allowed)

    def test_reports_missing_pollutant_fields(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "case.csv"
            source.write_text("observed_at,PM2.5\n2024-01-01,1\n", encoding="utf-8")
            profile = MODULE.profile_file(source, root)
            self.assertTrue(profile["warnings"][0].startswith("missing_pollutant_fields:"))


if __name__ == "__main__":
    unittest.main()
