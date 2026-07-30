---
name: capability-router
description: Route a Chinese task JSON to the smallest allowlisted local Skill and explain the decision. Use when a task must select among course Skills, verify required inputs and permissions, or stop before missing-input, destructive, network, or arbitrary-shell actions.
---

# Capability router

1. Put the task, available inputs, requested actions, and granted permissions in one JSON file.
2. Run `scripts/route_task.py`; do not choose a capability from memory.
3. Read `selected_skill`, `reason`, `required_inputs`, and `stop_reason` from the result.
4. Stop when `status` is `blocked`. Do not obtain new authority or invent a missing input.

```powershell
python -B scripts/route_task.py --input examples/01-data-profile.json
```

Use `--output <path>` to save the decision. The allowlist and required inputs live in `contracts/capabilities.json`; the input and output shapes live beside it.
