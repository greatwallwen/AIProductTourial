from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path
from typing import Any


TEMPLATE_ROOT = Path(__file__).resolve().parents[1] / "assets" / "game-template"


def _inside(path: Path, root: Path) -> bool:
    return path == root or root in path.parents


def _load_request(path: str | Path) -> dict[str, Any]:
    with Path(path).open("r", encoding="utf-8-sig") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError("request_must_be_object")
    required = (
        "id", "title", "description", "duration_seconds", "score_per_ticket",
        "controls", "source", "tickets", "hazards", "health_boundary",
    )
    missing = [field for field in required if field not in value]
    if missing:
        raise ValueError("missing_fields:" + ",".join(missing))
    if not re.fullmatch(r"[a-z0-9-]+", str(value["id"])):
        raise ValueError("invalid_id")
    if not isinstance(value["duration_seconds"], int) or not 10 <= value["duration_seconds"] <= 300:
        raise ValueError("invalid_duration_seconds")
    if not isinstance(value["score_per_ticket"], int) or value["score_per_ticket"] <= 0:
        raise ValueError("invalid_score_per_ticket")
    if not isinstance(value["source"], dict) or not value["source"].get("sha256"):
        raise ValueError("missing_source_provenance")
    if len(value["tickets"]) < 3 or len(value["hazards"]) < 2:
        raise ValueError("insufficient_game_objects")
    if "健康" not in str(value["health_boundary"]) and "health" not in str(value["health_boundary"]).lower():
        raise ValueError("missing_health_boundary")
    return value


def generate_game(request: dict[str, Any], output: str | Path, allowed_output_root: str | Path) -> dict[str, Any]:
    root = Path(allowed_output_root).resolve()
    target = Path(output).resolve()
    if not _inside(target, root):
        raise ValueError("output_outside_allowed_root")
    target.mkdir(parents=True, exist_ok=True)
    shutil.copytree(TEMPLATE_ROOT, target, dirs_exist_ok=True)

    package_path = target / "package.json"
    package = json.loads(package_path.read_text(encoding="utf-8"))
    package["name"] = request["id"]
    package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    ticket_positions = ((260, 160), (560, 360), (790, 140))
    hazard_positions = ((430, 250), (730, 410))
    config = {
        "id": request["id"],
        "title": request["title"],
        "description": request["description"],
        "durationSeconds": request["duration_seconds"],
        "scorePerTicket": request["score_per_ticket"],
        "hazardPenalty": 5,
        "speed": 220,
        "controls": request["controls"],
        "healthBoundary": request["health_boundary"],
        "playerStart": {"x": 120, "y": 160},
        "tickets": [
            {"label": str(label), "x": ticket_positions[index][0], "y": ticket_positions[index][1]}
            for index, label in enumerate(request["tickets"][:3])
        ],
        "hazards": [
            {"label": str(label), "x": hazard_positions[index][0], "y": hazard_positions[index][1]}
            for index, label in enumerate(request["hazards"][:2])
        ],
    }
    (target / "src" / "game-config.js").write_text(
        "export default " + json.dumps(config, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    contract = {
        "schema_version": 1,
        "status": "generated",
        "game_id": request["id"],
        "engine": {"name": "pixi.js", "version": "8.8.1", "render_loop": "Application.ticker"},
        "source": request["source"],
        "controls": request["controls"],
        "states": ["ready", "playing", "complete", "restarted"],
        "scoring": {"ticket": request["score_per_ticket"], "hazard": -5, "minimum": 0},
        "countdown_seconds": request["duration_seconds"],
        "restart": {"keyboard": "KeyR", "button_id": "restart"},
        "health_boundary": request["health_boundary"],
        "acceptance": [
            "pixi_application_initializes",
            "keyboard_moves_player",
            "ticket_increases_score",
            "countdown_decreases",
            "restart_resets_state",
            "pagehide_destroys_application",
        ],
    }
    (target / "game-contract.json").write_text(
        json.dumps(contract, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return {"status": "generated", "output": str(target), "files": 7, "game_id": request["id"]}


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a runnable PixiJS v8 course game.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--allowed-output-root", required=True)
    args = parser.parse_args()
    try:
        request = _load_request(args.input)
        result = generate_game(request, args.output, args.allowed_output_root)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "blocked", "reason": str(error)}, ensure_ascii=False))
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
