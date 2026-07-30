import { describe, expect, it } from "vitest";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { validateDomainCommand } from "../../cases/domain-command";

function projection(
  caseId: string,
  state: string,
  payload: Record<string, unknown>,
  task: Record<string, unknown> = {},
): CaseProjection {
  return {
    caseId,
    objectId: caseId === "07"
      ? "07-CN-FC-COURSE-01-2026-07-14"
      : caseId === "09"
        ? "09-METROPT-20200418-GAP-01"
        : `${caseId}-CN-AQ-02-038-CN-POND-02`,
    state,
    version: 1,
    payload,
    task,
    updatedAt: "2026-07-27T00:00:00.000Z",
  };
}

describe("case 07 window decisions", () => {
  const task = {
    facts: ["public-order-slice", "synthetic-domain-record", "source-boundary"],
    hypotheses: ["发布与恢复变慢在同一窗口出现，仍需调用链和容量证据验证。"],
    constraints: ["team-capacity", "release-coupling"],
    risks: ["duplicate-delivery", "out-of-order"],
    adr: {
      adrId: "ADR-07-CN-FC-COURSE-01-2026-07-14",
      context: "CN-FC-COURSE-01 · 2026-07-14 四域架构评审",
      status: "proposed",
    },
    createdBy: "case07-architect",
  };
  const payload = { facility_code: "CN-FC-COURSE-01", scenario_date: "2026-07-14" };
  const evidenceIds = [
    "public-order-slice:DATA-07",
    "ops:CN-FC-COURSE-01:2026-07-14",
    "source-boundary:public-plus-synthetic",
  ];

  it("binds evidence and observability requests to the selected review window", () => {
    expect(() => validateDomainCommand({
      caseId: "07",
      command: "verify_evidence",
      actorRole: "architect",
      actorId: "case07-architect",
      idempotencyKey: "case07:verify:1",
      evidenceIds,
      data: task,
      current: projection("07", "待评审", payload),
    })).not.toThrow();

    expect(() => validateDomainCommand({
      caseId: "07",
      command: "request_observability_evidence",
      actorRole: "supervisor",
      actorId: "case07-supervisor",
      idempotencyKey: "case07:observe:1",
      evidenceIds,
      data: {
        request: {
          adrId: task.adr.adrId,
          requestedSignals: ["调用链", "容量曲线", "变更影响"],
          reason: "当前只能确认同窗出现，缺少调用关系与容量边界。",
          requestedBy: "case07-supervisor",
        },
      },
      current: projection("07", "架构评审中", payload, task),
    })).not.toThrow();
  });
});

describe("case 08 three-role field evidence", () => {
  const payload = {
    event_id: "CN-AQ-02-038",
    region_id: "CN-POND-02",
    evidence_status: "value_conflict",
  };
  const dispatch = {
    eventId: "CN-AQ-02-038",
    regionId: "CN-POND-02",
    fieldOperatorId: "AQ-FIELD-02",
    note: "复测四项读数并回传照片资产号。",
    evidenceIssue: "value_conflict",
    requiredEvidence: ["temperature_c", "dissolved_oxygen_mg_l", "ph", "turbidity_ntu", "field_photo"],
    createdBy: "case08-dispatcher",
  };
  const fieldReturn = {
    eventId: "CN-AQ-02-038",
    operatorId: "AQ-FIELD-02",
    capturedAt: "2026-06-02T14:05",
    photoAssetId: "PHOTO-CN-AQ-02-038",
    temperatureC: 31.2,
    dissolvedOxygenMgL: 5.9,
    ph: 7.28,
    turbidityNtu: 8.4,
  };

  it("separates dispatch, field return and supervisor acceptance", () => {
    expect(() => validateDomainCommand({
      caseId: "08", command: "dispatch_field_check", actorRole: "dispatcher", actorId: "case08-dispatcher",
      idempotencyKey: "case08:dispatch:1", evidenceIds: ["CN-AQ-02-038"], data: { dispatch },
      current: projection("08", "待研判", payload),
    })).not.toThrow();

    expect(() => validateDomainCommand({
      caseId: "08", command: "submit_field_return", actorRole: "field_operator", actorId: "AQ-FIELD-02",
      idempotencyKey: "case08:return:1", evidenceIds: ["PHOTO-CN-AQ-02-038"], data: { fieldReturn },
      current: projection("08", "现场取证中", payload, { dispatch }),
    })).not.toThrow();

    const returned = projection("08", "待主管采信", payload, { dispatch, fieldReturn });
    const validation = {
      issueResolved: true,
      originalEvidenceStatus: "value_conflict",
      note: "现场记录完整，采信本次人工复测包。",
      confirmedBy: "case08-supervisor",
    };
    expect(() => validateDomainCommand({
      caseId: "08", command: "confirm_event", actorRole: "supervisor", actorId: "case08-supervisor",
      idempotencyKey: "case08:confirm:1", evidenceIds: ["PHOTO-CN-AQ-02-038"], data: { validation }, current: returned,
    })).not.toThrow();
    expect(() => validateDomainCommand({
      caseId: "08", command: "confirm_event", actorRole: "supervisor", actorId: "AQ-FIELD-02",
      idempotencyKey: "case08:confirm:2", evidenceIds: ["PHOTO-CN-AQ-02-038"],
      data: { validation: { ...validation, confirmedBy: "AQ-FIELD-02" } }, current: returned,
    })).toThrow("actor_separation_required");
  });
});

describe("case 09 server-side continuity gate", () => {
  const retrieval = {
    question: "TP2 记录断档后能否提交现场目视检查申请？",
    query: "TP2 记录连续性 现场目视检查",
    activeTrace: "TP2",
    timestamp: "2020-04-18 00:24:30",
    windowStart: "2020-04-18 00:23:59",
    windowEnd: "2020-04-18 00:28:59",
    rankedResults: [
      { id: "UCI-791-FIELDS", score: 16, stance: "support", version: "uci-791-v1" },
      { id: "COURSE-09-APPROVAL", score: 7, stance: "constraint", version: "course-policy-v1.0.0" },
    ],
    createdBy: "case09-engineer",
  };
  const inspection = {
    query: retrieval.query,
    activeTrace: retrieval.activeTrace,
    timestamp: retrieval.timestamp,
    supportCitationIds: ["UCI-791-FIELDS"],
    challengeCitationIds: ["COURSE-09-APPROVAL"],
    checked: ["核对五分钟窗口与故障边界", "核对传感字段、样本数与来源", "确认现场检查不触发设备控制"],
    note: "只申请现场目视核对仪表、环境和维护记录。",
    requestedAction: "on_site_visual_inspection",
    reviewedBy: "case09-supervisor",
  };
  const payload = { investigation_id: "METROPT-20200418-GAP-01" };

  it("rejects a 352-second gap and accepts a continuous recovery segment", () => {
    const current = projection("09", "资料已核对", payload, { retrieval });
    const gapRows = [
      { timestamp: "2020-04-18 00:18:07" },
      { timestamp: "2020-04-18 00:23:59" },
      { timestamp: "2020-04-18 00:24:10" },
    ];
    expect(() => validateDomainCommand({
      caseId: "09", command: "create_inspection_order", actorRole: "supervisor", actorId: "case09-supervisor",
      idempotencyKey: "case09:inspect:gap", evidenceIds: ["UCI-791-FIELDS", "COURSE-09-APPROVAL"],
      data: { inspection: { ...inspection, timestamp: "2020-04-18 00:20:00" } },
      current: projection("09", "资料已核对", payload, {
        retrieval: { ...retrieval, timestamp: "2020-04-18 00:20:00", windowStart: "2020-04-18 00:16:00", windowEnd: "2020-04-18 00:26:59" },
      }),
      sceneRows: gapRows,
    })).toThrow("telemetry_gap_unresolved");

    const continuousRows = [
      { timestamp: "2020-04-18 00:23:59" },
      { timestamp: "2020-04-18 00:24:11" },
      { timestamp: "2020-04-18 00:24:24" },
      { timestamp: "2020-04-18 00:24:36" },
    ];
    expect(() => validateDomainCommand({
      caseId: "09", command: "create_inspection_order", actorRole: "supervisor", actorId: "case09-supervisor",
      idempotencyKey: "case09:inspect:ok", evidenceIds: ["UCI-791-FIELDS", "COURSE-09-APPROVAL"],
      data: { inspection }, current, sceneRows: continuousRows,
    })).not.toThrow();
  });
});
