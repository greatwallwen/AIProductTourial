// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CaseEvent, CaseProjection, CommandResult } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { ModelAdmissionWorkbench } from "../src/components/workbenches/case-specific/ModelAdmissionWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const rows = [
  { evaluation_id: "EVAL-11-001", candidate_id: "MODEL-ADMISSION-001", gate: "risk", metric_label: "无证据陈述率", metric_value: "0.032", comparator: "<=", threshold: "0.04", sample_size: "800", slice_id: "knowledge-qa", evidence_status: "complete", result: "pass", policy_version: "MODEL-GATE-2026.1" },
  { evaluation_id: "EVAL-11-004", candidate_id: "MODEL-ADMISSION-001", gate: "fairness", metric_label: "地区切片准确率差", metric_value: "0.047", comparator: "<=", threshold: "0.03", sample_size: "720", slice_id: "east-west", evidence_status: "missing_slice", result: "evidence_required", policy_version: "MODEL-GATE-2026.1" },
  { evaluation_id: "EVAL-11-007", candidate_id: "MODEL-ADMISSION-001", gate: "safety", metric_label: "高风险请求拒答率", metric_value: "0.991", comparator: ">=", threshold: "0.98", sample_size: "900", slice_id: "high-risk", evidence_status: "complete", result: "pass", policy_version: "MODEL-GATE-2026.1" },
];

const objects: CaseProjection[] = rows.map((payload) => ({ caseId: "B011", objectId: `11-${payload.evaluation_id}-${payload.candidate_id}`, state: "待会签", version: 0, payload, updatedAt: "2026-07-26T05:00:00.000Z" }));
const selected = objects[1];

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B011")!, objects, selected, events: [], metrics: [], datasetRowCount: 3, sceneRows: rows,
    supportingArtifacts: {}, actorRole: "release_manager", roles: ["release_manager", "supervisor"],
    commands: [{ id: "request_release_evidence", label: "发起地区切片补测", tone: "secondary" }], busy: false,
    onActorRoleChange: vi.fn(), onCommand: vi.fn(), onReset: vi.fn(), onSelect: vi.fn(), ...overrides,
  };
}

function event(data: Record<string, unknown>): CaseEvent {
  return { eventId: "evt-11-domain", caseId: "B011", objectId: selected.objectId, command: "request_release_evidence", actor: { id: "release_manager", role: "release_manager" }, fromState: "待会签", toState: "补测中", version: 1, evidenceIds: [], data, occurredAt: "2026-07-26T06:00:00.000Z" };
}

describe("case 11 candidate admission aggregate", () => {
  it("submits one typed candidate aggregate with a stable idempotency key", () => {
    const onCommand = vi.fn();
    render(<ModelAdmissionWorkbench {...props({ onCommand })} />);

    fireEvent.change(screen.getByLabelText("补测目标样本量"), { target: { value: "1500" } });
    fireEvent.change(screen.getByLabelText("补测数据版本"), { target: { value: "region-slice-2026.2" } });
    fireEvent.change(screen.getByLabelText("会签说明"), { target: { value: "补齐东西部切片" } });
    const submit = screen.getByRole("button", { name: "发起地区切片补测" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledTimes(2);
    const options = onCommand.mock.calls[0][2];
    expect(options.idempotencyKey).toBe("case-B011:candidate:MODEL-ADMISSION-001:request_release_evidence:v0");
    expect(onCommand.mock.calls[1][2].idempotencyKey).toBe(options.idempotencyKey);
    expect(options.data).toEqual(expect.objectContaining({
      aggregateType: "model_admission_candidate",
      candidateId: "MODEL-ADMISSION-001",
      selectedEvaluationId: "EVAL-11-004",
      serverValidationRequired: true,
      retest: expect.objectContaining({ datasetVersion: "region-slice-2026.2", targetSampleSize: 1500, metricValue: null, computedResult: "pending" }),
    }));
    expect(options.data.gateSet).toHaveLength(3);
    expect(options.evidenceIds).toEqual(["evaluation:EVAL-11-001", "evaluation:EVAL-11-004", "evaluation:EVAL-11-007"]);
  });

  it("merges event, selected.task, and receipt data before chairman approval", () => {
    const pending: CaseProjection = {
      ...selected, state: "补测中", version: 1,
      task: { candidateVersion: "candidate-v2", retest: { targetSampleSize: 1600, datasetVersion: "region-slice-2026.2", metricValue: 0.025 } },
    };
    const historical = event({ note: "补测数据已回传" });
    const receiptEvent = event({ gateReviews: { risk: { status: "signed" }, fairness: { status: "signed" }, safety: { status: "signed" } } });
    const receipt: CommandResult = { receiptId: "receipt-11", inputHash: "input", eventHash: "event", projection: pending, event: receiptEvent, duplicate: false };
    const onCommand = vi.fn();
    render(<ModelAdmissionWorkbench {...props({ selected: pending, objects: [objects[0], pending, objects[2]], events: [historical], receipt, actorRole: "supervisor", commands: [{ id: "approve_canary", label: "确认补测已完成", tone: "primary" }], onCommand })} />);

    expect(screen.getAllByText("candidate-v2")).toHaveLength(2);
    expect(screen.getByLabelText("补测数据版本")).toHaveValue("region-slice-2026.2");
    expect(screen.getByLabelText("补测实测值")).toHaveValue("0.025");
    expect(screen.getByLabelText("会签说明")).toHaveValue("补测数据已回传");
    expect(screen.getByText(/三类准入检查全部通过/)).toBeVisible();
    const approve = screen.getByRole("button", { name: "确认补测已完成" });
    expect(approve).toBeEnabled();
    fireEvent.click(approve);

    expect(onCommand.mock.calls[0][2]).toEqual(expect.objectContaining({
      idempotencyKey: "case-B011:candidate:MODEL-ADMISSION-001:approve_canary:v1",
      data: expect.objectContaining({ candidateId: "MODEL-ADMISSION-001", candidateVersion: "candidate-v2", decision: "approve", recomputedGateResults: [{ gate: "risk", result: "pass" }, { gate: "fairness", result: "pass" }, { gate: "safety", result: "pass" }] }),
    }));
  });

  it("blocks chairman decisions when reviews or a rejection reason are missing", () => {
    const pending = { ...selected, state: "补测中", version: 1, task: { retest: { targetSampleSize: 1600, datasetVersion: "v2", metricValue: 0.025 } } };
    render(<ModelAdmissionWorkbench {...props({ selected: pending, actorRole: "release_manager", commands: [{ id: "approve_canary", label: "确认补测已完成" }, { id: "reject_candidate", label: "拒绝发布候选", tone: "danger" }] })} />);
    expect(screen.getByRole("button", { name: "确认补测已完成" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "拒绝发布候选" })).toBeDisabled();
  });
});
