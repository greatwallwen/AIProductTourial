from __future__ import annotations

import argparse
import hashlib
import json
import struct
from pathlib import Path


GLB_MAGIC = b"glTF"
JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def _gltf_document(with_uri: bool) -> dict:
    buffer = {"byteLength": 44}
    if with_uri:
        buffer["uri"] = "model.bin"
    return {
        "asset": {"version": "2.0", "generator": "Course_AIProduct deterministic triangle fixture"},
        "scene": 0,
        "scenes": [{"name": "FixtureScene", "nodes": [0]}],
        "nodes": [{"name": "FixtureTriangle", "mesh": 0}],
        "meshes": [{
            "name": "DeterministicTriangle",
            "primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "mode": 4}],
        }],
        "buffers": [buffer],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": 36, "target": 34962},
            {"buffer": 0, "byteOffset": 36, "byteLength": 6, "target": 34963},
        ],
        "accessors": [
            {
                "bufferView": 0, "byteOffset": 0, "componentType": 5126, "count": 3,
                "type": "VEC3", "min": [0.0, 0.0, 0.0], "max": [1.0, 1.0, 0.0],
            },
            {
                "bufferView": 1, "byteOffset": 0, "componentType": 5123, "count": 3,
                "type": "SCALAR", "min": [0], "max": [2],
            },
        ],
    }


def generate_fixture(output_dir: str | Path) -> dict:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    positions = struct.pack("<9f", 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0)
    indices = struct.pack("<3H", 0, 1, 2)
    binary = positions + indices + b"\x00\x00"
    (output / "model.bin").write_bytes(binary)
    (output / "model.gltf").write_text(
        json.dumps(_gltf_document(with_uri=True), separators=(",", ":")) + "\n", encoding="utf-8"
    )

    glb_json = json.dumps(_gltf_document(with_uri=False), separators=(",", ":")).encode("utf-8")
    glb_json += b" " * ((4 - len(glb_json) % 4) % 4)
    glb_binary = binary + b"\x00" * ((4 - len(binary) % 4) % 4)
    total_length = 12 + 8 + len(glb_json) + 8 + len(glb_binary)
    glb = (
        struct.pack("<4sII", GLB_MAGIC, 2, total_length)
        + struct.pack("<II", len(glb_json), JSON_CHUNK) + glb_json
        + struct.pack("<II", len(glb_binary), BIN_CHUNK) + glb_binary
    )
    (output / "model.glb").write_bytes(glb)

    files = {}
    for name in ("model.gltf", "model.bin", "model.glb"):
        data = (output / name).read_bytes()
        files[name] = {"sha256": hashlib.sha256(data).hexdigest(), "byte_length": len(data)}
    manifest = {
        "schema_version": 1,
        "fixture": "deterministic-triangle",
        "is_provider_output": False,
        "generator": "scripts/generate_minimal_fixture.py",
        "geometry": {"vertices": 3, "indices": 3, "triangles": 1, "bounds": {"min": [0, 0, 0], "max": [1, 1, 0]}},
        "files": files,
    }
    (output / "fixture-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a deterministic glTF 2.0 triangle fixture.")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    manifest = generate_fixture(args.output)
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
