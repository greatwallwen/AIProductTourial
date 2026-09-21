from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[4]
SCRIPT = ROOT / "code/labs/three-map-comparison/build_s11_comparison.py"
CHINA = ROOT / "assets/S11/data/china.json"
ZHEJIANG = ROOT / "assets/S11/data/zhejiang.json"
THREE = ROOT / "code/node_modules/three/build/three.module.js"
IMAGE = ROOT / "assets/S11/A-css-fake/assets/china-topographic-map.jpg"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


class S11ComparisonTests(unittest.TestCase):
    def test_geojson_inputs_have_real_expected_levels(self) -> None:
        china = json.loads(CHINA.read_text(encoding="utf-8"))
        zhejiang = json.loads(ZHEJIANG.read_text(encoding="utf-8"))

        self.assertEqual(len(china["features"]), 35)
        self.assertIn("330000", {str(item["properties"]["adcode"]) for item in china["features"]})
        self.assertEqual(len(zhejiang["features"]), 11)
        self.assertIn("330100", {str(item["properties"]["adcode"]) for item in zhejiang["features"]})

    def test_builder_creates_honest_a_b_comparison_and_receipt(self) -> None:
        china_before = sha256(CHINA)
        zhejiang_before = sha256(ZHEJIANG)
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "S11"
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--china",
                    str(CHINA),
                    "--zhejiang",
                    str(ZHEJIANG),
                    "--three-module",
                    str(THREE),
                    "--image",
                    str(IMAGE),
                    "--output-dir",
                    str(output),
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr or result.stdout)

            fake = (output / "A-css-fake/index.html").read_text(encoding="utf-8")
            basic = (output / "B-three/index.html").read_text(encoding="utf-8")
            index = (output / "index.html").read_text(encoding="utf-8")
            receipt = json.loads((output / "receipt.json").read_text(encoding="utf-8"))

            self.assertNotIn("<canvas", fake)
            self.assertIn("rotateX", fake)
            self.assertIn("china-topographic-map.jpg", fake)
            self.assertIn("new THREE.WebGLRenderer", basic)
            self.assertIn("THREE.ExtrudeGeometry", basic)
            self.assertIn("Raycaster", basic)
            self.assertIn("pointermove", basic)
            self.assertIn("330000", basic)
            self.assertIn("zhejiang.json", basic)
            self.assertIn("返回全国", basic)
            self.assertIn("A · CSS 伪 3D", index)
            self.assertIn("B · 手写 Three.js", index)
            self.assertIn("C · GitHub Skill", index)
            self.assertTrue((output / "vendor/three.core.js").is_file())
            self.assertEqual(receipt["data"]["china"]["feature_count"], 35)
            self.assertEqual(receipt["data"]["zhejiang"]["feature_count"], 11)
            self.assertEqual(receipt["claims"]["a_is_webgl"], False)
            self.assertEqual(receipt["claims"]["b_is_webgl"], True)
            self.assertEqual(receipt["claims"]["c_generated"], False)
            self.assertEqual(receipt["skill"]["commit"], "605867c0dc7f3a3b3ce601e76a695e4d9fe7a943")
            self.assertEqual(receipt["skill"]["license"], "GPL-3.0-or-later")
            self.assertEqual(sha256(CHINA), china_before)
            self.assertEqual(sha256(ZHEJIANG), zhejiang_before)

            prompts = sorted(path.name for path in (output / "prompts").glob("*.txt"))
            self.assertEqual(prompts, ["A-css-fake.txt", "B-ordinary-three.txt", "C-three-scope-map-skill.txt"])

    def test_rejects_non_geojson_or_missing_three_module(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp = Path(temp_dir)
            invalid = temp / "invalid.json"
            invalid.write_text('{"type":"FeatureCollection","features":[]}', encoding="utf-8")
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--china",
                    str(invalid),
                    "--zhejiang",
                    str(ZHEJIANG),
                    "--three-module",
                    str(temp / "missing.js"),
                    "--image",
                    str(IMAGE),
                    "--output-dir",
                    str(temp / "output"),
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 2)
            self.assertIn("blocked", result.stdout)

    def test_rebuild_in_existing_output_preserves_data(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "S11"
            data_dir = output / "data"
            data_dir.mkdir(parents=True)
            shutil.copy2(CHINA, data_dir / "china.json")
            shutil.copy2(ZHEJIANG, data_dir / "zhejiang.json")
            before = (sha256(data_dir / "china.json"), sha256(data_dir / "zhejiang.json"))
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--china",
                    str(data_dir / "china.json"),
                    "--zhejiang",
                    str(data_dir / "zhejiang.json"),
                    "--three-module",
                    str(THREE),
                    "--image",
                    str(IMAGE),
                    "--output-dir",
                    str(output),
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
            self.assertEqual((sha256(data_dir / "china.json"), sha256(data_dir / "zhejiang.json")), before)

    def test_existing_c_production_build_enables_skill_entry(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            output = Path(temp_dir) / "S11"
            c_dist = output / "C-skill/dist"
            c_dist.mkdir(parents=True)
            (c_dist / "index.html").write_text("<!doctype html><title>C</title>", encoding="utf-8")
            result = subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--china",
                    str(CHINA),
                    "--zhejiang",
                    str(ZHEJIANG),
                    "--three-module",
                    str(THREE),
                    "--image",
                    str(IMAGE),
                    "--output-dir",
                    str(output),
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr or result.stdout)
            index = (output / "index.html").read_text(encoding="utf-8")
            receipt = json.loads((output / "receipt.json").read_text(encoding="utf-8"))
            self.assertIn('href="C-skill/dist/index.html"', index)
            self.assertNotIn('aria-disabled="true"', index)
            self.assertEqual(receipt["claims"]["c_generated"], True)


if __name__ == "__main__":
    unittest.main()
