import { describe, expect, it } from "vitest";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { validateDomainCommand, type DomainCommandInput } from "../../cases/domain-command";

function projection(
  caseId: string,
  payload: Record<string, unknown>,
  task: Record<string, unknown> = {},
  version = 0,
): CaseProjection {
  return {
    caseId,
    objectId: `${caseId}-OBJECT-1`,
    state: version ? "处理中" : "待处理",
    version,
    payload,
    task,
    updatedAt: "2026-07-26T00:00:00.000Z",
  };
}

function run(input: DomainCommandInput) {
  return () => validateDomainCommand(input);
}

describe("dataset-backed domain gates for cases 15, 16 and 17", () => {
  it("case 15 recomputes blank sensor evidence instead of treating it as zero", () => {
    const current = projection("15", {
      wafer_id: "SECOM-0003",
      test_timestamp: "19/07/2008 13:17:00",
      quality_label: "fail",
      review_priority: "quality-gate-review",
      sensor_158: "",
    });
    const data = {
      aggregateType: "wafer_retest_case",
      waferObservationId: "SECOM-0003",
      observationVersion: 0,
      sourceTimestamp: "19/07/2008 13:17:00",
      originalQualityLabel: "fail",
      reviewPriority: "quality-gate-review",
      sensorEvidence: [{
        sensorId: "sensor_158",
        rawValue: null,
        numericValue: null,
        isMissing: true,
        datasetMissingRows: 1429,
      }],
      retestTask: {
        taskId: "RETEST-SECOM-0003-V1",
        selectedSensorIds: ["sensor_158"],
        requestedChecks: { preserve: true, missing: true, manual: true },
        requestedByRole: "quality_engineer",
        requestedByActorId: "case15-quality-engineer",
        note: "复测缺失通道并保留原始质量标签。",
        status: "requested",
      },
      decision: "request_retest",
      serverValidationRequired: true,
    };
    const input: DomainCommandInput = {
      caseId: "15",
      command: "request_retest",
      actorRole: "quality_engineer",
      actorId: "case15-quality-engineer",
      idempotencyKey: "case-15:wafer:SECOM-0003:request_retest:v0",
      evidenceIds: ["wafer:SECOM-0003", "sensor:SECOM-0003:sensor_158", "retest-task:RETEST-SECOM-0003-V1"],
      data,
      current,
      supportingArtifacts: { "sensor-ranking.csv": [{ sensor_id: "sensor_158", missing_rows: "1429" }] },
    };
    expect(run(input)).not.toThrow();
    expect(run({
      ...input,
      data: {
        ...data,
        sensorEvidence: [{ ...data.sensorEvidence[0], rawValue: "0", numericValue: 0, isMissing: false }],
      },
    })).toThrow("wafer_sensor_mismatch");
  });

  it("case 16 recomputes the selected turbine's complete seven-day window", () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({
      turbine_id: "7",
      day: String(index + 1),
      underperformance_share: index < 2 ? "1" : "0",
      source_records: "10",
      valid_wind_records: index === 6 ? "9" : "10",
      valid_power_records: "10",
    }));
    const current = projection("16", rows[0]);
    const data = {
      aggregateType: "wind_underperformance_investigation",
      investigationId: "WIND-INV-7",
      taskVersion: 1,
      turbineId: "7",
      operatingWindow: {
        scope: "seven_operating_days",
        dayIds: ["1", "2", "3", "4", "5", "6", "7"],
        underperformanceDays: 2,
        windCoverage: { valid: 69, total: 70 },
        powerCoverage: { valid: 70, total: 70 },
      },
      request: {
        requestId: "WIND-CHECK-7",
        requesterId: "reliability-engineer-01",
        assigneeId: "field-team-01",
        expectedShift: "下一运行班",
        scope: "seven_operating_days",
        checks: ["核对 SCADA 风速与功率完整性", "补充同群基线", "核对限电指令", "补充告警与维修结果"],
        note: "现场核对功率测量链路、运行约束与机组状态。",
        status: "requested",
      },
      evidence: {
        peer_baseline: { status: "requested" },
        curtailment_order: { status: "requested" },
        alarm_log: { status: "requested" },
        maintenance_result: { status: "requested" },
      },
      decision: "request_field_inspection",
      serverValidationRequired: true,
    };
    const input: DomainCommandInput = {
      caseId: "16",
      command: "submit_field_check",
      actorRole: "reliability_engineer",
      actorId: "reliability-engineer-01",
      idempotencyKey: "case-16:turbine:7:submit_field_check:v0",
      evidenceIds: ["wind-window:7:days-1-2-3-4-5-6-7"],
      data,
      current,
      sceneRows: rows,
    };
    expect(run(input)).not.toThrow();
    expect(run({
      ...input,
      data: { ...data, operatingWindow: { ...data.operatingWindow, underperformanceDays: 7 } },
    })).toThrow("wind_window_mismatch");
  });

  it("case 17 verifies the synchronized cursor against the local waveform", () => {
    const current = projection("17", { session_id: "BD-0003" });
    const waveform = [
      { session_id: "BD-0003", sample_index: "1", cutter_motor_torque: "1.1", cutter_follow_error: "0.1", film_follow_error: "0.2" },
      { session_id: "BD-0003", sample_index: "2", cutter_motor_torque: "1.2", cutter_follow_error: "0.2", film_follow_error: "0.3" },
      { session_id: "BD-0003", sample_index: "3", cutter_motor_torque: "1.3", cutter_follow_error: "0.3", film_follow_error: "0.4" },
    ];
    const plan = {
      planId: "CUTTER-PLAN-BD-0003",
      sessionId: "BD-0003",
      plannerId: "planner-01",
      selectedSignal: "cutter_follow_error",
      syncedCursor: {
        sampleIndex: 2,
        channels: ["cutter_motor_torque", "cutter_follow_error", "film_follow_error"],
        values: { cutter_motor_torque: 1.2, cutter_follow_error: 0.2, film_follow_error: 0.3 },
      },
      inspectionWindow: { startSample: 1, endSample: 3 },
      direction: "核对切刀跟随误差与薄膜跟随关系",
      note: "夜班先核对同步误差窗口与机械间隙。",
      status: "pending_confirmation",
    };
    const data = {
      aggregateType: "cutter_health_review_session",
      reviewId: "CUTTER-REVIEW-BD-0003",
      taskVersion: 1,
      sessionId: "BD-0003",
      source: {
        summaryDatasetRows: 1,
        waveformArtifact: "waveform.csv",
        sampleCount: 3,
        channels: [
          { field: "cutter_motor_torque" },
          { field: "cutter_follow_error" },
          { field: "film_follow_error" },
        ],
      },
      inspectionPlan: plan,
      decision: "schedule_inspection",
      serverValidationRequired: true,
    };
    const input: DomainCommandInput = {
      caseId: "17",
      command: "schedule_night_inspection",
      actorRole: "maintenance_planner",
      actorId: "planner-01",
      idempotencyKey: "case-17:session:BD-0003:schedule_night_inspection:v0",
      evidenceIds: ["session:BD-0003:summary", "waveform:BD-0003:samples-3", "waveform:BD-0003:cursor-2"],
      data,
      current,
      sceneRows: [current.payload],
      supportingArtifacts: { "waveform.csv": waveform },
    };
    expect(run(input)).not.toThrow();
    expect(run({
      ...input,
      data: {
        ...data,
        inspectionPlan: {
          ...plan,
          syncedCursor: { ...plan.syncedCursor, values: { ...plan.syncedCursor.values, cutter_follow_error: 9.9 } },
        },
      },
    })).toThrow("cutter_cursor_mismatch");
  });
});
