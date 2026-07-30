from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXPECTED = [f"S{index:02d}" for index in range(1, 9)]
REQUIRED_SKILLS = {
    "capability-router",
    "data-profile",
    "metric-brief",
    "product-opportunity-map",
    "poster-recipe",
    "slide-plan",
    "pixijs-game-contract",
    "asset-contract",
}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    manifest = load_json(ROOT / "course-manifest.json")
    if manifest["capability_spine"]["agent_skill_cases"] != EXPECTED:
        raise ValueError("course manifest S01-S08 order mismatch")
    skill_labs = [lab for lab in manifest["labs"] if lab["track"] == "agent-skill"]
    if [lab["id"] for lab in skill_labs] != EXPECTED:
        raise ValueError("S01-S08 order mismatch")

    source_card = load_json(ROOT / "sources" / "skills-research-card.json")
    sources = {item["id"]: item for item in source_card["sources"]}
    if any(not item.get("url") or not item.get("license") or not item.get("use") for item in sources.values()):
        raise ValueError("Skill source card is incomplete")

    dataset = ROOT / "dataset" / "S-agent-skill-cases"
    with (dataset / "case.csv").open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if len(rows) != 32:
        raise ValueError(f"expected 32 runtime rows, found {len(rows)}")

    for lab in skill_labs:
        scoped = [row for row in rows if row["lab_id"] == lab["id"]]
        if len(scoped) != 4 or [row["stage"] for row in scoped] != ["观察", "选择", "动作", "检查"]:
            raise ValueError(f"{lab['id']} does not have the four-stage runtime")
        skill_name = Path(lab["code_path"]).name
        receipt = load_json(ROOT / "evidence" / "runtime" / "agent-skills" / lab["id"] / "receipt.json")
        if receipt["skill_name"] != skill_name:
            raise ValueError(f"{lab['id']} receipt Skill mismatch")
        if receipt["artifact_count"] != len(receipt["artifacts"]):
            raise ValueError(f"{lab['id']} receipt artifact count mismatch")
        for artifact in receipt["artifacts"]:
            artifact_path = ROOT / artifact["path"]
            if not artifact_path.is_file():
                raise ValueError(f"{lab['id']} missing artifact: {artifact['path']}")
            digest = hashlib.sha256(artifact_path.read_bytes()).hexdigest()
            if digest != artifact["sha256"] or artifact_path.stat().st_size != artifact["bytes"]:
                raise ValueError(f"{lab['id']} stale artifact receipt: {artifact['path']}")
        if lab["id"] in {"S05", "S08"} and receipt.get("provider_scope") not in {
            None,
            "blocked-not-verified",
        }:
            raise ValueError(f"{lab['id']} overclaims Provider verification")

    actual_skills = {
        path.name
        for path in (ROOT / "code" / "skills").iterdir()
        if (path / "SKILL.md").is_file()
    }
    if actual_skills != REQUIRED_SKILLS:
        raise ValueError(
            f"local Skill set mismatch: expected={sorted(REQUIRED_SKILLS)} actual={sorted(actual_skills)}"
        )

    print("Agent + Skills verified: labs=8, runtime_rows=32, local_skills=8, provider_overclaims=0")


if __name__ == "__main__":
    main()
