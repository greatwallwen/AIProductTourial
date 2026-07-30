import { describe, expect, it } from "vitest";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { validateDomainCommand, type DomainCommandInput } from "../../cases/domain-command";
import { loadDatasetProjection } from "../../cases/load-dataset";
import { getCaseDefinition } from "../../cases/registry";

const definition = getCaseDefinition("B018")!;
const dataset = loadDatasetProjection(definition);
const row = dataset.rows.find((item) => item.objectId === definition.featuredObjectId)!;
const { objectId, decision: _decision, ...payload } = row;

function projection(overrides: Partial<CaseProjection> = {}): CaseProjection {
  return {
    caseId: "B018",
    objectId,
    state: "待定位",
    version: 0,
    payload,
    updatedAt: "2026-07-27T08:00:00.000Z",
    ...overrides,
  };
}

const task = {
  taskId: "boiler-check:B018-BT-0044:v1",
  objectId: "B018-BT-0044",
  objectVersion: 1,
  eventId: "BT-0044",
  eventStartTime: "2022-03-29 17:22:39",
  eventEndTime: "2022-03-29 17:46:59",
  windowStartMinute: "2022-03-29 17:22",
  windowEndMinute: "2022-03-29 17:46",
  windowRowCount: 25,
  monitorMinute: "2022-03-29 17:46",
  observedTemperatureC: 529.8458333333333,
  segmentId: "final-superheater-section",
  investigationReason: "出口温度连续下偏，先核对末级过热器前后段温差。",
  assignee: "运行一班张工",
  attachedEvidenceIds: ["minute-temperature", "sample-integrity"],
  requestedSourceIds: ["section-temperatures"],
  createdBy: "case18-boiler-engineer",
};

function dispatch(overrides: Partial<DomainCommandInput> = {}): DomainCommandInput {
  return {
    caseId: "B018",
    command: "dispatch_shift_check",
    actorRole: "process_engineer",
    actorId: "case18-boiler-engineer",
    idempotencyKey: "case18-bt0044-dispatch",
    evidenceIds: [
      "boiler-event:BT-0044",
      "boiler-window:2022-03-29 17:22:2022-03-29 17:46",
      "minute-temperature",
      "sample-integrity",
    ],
    data: task,
    current: projection(),
    sceneRows: dataset.sceneRows,
    ...overrides,
  };
}

describe("case 18 event contract", () => {
  it("projects BT-0044 as one event with exactly 25 consecutive minute rows", () => {
    expect(objectId).toBe("B018-BT-0044");
    expect(payload.event_id).toBe("BT-0044");
    expect(payload.source_samples).toBe("293");
    expect(dataset.sceneRows).toHaveLength(25);
    expect(dataset.sceneRows[0]?.monitor_minute).toBe("2022-03-29 17:22");
    expect(dataset.sceneRows.at(-1)?.monitor_minute).toBe("2022-03-29 17:46");
    const timestamps = dataset.sceneRows.map((item) => Date.parse(`${String(item.monitor_minute).replace(" ", "T")}:00Z`));
    expect(timestamps.every((value, index) => index === 0 || value - timestamps[index - 1]! === 60_000)).toBe(true);
  });

  it("accepts the exact event-bound dispatch", () => {
    expect(() => validateDomainCommand(dispatch())).not.toThrow();
  });

  it("requires at least one missing process source and rejects a forged event window", () => {
    expect(() => validateDomainCommand(dispatch({
      data: { ...task, requestedSourceIds: [] },
    }))).toThrow("boiler_requested_source_required");
    expect(() => validateDomainCommand(dispatch({
      data: { ...task, eventId: "BT-0043" },
    }))).toThrow("boiler_event_mismatch");
    expect(() => validateDomainCommand(dispatch({
      sceneRows: dataset.sceneRows.slice(1),
    }))).toThrow("boiler_window_invalid");
  });

  it("freezes the segment and requires a different supervisor", () => {
    const current = projection({ state: "当班排查中", version: 1, task });
    const confirmation: DomainCommandInput = {
      ...dispatch(),
      command: "confirm_segment",
      actorRole: "supervisor",
      actorId: "case18-operation-supervisor",
      current,
      data: {
        segmentId: "final-superheater-section",
        prerequisiteTaskId: task.taskId,
        supervisorId: "case18-operation-supervisor",
        supervisorNote: "同意先查末级过热器出口段，完成后回填分段温度。",
      },
      evidenceIds: [
        "boiler-event:BT-0044",
        "boiler-window:2022-03-29 17:22:2022-03-29 17:46",
        `boiler-task:${task.taskId}`,
      ],
    };
    expect(() => validateDomainCommand(confirmation)).not.toThrow();
    expect(() => validateDomainCommand({
      ...confirmation,
      data: { ...confirmation.data, segmentId: "desuperheater-section" },
    })).toThrow("segment_mismatch");
    expect(() => validateDomainCommand({
      ...confirmation,
      actorId: "case18-boiler-engineer",
      data: { ...confirmation.data, supervisorId: "case18-boiler-engineer" },
    })).toThrow("actor_separation_required");
  });
});
