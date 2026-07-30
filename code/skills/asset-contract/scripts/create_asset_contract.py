from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


def load_request(path: str | Path) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8-sig") as handle:
        request = json.load(handle)
    if not isinstance(request, dict):
        raise ValueError("request_must_be_object")
    required = (
        "id", "prompt", "usage", "format", "unit", "up_axis",
        "max_triangles", "max_file_size_bytes", "provider",
    )
    missing = [field for field in required if field not in request]
    if missing:
        raise ValueError("missing_fields:" + ",".join(missing))
    if not re.fullmatch(r"[a-z0-9-]+", str(request["id"])):
        raise ValueError("invalid_id")
    if request["format"] not in ("glb", "gltf"):
        raise ValueError("unsupported_format")
    if request["unit"] not in ("meter", "centimeter", "millimeter"):
        raise ValueError("unsupported_unit")
    if request["up_axis"] not in ("Y", "Z"):
        raise ValueError("unsupported_up_axis")
    provider = request["provider"]
    if not isinstance(provider, dict):
        raise ValueError("provider_must_be_object")
    if provider.get("generation_attempted") is not False:
        raise ValueError("provider_attempt_must_be_false_without_receipt")
    return request


def create_contract(request: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "status": "local-contract-ready",
        "request": {
            key: request[key]
            for key in ("id", "prompt", "usage", "format", "unit", "up_axis", "max_triangles", "max_file_size_bytes")
        },
        "provider_generation": {
            "provider": request["provider"].get("name"),
            "status": "blocked-not-verified",
            "attempted": False,
            "receipt": None,
            "artifact_url": None,
            "reason": "缺少已授权凭据、真实 Provider 回执和本轮下载资产。",
        },
        "local_fixture": {
            "path": "examples/minimal-triangle/model.glb",
            "purpose": "glTF/GLB 检查器和 Three.js 查看器的确定性管线验证",
            "is_provider_output": False,
        },
        "acceptance": [
            "asset_version_is_gltf_2_0",
            "all_buffers_are_local_and_in_bounds",
            "mesh_and_accessor_references_are_valid",
            "triangle_and_file_size_budgets_pass",
            "viewer_build_loads_the_inspected_sha256",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Create an honest text-to-3D asset contract.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        contract = create_contract(load_request(args.input))
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}, ensure_ascii=False))
        return 2
    print(json.dumps({"status": contract["status"], "provider_generation": contract["provider_generation"]}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
