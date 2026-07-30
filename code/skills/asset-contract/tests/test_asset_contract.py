from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = SKILL_ROOT / "examples"


def load_module(name: str, script: str):
    spec = importlib.util.spec_from_file_location(name, SKILL_ROOT / "scripts" / script)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


CONTRACT = load_module("create_asset_contract", "create_asset_contract.py")
INSPECTOR = load_module("inspect_gltf", "inspect_gltf.py")


class AssetContractTests(unittest.TestCase):
    def test_provider_remains_blocked_without_receipt(self) -> None:
        request = CONTRACT.load_request(EXAMPLES / "triangle.request.json")
        contract = CONTRACT.create_contract(request)
        provider = contract["provider_generation"]
        self.assertEqual(provider["status"], "blocked-not-verified")
        self.assertFalse(provider["attempted"])
        self.assertIsNone(provider["receipt"])
        self.assertFalse(contract["local_fixture"]["is_provider_output"])

    def test_gltf_fixture_passes_with_local_buffer(self) -> None:
        result = INSPECTOR.inspect_asset(EXAMPLES / "minimal-triangle" / "model.gltf", EXAMPLES)
        self.assertEqual(result["status"], "passed")
        self.assertEqual(result["external_buffers"], ["model.bin"])
        self.assertEqual((result["vertices"], result["indices"]), (3, 3))

    def test_glb_fixture_passes_and_matches_bounds(self) -> None:
        result = INSPECTOR.inspect_asset(EXAMPLES / "minimal-triangle" / "model.glb", EXAMPLES)
        self.assertEqual(result["format"], "glb")
        self.assertEqual(result["meshes"], 1)
        self.assertEqual(result["primitives"], 1)
        self.assertEqual(result["bounds"], {"min": [0.0, 0.0, 0.0], "max": [1.0, 1.0, 0.0]})

    def test_truncated_glb_is_rejected(self) -> None:
        temp_root = SKILL_ROOT / ".tmp"
        temp_root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temp_root) as directory:
            broken = Path(directory) / "broken.glb"
            broken.write_bytes(b"glTF\x02\x00\x00\x00")
            with self.assertRaisesRegex(ValueError, "glb_too_short"):
                INSPECTOR.inspect_asset(broken, temp_root)

    def test_viewer_contract_uses_same_glb_hash(self) -> None:
        viewer = json.loads((EXAMPLES / "three-viewer" / "viewer-contract.json").read_text(encoding="utf-8"))
        inspected = INSPECTOR.inspect_asset(EXAMPLES / "three-viewer" / "public" / "model.glb", EXAMPLES)
        self.assertEqual(viewer["asset"]["sha256"], inspected["sha256"])
        self.assertEqual(viewer["provider_generation_status"], "blocked-not-verified")


if __name__ == "__main__":
    unittest.main()
