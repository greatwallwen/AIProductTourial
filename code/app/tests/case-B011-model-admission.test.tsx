// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { ModelAdmissionWorkbench } from "../src/components/workbenches/case-specific/ModelAdmissionWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const rows = [
  ["EVAL-11-001", "risk", "无证据陈述率", "0.032", "<=", "0.04", "800", "knowledge-qa", "complete", "pass"],
  ["EVAL-11-002", "risk", "个人信息回显率", "0.002", "<=", "0.005", "500", "privacy-probe", "complete", "pass"],
  ["EVAL-11-003", "risk", "结构化输出成功率", "0.997", ">=", "0.995", "600", "json-contract", "complete", "pass"],
  ["EVAL-11-004", "fairness", "地区切片准确率差", "0.047", "<=", "0.03", "720", "east-west", "missing_slice", "evidence_required"],
  ["EVAL-11-005", "fairness", "方言拒答率差", "0.021", "<=", "0.03", "640", "dialect", "complete", "pass"],
  ["EVAL-11-006", "fairness", "年龄表达风格差", "0.018", "<=", "0.025", "600", "age-language", "complete", "pass"],
  ["EVAL-11-007", "safety", "高风险请求拒答率", "0.991", ">=", "0.98", "900", "high-risk", "complete", "pass"],
  ["EVAL-11-008", "safety", "有害完成率", "0.003", "<=", "0.005", "900", "harmful", "complete", "pass"],
  ["EVAL-11-009", "safety", "提示注入阻断率", "0.976", ">=", "0.97", "750", "injection", "complete", "pass"],
].map(([evaluation_id, gate, metric_label, metric_value, comparator, threshold, sample_size, slice_id, evidence_status, result]) => ({
  evaluation_id,
  candidate_id: "MODEL-ADMISSION-001",
  gate,
  metric_label,
  metric_value,
  comparator,
  threshold,
  sample_size,
  slice_id,
  evidence_status,
  result,
  policy_version: "MODEL-GATE-2026.1",
}));

const objects: CaseProjection[] = rows.map((payload) => ({
  caseId: "B011",
  objectId: `B011-${payload.evaluation_id}-MODEL-ADMISSION-001`,
  state: "待会签",
  version: 0,
  payload,
  updatedAt: "2026-07-26T05:00:00.000Z",
}));
const selected = objects[3];

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B011")!,
    objects,
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 9,
    sceneRows: rows,
    supportingArtifacts: {},
    actorRole: "release_manager",
    roles: ["release_manager", "supervisor"],
    commands: [{ id: "request_release_evidence", label: "发起地区切片补测", tone: "secondary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

function pendingCandidate(): CaseProjection {
  return {
    ...selected,
    state: "补测中",
    version: 1,
    task: {
      candidateId: "MODEL-ADMISSION-001",
      candidateVersion: "candidate-v1",
      createdBy: "case11-release-manager",
      retest: {
        retestId: "RETEST-MODEL-ADMISSION-001-east-west",
        sourceEvaluationId: "EVAL-11-004",
        sliceId: "east-west",
        targetSampleSize: 1200,
        datasetVersion: "region-slice-2026.2",
        metricValue: 0.025,
        evidenceStatus: "complete",
        computedResult: "pass",
      },
    },
  };
}

describe("ModelAdmissionWorkbench", () => {
  it("renders nine real gates and the unique blocker without invented regional scores", () => {
    render(<ModelAdmissionWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "企业模型准入补测" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "候选摘要与三类检查" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "补测流程与主管确认" })).toBeVisible();
    expect(within(screen.getByRole("region", { name: "九项准入检查" })).getAllByRole("button")).toHaveLength(9);

    const blocker = screen.getByRole("button", { name: /地区切片准确率差，实测 0\.047，要求 ≤ 0\.03，样本 720，切片缺失/ });
    expect(blocker).toHaveAttribute("data-blocking", "true");
    const ruler = screen.getByRole("region", { name: "地区切片阈值标尺" });
    expect(within(ruler).getByText("超出门槛 0.017")).toBeVisible();
    expect(within(ruler).getByText("基线只有汇总差值，没有东西部单独成绩")).toBeVisible();
    expect(screen.queryByText(/华东\s*0\.|西部\s*0\./)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "三个独立职责席" })).toBeVisible();
    expect(screen.getByRole("region", { name: "准入主管确认" })).toBeVisible();
    expect(screen.getByText("不是 Qwen 官方结果，也不是生产发布批准。")).toBeVisible();
  });

  it("selects a metric within the same candidate and policy and opens the local report", () => {
    const duplicate: CaseProjection = {
      ...objects[7],
      objectId: "B011-EVAL-11-008-MODEL-ADMISSION-OTHER",
      payload: { ...objects[7].payload, candidate_id: "MODEL-ADMISSION-OTHER" },
    };
    const onSelect = vi.fn();
    render(<ModelAdmissionWorkbench {...props({ objects: [duplicate, ...objects], onSelect })} />);

    fireEvent.click(screen.getByRole("button", { name: /有害完成率，实测 0\.003/ }));
    expect(onSelect).toHaveBeenCalledWith("B011-EVAL-11-008-MODEL-ADMISSION-001");
    fireEvent.click(screen.getByRole("button", { name: "评测报告" }));
    const dialog = screen.getByRole("dialog", { name: "本地评测报告" });
    expect(within(dialog).getAllByRole("row")).toHaveLength(10);
    expect(within(dialog).getByText(/不代表 Qwen 官方结果或企业发布批准/)).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "关闭评测报告" }));
    expect(screen.queryByRole("dialog", { name: "本地评测报告" })).not.toBeInTheDocument();
  });

  it("blocks the retest until all plan fields are valid and submits a pending plan", () => {
    const onCommand = vi.fn();
    const onActorRoleChange = vi.fn();
    render(<ModelAdmissionWorkbench {...props({ onCommand, onActorRoleChange })} />);

    const submit = screen.getByRole("button", { name: "发起地区切片补测" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("补测目标样本量"), { target: { value: "700" } });
    fireEvent.change(screen.getByLabelText("补测数据版本"), { target: { value: "region-slice-2026.2" } });
    fireEvent.change(screen.getByLabelText("会签说明"), { target: { value: "补齐东西部地区切片" } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("补测目标样本量"), { target: { value: "1500" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    fireEvent.change(screen.getByLabelText("当前操作角色"), { target: { value: "supervisor" } });

    expect(onActorRoleChange).toHaveBeenCalledWith("supervisor");
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0][0]).toBe("request_release_evidence");
    expect(JSON.parse(String(onCommand.mock.calls[0][1]).replace("admission-review:", ""))).toEqual({
      sliceId: "east-west",
      targetSampleSize: "1500",
      note: "补齐东西部地区切片",
    });
    expect(onCommand.mock.calls[0][2]).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        selectedEvaluationId: "EVAL-11-004",
        gateSet: expect.arrayContaining([expect.objectContaining({ evaluationId: "EVAL-11-004", gate: "fairness" })]),
        retest: expect.objectContaining({
          datasetVersion: "region-slice-2026.2",
          targetSampleSize: 1500,
          metricValue: null,
          evidenceStatus: "planned",
          computedResult: "pending",
        }),
      }),
      evidenceIds: expect.arrayContaining(["evaluation:EVAL-11-004"]),
    }));
    expect(onCommand.mock.calls[0][2].data.gateSet).toHaveLength(9);
    expect(onCommand.mock.calls[0][2].data.gateSet).toContainEqual({
      evaluationId: "EVAL-11-004",
      gate: "fairness",
      result: "fail",
      evidenceStatus: "missing_slice",
    });
    expect(onCommand.mock.calls[0][2].evidenceIds).toHaveLength(9);
  });

  it("opens the chairman gate only after a passing retest and three independent signatures", () => {
    const pending = pendingCandidate();
    const onCommand = vi.fn();
    render(<ModelAdmissionWorkbench {...props({
      selected: pending,
      objects: objects.map((object) => object.objectId === selected.objectId ? pending : object),
      actorRole: "supervisor",
      commands: [{ id: "approve_canary", label: "确认补测已完成", tone: "primary" }],
      onCommand,
    })} />);

    const approve = screen.getByRole("button", { name: "确认补测已完成" });
    const signatures = ["风险准入检查评审已签署", "公平准入检查评审已签署", "安全准入检查评审已签署"].map((name) => screen.getByRole("checkbox", { name }));
    expect(signatures.every((input) => !input.hasAttribute("disabled"))).toBe(true);
    expect(approve).toBeDisabled();
    signatures.forEach((input) => fireEvent.click(input));
    signatures.forEach((input) => expect(input).toBeChecked());
    expect(approve).toBeEnabled();
    fireEvent.click(approve);

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0][0]).toBe("approve_canary");
    expect(onCommand.mock.calls[0][2].data.gateReviews).toEqual({
      risk: { role: "risk_reviewer", signerId: "case11-risk-reviewer", status: "signed" },
      fairness: { role: "fairness_reviewer", signerId: "case11-fairness-reviewer", status: "signed" },
      safety: { role: "safety_reviewer", signerId: "case11-safety-reviewer", status: "signed" },
    });
    expect(onCommand.mock.calls[0][2].data.recomputedGateResults).toEqual([
      { gate: "risk", result: "pass" },
      { gate: "fairness", result: "pass" },
      { gate: "safety", result: "pass" },
    ]);
  });

  it("shows the accepted retest as the current result after reload instead of keeping the baseline blocker", () => {
    const pending = pendingCandidate();
    const confirmed: CaseProjection = {
      ...pending,
      state: "补测已确认",
      version: 2,
      task: {
        ...pending.task,
        decisionBy: "case11-admission-chair",
        gateReviews: {
          risk: { role: "risk_reviewer", signerId: "case11-risk-reviewer", status: "signed" },
          fairness: { role: "fairness_reviewer", signerId: "case11-fairness-reviewer", status: "signed" },
          safety: { role: "safety_reviewer", signerId: "case11-safety-reviewer", status: "signed" },
        },
      },
    };
    render(<ModelAdmissionWorkbench {...props({
      selected: confirmed,
      objects: objects.map((object) => object.objectId === selected.objectId ? confirmed : object),
      commands: [],
    })} />);

    const summary = screen.getByRole("region", { name: "候选准入摘要" });
    expect(within(summary).getByText("9/9")).toBeVisible();
    expect(within(summary).getByText("补测后通过")).toBeVisible();
    expect(within(summary).getByText("当前阻断").closest("article")).toHaveTextContent("0");
    expect(screen.getByRole("button", { name: /地区切片准确率差，实测 0\.025，要求 ≤ 0\.03，样本 1200，补测记录完整/ })).toBeVisible();
    expect(screen.getByText("低于门槛 0.005")).toBeVisible();
    expect(screen.getByText("签署已记录")).toBeVisible();
    expect(screen.getByText("主管与发起人身份分离")).toBeVisible();
    expect(screen.getByRole("list", { name: "补测步骤" }).querySelectorAll('[data-state="complete"]')).toHaveLength(4);
    expect(screen.getByText("已补测项")).toBeVisible();
  });

  it("keeps rejection locked for the release manager and enables the chairman with a reason", () => {
    const onCommand = vi.fn();
    const common = props({
      commands: [{ id: "reject_candidate", label: "拒绝发布候选", tone: "danger" }],
      onCommand,
    });
    const view = render(<ModelAdmissionWorkbench {...common} />);

    fireEvent.change(screen.getByLabelText("会签说明"), { target: { value: "地区切片材料不完整" } });
    expect(screen.getByRole("button", { name: "拒绝发布候选" })).toBeDisabled();
    view.rerender(<ModelAdmissionWorkbench {...common} actorRole="supervisor" />);
    const reject = screen.getByRole("button", { name: "拒绝发布候选" });
    expect(reject).toBeEnabled();
    fireEvent.click(reject);

    expect(onCommand.mock.calls[0][0]).toBe("reject_candidate");
    expect(onCommand.mock.calls[0][2]).toEqual(expect.objectContaining({
      actorId: "case11-admission-chair",
      data: expect.objectContaining({ decision: "reject", note: "地区切片材料不完整" }),
    }));
  });

  it("restores the review draft and offers focused recovery", () => {
    const event = {
      eventId: "evt-11",
      caseId: "B011",
      objectId: selected.objectId,
      command: "request_release_evidence",
      fromState: "待会签",
      toState: "补测中",
      actor: { id: "release_manager", role: "release_manager" },
      version: 1,
      occurredAt: "2026-07-26T05:15:00.000Z",
      reason: 'admission-review:{"sliceId":"east-west","targetSampleSize":"1800","note":"补测地区切片"}',
      evidenceIds: [],
    } satisfies CaseEvent;
    const onSelect = vi.fn();
    render(<ModelAdmissionWorkbench {...props({ events: [event], error: "对象状态已更新，请刷新后重试。", onSelect })} />);

    expect(screen.getByLabelText("补测目标样本量")).toHaveValue(1800);
    expect(screen.getByLabelText("会签说明")).toHaveValue("补测地区切片");
    fireEvent.click(screen.getByRole("button", { name: "刷新当前检查项" }));
    expect(onSelect).toHaveBeenCalledWith(selected.objectId);
  });

  it("uses one-shot motion with a reduced-motion override", () => {
    const stylesheet = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/ModelAdmissionWorkbench.module.css"), "utf8");
    expect(stylesheet).toMatch(/@keyframes\s+blocking-arrival/);
    expect(stylesheet).not.toMatch(/animation-iteration-count\s*:\s*infinite|animation\s*:[^;]*\binfinite\b/);
    expect(stylesheet).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(stylesheet).toMatch(/animation:\s*none\s*!important/);
  });

  it("keeps server and client markup deterministic", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/ModelAdmissionWorkbench.tsx"), "utf8");
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("typeof window");
    expect(source).not.toContain("new Date(");
    expect(source).not.toMatch(/华东\s+0\.|西部\s+0\./);
  });
});
