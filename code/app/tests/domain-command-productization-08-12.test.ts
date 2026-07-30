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
    objectId: `${caseId}-OBJECT-1`,
    state,
    version: 1,
    payload,
    task,
    updatedAt: "2026-07-26T00:00:00.000Z",
  };
}

function command(
  caseId: string,
  name: string,
  current: CaseProjection,
  data: Record<string, unknown>,
  actorId: string,
  evidenceIds: string[] = ["dataset-row"],
  sceneRows: Record<string, unknown>[] = [],
) {
  return () => validateDomainCommand({
    caseId,
    command: name,
    actorRole: name.includes("confirm") || name.includes("approve") || name.includes("cosign") ? "supervisor" : "operator",
    actorId,
    idempotencyKey: `${caseId}:${name}:v${current.version}`,
    evidenceIds,
    data,
    current,
    sceneRows,
  });
}

describe("productized domain gates for cases 08, 09, 11 and 12", () => {
  it("accepts a plausible case 08 field return and rejects impossible readings", () => {
    const dispatch = {
      eventId: "CN-AQ-02-038",
      regionId: "CN-POND-02",
      fieldOperatorId: "AQ-FIELD-02",
      note: "携带校准仪器复测冲突读数",
      evidenceIssue: "value_conflict",
      requiredEvidence: ["temperature_c", "dissolved_oxygen_mg_l", "ph", "turbidity_ntu", "field_photo"],
      createdBy: "case08-field-dispatcher",
    };
    const current = projection("08", "现场取证中", {
      event_id: "CN-AQ-02-038",
      region_id: "CN-POND-02",
      evidence_status: "value_conflict",
    }, { dispatch });
    const fieldReturn = {
      operatorId: "AQ-FIELD-02",
      capturedAt: "2026-06-02T14:05",
      photoAssetId: "PHOTO-CN-AQ-02-038",
      temperatureC: 31.2,
      dissolvedOxygenMgL: 5.9,
      ph: 7.28,
      turbidityNtu: 8.4,
    };
    const validation = {
      issueResolved: true,
      originalEvidenceStatus: "value_conflict",
      note: "现场值与备用仪表一致，采用现场复测值。",
      confirmedBy: "case08-aquaculture-supervisor",
    };
    expect(command("08", "submit_field_return", current, {
      fieldReturn: { ...fieldReturn, eventId: "CN-AQ-02-038" },
    }, "AQ-FIELD-02", [fieldReturn.photoAssetId])).not.toThrow();
    expect(command("08", "submit_field_return", current, {
      fieldReturn: { ...fieldReturn, eventId: "CN-AQ-02-038", ph: 18 },
    }, "AQ-FIELD-02", [fieldReturn.photoAssetId])).toThrow("field_reading_invalid");

    const returned = projection("08", "待主管采信", current.payload, {
      dispatch,
      fieldReturn: { ...fieldReturn, eventId: "CN-AQ-02-038" },
    });
    expect(command("08", "confirm_event", returned, { validation }, "case08-aquaculture-supervisor", [fieldReturn.photoAssetId])).not.toThrow();
  });

  it("binds case 09 citations and inspection to the persisted retrieval", () => {
    const retrieval = {
      question: "TP2 排气压力变化是否需要创建现场检查申请？",
      query: "TP2 排气压力 故障窗口 现场检查",
      activeTrace: "TP2",
      timestamp: "2020-04-18 00:00:01",
      windowStart: "2020-04-17 23:59:58",
      windowEnd: "2020-04-18 00:00:06",
      rankedResults: [
        { id: "DOC-TP2", title: "压力检查", score: 16, stance: "support", source: "manual", version: "v1" },
        { id: "DOC-APPROVAL", title: "人工审批边界", score: 7, stance: "constraint", source: "policy", version: "v1" },
      ],
      createdBy: "case09-duty-engineer",
    };
    const current = projection("09", "资料待核验", { timestamp: retrieval.timestamp }, { retrieval });
    const inspection = {
      query: retrieval.query,
      activeTrace: retrieval.activeTrace,
      timestamp: retrieval.timestamp,
      supportCitationIds: ["DOC-TP2"],
      challengeCitationIds: ["DOC-APPROVAL"],
      checked: ["核对五分钟窗口与故障边界", "核对传感字段、样本数与来源", "确认现场检查不触发设备控制"],
      note: "现场仅核对仪表、环境和维护记录",
      requestedAction: "on_site_visual_inspection",
      reviewedBy: "case09-maintenance-supervisor",
    };
    const continuousRows = [
      { timestamp: "2020-04-17 23:59:58" },
      { timestamp: "2020-04-18 00:00:01" },
      { timestamp: "2020-04-18 00:00:06" },
    ];
    expect(command("09", "create_inspection_order", current, { inspection }, "case09-maintenance-supervisor", ["DOC-TP2", "DOC-APPROVAL"], continuousRows)).not.toThrow();
    expect(command("09", "create_inspection_order", current, {
      inspection: { ...inspection, supportCitationIds: ["DOC-APPROVAL"], challengeCitationIds: ["DOC-TP2"] },
    }, "case09-maintenance-supervisor", ["DOC-APPROVAL", "DOC-TP2"], continuousRows)).toThrow("retrieval_citation_invalid");
  });

  it("recomputes the selected case 11 threshold and requires four independent signers", () => {
    const payload = {
      candidate_id: "MODEL-ADMISSION-001",
      policy_version: "policy-2026.1",
      evaluation_id: "EVAL-11-004",
      slice_id: "region-west",
      sample_size: 800,
      comparator: "<=",
      threshold: 0.03,
    };
    const persisted = {
      candidateId: payload.candidate_id,
      createdBy: "case11-release-manager",
      retest: {
        retestId: "RETEST-MODEL-ADMISSION-001-region-west",
        datasetVersion: "region-slice-2026.2",
      },
    };
    const current = projection("11", "补测中", payload, persisted);
    const data = {
      aggregateType: "model_admission_candidate",
      candidateId: payload.candidate_id,
      candidateVersion: "candidate-v2",
      policyVersion: payload.policy_version,
      selectedEvaluationId: payload.evaluation_id,
      gateSet: [
        { evaluationId: "EVAL-11-001", gate: "risk", result: "pass", evidenceStatus: "complete" },
        { evaluationId: "EVAL-11-004", gate: "fairness", result: "fail", evidenceStatus: "missing_slice" },
        { evaluationId: "EVAL-11-007", gate: "safety", result: "pass", evidenceStatus: "complete" },
      ],
      retest: {
        retestId: persisted.retest.retestId,
        sourceEvaluationId: payload.evaluation_id,
        sliceId: payload.slice_id,
        targetSampleSize: 1600,
        datasetVersion: persisted.retest.datasetVersion,
        metricValue: 0.025,
        evidenceStatus: "complete",
        computedResult: "pass",
      },
      gateReviews: {
        risk: { role: "risk_reviewer", signerId: "case11-risk-reviewer", status: "signed" },
        fairness: { role: "fairness_reviewer", signerId: "case11-fairness-reviewer", status: "signed" },
        safety: { role: "safety_reviewer", signerId: "case11-safety-reviewer", status: "signed" },
      },
      recomputedGateResults: [
        { gate: "risk", result: "pass" },
        { gate: "fairness", result: "pass" },
        { gate: "safety", result: "pass" },
      ],
      decision: "approve",
      createdBy: "case11-release-manager",
      decisionBy: "case11-admission-chair",
      note: "补测数据与三类准入检查均已复核。",
    };
    expect(command("11", "approve_canary", current, data, "case11-admission-chair")).not.toThrow();
    expect(command("11", "approve_canary", current, {
      ...data,
      gateReviews: { ...data.gateReviews, safety: { role: "safety_reviewer", signerId: "case11-risk-reviewer", status: "signed" } },
    }, "case11-admission-chair")).toThrow("actor_separation_required");
  });

  it("keeps case 12 quality decisions inside the real route and evidence set", () => {
    const payload = {
      investigation_id: "CCI-2026-001",
      route_id: "CN-SC-PZ-01",
      event_id: "CN-CC-01-003",
      temperature_c: 9.3,
    };
    const base = {
      aggregateType: "cold_chain_investigation",
      investigationId: payload.investigation_id,
      routeId: payload.route_id,
      routeEventIds: ["CN-CC-01-001", "CN-CC-01-002", "CN-CC-01-003", "CN-CC-01-004"],
      investigationWindow: { start: "08:00", end: "08:20", sourceTimeRange: { start: "08:00", end: "08:20" } },
      observations: { maxTemperatureC: 9.3, excursionEventIds: ["CN-CC-01-003", "CN-CC-01-004"] },
      evidenceGaps: ["handoff_record"],
      supplementalEvidence: {
        evidenceId: "HANDOFF-CCI-001",
        type: "handoff_record",
        summary: "收货端补签交接单",
        recordedAtEventId: "CN-CC-01-004",
        verificationStatus: "verified",
      },
      qualityDecision: "cosign",
      freezeScope: null,
      createdBy: "case12-quality-reviewer",
      decisionBy: "case12-quality-supervisor",
      note: "补录交接记录已由质量角色核验。",
    };
    const current = projection("12", "调查中", payload, {
      investigationId: payload.investigation_id,
      routeId: payload.route_id,
      createdBy: "case12-quality-reviewer",
    });
    expect(command("12", "quality_cosign", current, base, "case12-quality-supervisor", ["supplement:HANDOFF-CCI-001"])).not.toThrow();
    expect(command("12", "quality_cosign", current, {
      ...base,
      supplementalEvidence: { ...base.supplementalEvidence, recordedAtEventId: "OTHER-ROUTE" },
    }, "case12-quality-supervisor", ["supplement:HANDOFF-CCI-001"])).toThrow("cold_chain_evidence_mismatch");
  });
});
