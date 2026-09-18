# UI Workbench Acceptance Contract

## Required Evidence

- Source path, hash, row count, representative record, and data nature.
- Complete Prompt for every group.
- Actual HTML only for groups that were executed.
- Desktop and phone screenshots for each executed variant.
- Browser results for keyboard focus, filters, validation gates, horizontal overflow, and console errors.

## State Matrix

| State | Observable requirement |
|---|---|
| Empty input | Action disabled; required fields are labelled |
| Pending/unknown | Reason is required; no external conclusion is asserted |
| Explicit result | Summary and evidence ID are both required |
| Completed | Completion requires an independent role and persisted evidence |
| Error | Error is announced without discarding user input |

## Comparison Rules

Keep data, copy, regions, actions, states, and viewport checks constant. Change only the declared independent variable, such as the UI Kit. Compare information hierarchy, state completeness, keyboard access, responsive behavior, component consistency, dependency weight, and maintenance cost.
