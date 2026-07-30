from __future__ import annotations

import hashlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET_ROOT = ROOT / "dataset"


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def main() -> None:
    updated = 0
    covered = 0
    for checksum_path in sorted(DATASET_ROOT.rglob("checksums.sha256")):
        folder = checksum_path.parent
        rows: list[str] = []
        for path in sorted(folder.rglob("*")):
            if not path.is_file() or path == checksum_path:
                continue
            relative = path.relative_to(folder)
            if "raw" in relative.parts or "__pycache__" in relative.parts or path.suffix == ".part":
                continue
            rows.append(f"{digest(path)}  {relative.as_posix()}")
        checksum_path.write_text("\n".join(rows) + "\n", encoding="utf-8")
        updated += 1
        covered += len(rows)
    print(f"checksum_manifests={updated} covered_files={covered}")


if __name__ == "__main__":
    main()
