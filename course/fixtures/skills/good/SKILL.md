---
name: evidence-loop-review
description: Review a bounded AI loop when the user asks whether its sensors, stop rules, and evidence are sufficient.
---

# Evidence Loop Review

## Trigger

Use for a concrete loop design or run trace. Do not use for open-ended ideation without a measurable target.

## Workflow

1. Identify the goal, actuator, sensor, state, budget, and stop rules.
2. Confirm that at least one sensor calls the system under test.
3. Compare each cycle by failure fingerprint and evidence count.
4. Stop on success, repeated failure, regression, budget exhaustion, or an external boundary.
5. Return findings and an escalation packet; do not edit the checker to obtain a pass.

## Verification

Require a replayable trace with cycle number, action, result, duration, evidence reference, and stop reason.

## References

Load `references/contract.md` only when a field definition is needed.
