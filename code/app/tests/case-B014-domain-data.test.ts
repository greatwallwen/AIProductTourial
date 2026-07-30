import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { describe, expect, it } from "vitest";
import { validateDomainCommand, type DomainCommandInput } from "../../cases/domain-command";
import { loadDatasetProjection } from "../../cases/load-dataset";
import { getCaseDefinition } from "../../cases/registry";

const definition = getCaseDefinition("B014")!;
const dataset = loadDatasetProjection(definition);
const featured = dataset.rows.find((row) => row.event_id === "FQ-0016")!;

const review = {
  taskId: "FLOT-FQ-0016-V1",
  eventId: "FQ-0016",
  hours: 72,
  rowCount: 72,
  windowStart: "2017-03-30 08:00:00",
  windowEnd: "2017-04-02 07:00:00",
  priorityCellIds: ["3", "1", "2"],
  hypothesis: "air_balance",
  assignee: "当班工艺工程师",
  dueAt: "2026-07-27",
  note: "按每列历史记录先核对三号、一号、二号槽风量与仪表完整性。",
  evidenceItems: [
    "event:FQ-0016",
    "trend:2017-03-30 08:00:00:2017-04-02 07:00:00",
    "cell-air:3",
    "cell-air:1",
    "cell-air:2",
    "quality:2017-04-02 07:00:00",
  ],
  createdBy: "case14-process-engineer",
};

function current(state = "待诊断", task: Record<string, unknown> = {}): CaseProjection {
  return {
    caseId: "B014",
    objectId: "B014-FQ-0016",
    state,
    version: state === "待诊断" ? 0 : 1,
    payload: featured,
    task,
    updatedAt: "2026-07-27T00:00:00.000Z",
  };
}

function command(overrides: Partial<DomainCommandInput> = {}): DomainCommandInput {
  return {
    caseId: "B014",
    command: "submit_process_review",
    actorRole: "process_engineer",
    actorId: "case14-process-engineer",
    idempotencyKey: "case14:FQ-0016:submit:v0",
    evidenceIds: review.evidenceItems,
    data: { processReview: review },
    current: current(),
    sceneRows: dataset.sceneRows,
    supportingArtifacts: dataset.supportingArtifacts,
    ...overrides,
  };
}

describe("case 14 event and dataset contract", () => {
  it("uses FQ-0016 as the business object and supplies the exact continuous 72-hour window", () => {
    expect(dataset.rows[0]).toMatchObject({
      objectId: "B014-FQ-0016",
      event_id: "FQ-0016",
      start_hour: "2017-03-31 17:00:00",
      end_hour: "2017-04-02 07:00:00",
      duration_hours: "39",
      monitor_hour: "2017-04-02 07:00:00",
      priority_cell_ids: "3|1|2",
    });
    expect(dataset.sceneRows).toHaveLength(72);
    expect(dataset.sceneRows[0]?.monitor_hour).toBe("2017-03-30 08:00:00");
    expect(dataset.sceneRows.at(-1)?.monitor_hour).toBe("2017-04-02 07:00:00");
    const hours = dataset.sceneRows.map((row) => Date.parse(`${String(row.monitor_hour).replace(" ", "T")}+08:00`));
    expect(hours.slice(1).every((hour, index) => hour - hours[index]! === 3_600_000)).toBe(true);
    expect(String(featured.dominant_deviation)).toContain("3号浮选柱风量");
    expect(String(featured.dominant_deviation)).not.toContain("5号浮选柱风量");
  });

  it("documents the full snapshot gap and separates public measurements from course rules", () => {
    const root = resolve(process.cwd(), "../../dataset/B014-flotation-impurity-review");
    const source = JSON.parse(readFileSync(resolve(root, "source.json"), "utf8"));
    const schema = JSON.parse(readFileSync(resolve(root, "schema.json"), "utf8"));
    expect(source.generation.temporal_integrity).toMatchObject({
      largest_observed_interval_hours: 319,
      missing_hour_points_between_records: 318,
      gap_start: "2017-03-16 05:00:00",
      gap_end: "2017-03-29 12:00:00",
    });
    expect(source.generation.featured_event.priority_cell_ids).toEqual(["3", "1", "2"]);
    expect(schema.columns.find((column: { name: string }) => column.name === "concentrate_silica_mean")?.origin)
      .toBe("public-measurement-hourly-aggregate");
    expect(schema.columns.find((column: { name: string }) => column.name === "quality_state")?.origin)
      .toBe("course-rule-derived");
  });
});

describe("case 14 command contract", () => {
  it("accepts only the exact FQ-0016 window and event priority cells", () => {
    expect(() => validateDomainCommand(command())).not.toThrow();
    expect(() => validateDomainCommand(command({
      data: { processReview: { ...review, rowCount: 71 } },
    }))).toThrow("process_window_invalid");
    expect(() => validateDomainCommand(command({
      data: { processReview: { ...review, priorityCellIds: ["5"] } },
    }))).toThrow("process_priority_mismatch");
  });

  it("allows an initial supervisor hold without a hidden engineer note", () => {
    expect(() => validateDomainCommand(command({
      command: "hold_adjustment",
      actorRole: "supervisor",
      actorId: "case14-production-supervisor",
      idempotencyKey: "case14:FQ-0016:hold:v0",
      evidenceIds: ["event:FQ-0016", "control-write:block"],
      data: {
        supervisorDecision: {
          supervisorId: "case14-production-supervisor",
          note: "保持人工控制，不向控制系统写入设定值。",
        },
      },
    }))).not.toThrow();
  });

  it("freezes a submitted check sheet and requires a different supervisor actor", () => {
    const persisted = current("工艺复核中", { processReview: review });
    const supervisorDecision = {
      taskId: review.taskId,
      supervisorId: "case14-production-supervisor",
      note: "同意按原核查单下发现场仪表核对。",
    };
    expect(() => validateDomainCommand(command({
      command: "dispatch_instrument_check",
      actorRole: "supervisor",
      actorId: "case14-production-supervisor",
      idempotencyKey: "case14:FQ-0016:dispatch:v1",
      current: persisted,
      data: { processReview: review, supervisorDecision },
    }))).not.toThrow();
    expect(() => validateDomainCommand(command({
      command: "dispatch_instrument_check",
      actorRole: "supervisor",
      actorId: "case14-production-supervisor",
      idempotencyKey: "case14:FQ-0016:dispatch-rewrite:v1",
      current: persisted,
      data: {
        processReview: { ...review, priorityCellIds: ["3", "1"] },
        supervisorDecision,
      },
    }))).toThrow("process_priority_mismatch");
    expect(() => validateDomainCommand(command({
      command: "dispatch_instrument_check",
      actorRole: "supervisor",
      actorId: "case14-process-engineer",
      idempotencyKey: "case14:FQ-0016:dispatch-same-actor:v1",
      current: persisted,
      data: {
        processReview: review,
        supervisorDecision: { ...supervisorDecision, supervisorId: "case14-process-engineer" },
      },
    }))).toThrow("actor_separation_required");
  });
});
