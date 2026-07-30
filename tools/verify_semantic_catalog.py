from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPECTED = {
    "prompt_labs": [f"P{index:03d}" for index in range(1, 9)],
    "agent_skill_cases": [f"S{index:03d}" for index in range(1, 10)],
    "loop_cases": [f"L{index:03d}" for index in range(1, 4)],
    "business_cases": [f"B{index:03d}" for index in range(1, 25)],
}
EXPECTED_TEACHING = {
    "prompt_units": ["P001", "P002", "P003", "P005", "P006", "P008"],
    "agent_skill_workshops": [f"S{index:03d}" for index in range(1, 10)],
    "loop_patterns": [f"L{index:03d}" for index in range(1, 5)],
    "business_cases": [f"B{index:03d}" for index in range(1, 25)],
}


def fail(message: str) -> None:
    print(f"[FAIL] {message}", file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read {path.relative_to(ROOT)}: {exc}")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    manifest = load_json(ROOT / "course-manifest.json")
    if manifest.get("capability_spine") != EXPECTED:
        fail("course-manifest capability_spine does not match the frozen P/S/L/B matrix")
    if manifest.get("teaching_spine") != EXPECTED_TEACHING:
        fail("course-manifest teaching_spine does not match the U/S/L/B course structure")

    expected_labs = EXPECTED["prompt_labs"] + EXPECTED["agent_skill_cases"] + EXPECTED["loop_cases"]
    manifest_labs = manifest.get("labs", [])
    if [item.get("id") for item in manifest_labs] != expected_labs:
        fail("course-manifest labs do not match the active semantic lab registry")
    for item in manifest_labs:
        code_path = ROOT / item.get("code_path", "")
        if not code_path.is_dir():
            fail(f"{item['id']} missing code_path: {item.get('code_path')}")
        dataset_path = item.get("dataset_path")
        if dataset_path is not None and not (ROOT / dataset_path).is_dir():
            fail(f"{item['id']} missing dataset_path: {dataset_path}")
        if dataset_path is None and item.get("delivery") != "react_component_skill":
            fail(f"{item['id']} omits a dataset without a component-only delivery contract")
        if item["id"] in EXPECTED["prompt_labs"]:
            if item.get("delivery") != "prompt_instructor_chapter" or item.get("route"):
                fail(f"{item['id']} must be a route-free CLI instructor chapter")

    cases = manifest.get("cases", [])
    runtime_ids = EXPECTED["business_cases"]
    if [item.get("id") for item in cases] != runtime_ids:
        fail("manifest business case ids are not exactly B001-B024")
    for teaching_id, item in zip(EXPECTED["business_cases"], cases, strict=True):
        if item.get("route") != f"/cases/{teaching_id}":
            fail(f"{item.get('id')} public route is not /cases/{teaching_id}")
        code_path = ROOT / item.get("code_path", "")
        if not code_path.is_dir():
            fail(f"{teaching_id} missing code directory: {code_path.relative_to(ROOT)}")

    for chapter in manifest.get("chapters", []):
        invalid = [case_id for case_id in chapter.get("case_ids", []) if case_id not in EXPECTED["business_cases"]]
        if invalid:
            fail(f"{chapter.get('id')} uses non-teaching case ids: {invalid}")

    dataset_manifest = load_json(ROOT / "dataset" / "manifest.json")
    source_ledger = load_json(ROOT / "sources" / "source-ledger.json")
    source_ids = {item.get("id") for item in source_ledger.get("sources", [])}
    covered_ids: list[str] = []
    semantic_dataset_dirs: set[Path] = set()
    for entry in dataset_manifest.get("datasets", []):
        entry_ids = entry.get("case_ids") or [entry.get("case_id")]
        if not all(isinstance(case_id, str) for case_id in entry_ids):
            fail(f"dataset manifest has invalid case id set: {entry_ids}")
        covered_ids.extend(entry_ids)
        missing_sources = sorted(set(entry.get("source_ids", [])) - source_ids)
        if missing_sources:
            fail(f"dataset source ids missing from source ledger: {missing_sources}")
        data_dir = ROOT / entry["directory"]
        primary_files = entry.get("primary_files")
        if isinstance(primary_files, list):
            if not primary_files or entry.get("record_count") != len(entry_ids):
                fail(f"grouped dataset contract is incomplete: {entry['directory']}")
            for relative in primary_files:
                data_file = data_dir / relative
                if not data_file.is_file():
                    fail(f"grouped dataset file missing: {entry['directory']}/{relative}")
        else:
            primary_file = entry.get("primary_file", "case.csv")
            data_file = data_dir / primary_file
            if not data_file.is_file():
                fail(f"dataset entry has no primary file {primary_file}: {entry['directory']}")
            if sha256(data_file) != entry.get("sha256"):
                fail(f"dataset manifest hash mismatch: {entry['directory']}/{primary_file}")
            with data_file.open("r", encoding="utf-8-sig", newline="") as handle:
                rows = list(csv.DictReader(handle))
            if len(rows) != entry.get("row_count"):
                fail(f"dataset row count mismatch: {entry['directory']}")
            if rows and len(rows[0]) != entry.get("column_count"):
                fail(f"dataset column count mismatch: {entry['directory']}")
        if any(case_id in expected_labs for case_id in entry_ids):
            semantic_dataset_dirs.add(data_dir)

    expected_dataset_ids = runtime_ids + [
        str(item["id"])
        for item in manifest_labs
        if item.get("dataset_path") is not None
    ]
    if covered_ids != expected_dataset_ids:
        fail("dataset manifest ids do not match dataset-backed B/P/S/L items in semantic order")

    for data_dir in semantic_dataset_dirs:
        checksum_file = data_dir / "checksums.sha256"
        if not checksum_file.is_file():
            fail(f"semantic dataset has no checksums.sha256: {data_dir.relative_to(ROOT)}")
        for line in checksum_file.read_text(encoding="utf-8").splitlines():
            expected_hash, filename = line.split(maxsplit=1)
            target = data_dir / filename.strip()
            if not target.is_file() or sha256(target) != expected_hash:
                fail(f"checksum mismatch: {target.relative_to(ROOT)}")

    expected_skills = {
        "asset-contract",
        "capability-router",
        "data-profile",
        "metric-brief",
        "pixijs-game-contract",
        "poster-recipe",
        "product-opportunity-map",
        "react-bits-motion",
        "slide-plan",
    }
    actual_skills = {path.name for path in (ROOT / "code" / "skills").iterdir() if (path / "SKILL.md").is_file()}
    if actual_skills != expected_skills:
        fail(f"local Skill set mismatch: {sorted(actual_skills)}")

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for phrase in ("六步，共 18 个实验", "S001—S009", "L001—L004", "B001—B024", "9 个可运行 Skill"):
        if phrase not in readme:
            fail(f"README missing frozen count or range: {phrase}")

    code_readme = (ROOT / "code" / "README.md").read_text(encoding="utf-8")
    for phrase in ("P001—P008", "S001—S009", "L001—L003", "B001—B024"):
        if phrase not in code_readme:
            fail(f"code README missing current semantic entry: {phrase}")

    launcher = (ROOT / "run.bat").read_text(encoding="utf-8")
    for variable in ("TEMP", "TMP", "NPM_CONFIG_CACHE", "PLAYWRIGHT_BROWSERS_PATH"):
        if not re.search(rf"if not defined {variable} set ", launcher, flags=re.IGNORECASE):
            fail(f"run.bat has no portable fallback for {variable}")
    if re.search(r"[A-Za-z]:\\", launcher):
        fail("run.bat contains a machine-specific absolute path")

    registry = (ROOT / "code" / "cases" / "registry.ts").read_text(encoding="utf-8")
    if not re.search(r"\^B\\d\{3\}\$", registry, flags=re.IGNORECASE):
        fail("case registry has no canonical three-digit business id check")

    print(
        "[PASS] semantic catalog: "
        f"{len(expected_labs)} capability cases + {len(cases)} business cases; "
        "teaching ids and portable launcher policy verified"
    )


if __name__ == "__main__":
    main()
