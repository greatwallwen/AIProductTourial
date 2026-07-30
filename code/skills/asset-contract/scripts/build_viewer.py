from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path


TEMPLATE_ROOT = Path(__file__).resolve().parents[1] / "assets" / "viewer-template"


def _inside(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def build_viewer(
    model_path: str | Path,
    allowed_model_root: str | Path,
    output_path: str | Path,
    allowed_output_root: str | Path,
) -> dict:
    model_root = Path(allowed_model_root).resolve()
    model = Path(model_path).resolve()
    output_root = Path(allowed_output_root).resolve()
    output = Path(output_path).resolve()
    if not _inside(model, model_root):
        raise ValueError("model_outside_allowed_root")
    if not _inside(output, output_root):
        raise ValueError("output_outside_allowed_root")
    if model.suffix.lower() != ".glb" or not model.is_file():
        raise ValueError("viewer_model_must_be_local_glb")

    output.mkdir(parents=True, exist_ok=True)
    shutil.copytree(TEMPLATE_ROOT, output, dirs_exist_ok=True)
    public = output / "public"
    public.mkdir(parents=True, exist_ok=True)
    copied = public / "model.glb"
    shutil.copyfile(model, copied)
    digest = hashlib.sha256(copied.read_bytes()).hexdigest()
    contract = {
        "schema_version": 1,
        "status": "local-viewer-ready",
        "asset": {"path": "public/model.glb", "sha256": digest, "is_provider_output": False},
        "provider_generation_status": "blocked-not-verified",
        "entry": "index.html",
        "runtime": {"three": "0.178.0", "vite": "8.1.5"},
    }
    (output / "viewer-contract.json").write_text(
        json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return contract


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a local Three.js viewer project from an inspected GLB.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--allowed-model-root", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--allowed-output-root", required=True)
    args = parser.parse_args()
    try:
        contract = build_viewer(args.model, args.allowed_model_root, args.output, args.allowed_output_root)
    except (OSError, ValueError) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}, ensure_ascii=False))
        return 2
    print(json.dumps(contract, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
