// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { MemberTrialWorkbench } from "../src/components/workbenches/case-specific/MemberTrialWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const rows = [
  { user_id: "U001", buy_count: "3", cart_count: "5", view_count: "12", engagement_score: "70", value_segment: "观察" },
  { user_id: "U002", buy_count: "4", cart_count: "6", view_count: "14", engagement_score: "82", value_segment: "观察" },
  { user_id: "U003", buy_count: "5", cart_count: "7", view_count: "16", engagement_score: "94", value_segment: "成长" },
  { user_id: "U004", buy_count: "6", cart_count: "8", view_count: "18", engagement_score: "106", value_segment: "成长" },
];

function projection(state = "待入组", task?: Record<string, unknown>): CaseProjection {
  return {
    caseId: "02",
    objectId: "02-U004",
    state,
    version: state === "待入组" ? 0 : 1,
    payload: rows[3],
    task,
    updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  const selected = projection();
  return {
    definition: getCaseDefinition("02")!,
    objects: rows.map((row, index) => ({ ...projection(), objectId: `02-${row.user_id}`, payload: row, version: 0, updatedAt: `2026-07-26T08:0${index}:00.000Z` })),
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 5000,
    sceneRows: rows,
    supportingArtifacts: {},
    actorRole: "operator",
    roles: ["operator", "supervisor"],
    commands: [{ id: "design_trial", label: "提交首批试投名单", tone: "secondary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("MemberTrialWorkbench domain task", () => {
  it("requires a testable experiment and submits a deterministic treatment/control task", () => {
    const onCommand = vi.fn();
    render(<MemberTrialWorkbench {...props({ onCommand })} />);

    const submit = screen.getByRole("button", { name: "提交首批试投名单" });
    fireEvent.change(screen.getByLabelText("实验假设"), { target: { value: "" } });
    expect(submit).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("填写实验假设");

    fireEvent.change(screen.getByLabelText("实验假设"), { target: { value: "处理组的 7 日核销率高于同期对照组" } });
    fireEvent.change(screen.getByLabelText("确定性分组种子"), { target: { value: "member-coupon-2026-v2" } });
    fireEvent.change(screen.getByLabelText("试投主指标"), { target: { value: "7 日核销率" } });
    fireEvent.change(screen.getByLabelText("试投护栏指标"), { target: { value: "退款客诉率不高于对照组" } });
    fireEvent.change(screen.getByLabelText("试投方案备注"), { target: { value: "只审批名单，不声称真实增量" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledTimes(1);
    const [command, reason, options] = onCommand.mock.calls[0]!;
    expect(command).toBe("design_trial");
    expect(reason).toContain("trial-plan:");
    expect(options.data).toMatchObject({
      planName: "8 元券首批试投",
      hypothesis: "处理组的 7 日核销率高于同期对照组",
      cohort: { behaviourKey: "view_count", minimum: 0, segment: "全部", eligibleCount: 4 },
      assignment: { seed: "member-coupon-2026-v2", treatmentPercent: 80, sampleSize: 4 },
      measurement: { primaryMetric: "7 日核销率", guardrailMetric: "退款客诉率不高于对照组", observationDays: 7 },
      budget: { couponValueCny: 8, ceilingCny: 3000, estimatedCny: 24 },
      stopRule: { maxTreatments: 2, maxBudgetCny: 3000 },
    });
    expect(options.data.assignment.treatmentUserIds).toHaveLength(3);
    expect(options.data.assignment.controlUserIds).toHaveLength(1);
    expect(new Set([...options.data.assignment.treatmentUserIds, ...options.data.assignment.controlUserIds]).size).toBe(4);
    expect(options.idempotencyKey).toMatch(/^case-02:02-U004:design_trial:v0:/);
    expect(options.evidenceIds).toContain("DATA-02");
  });

  it("restores the versioned trial task for an independent supervisor decision", () => {
    const task = {
      planName: "成长会员 8 元券试投",
      hypothesis: "成长会员处理组的 7 日核销率高于对照组",
      cohort: { behaviourKey: "buy_count", minimum: 4, segment: "成长", eligibleCount: 2 },
      assignment: { seed: "growth-v1", sampleSize: 2, treatmentUserIds: ["U003"], controlUserIds: ["U004"] },
      measurement: { primaryMetric: "7 日核销率", guardrailMetric: "客诉率不高于对照组", observationDays: 10 },
      budget: { couponValueCny: 8, ceilingCny: 100, estimatedCny: 8 },
      stopRule: { maxTreatments: 1, maxBudgetCny: 80 },
      note: "审批后仍需真实投放才能判断结果",
    };
    const selected = projection("试投待审", task);
    const onCommand = vi.fn();
    const onActorRoleChange = vi.fn();
    render(<MemberTrialWorkbench {...props({
      selected,
      objects: [selected],
      actorRole: "supervisor",
      commands: [{ id: "start_trial", label: "确认首批名单", tone: "secondary" }],
      onCommand,
      onActorRoleChange,
    })} />);

    expect(screen.getByLabelText("试投方案名称")).toHaveValue("成长会员 8 元券试投");
    expect(screen.getByLabelText("确定性分组种子")).toHaveValue("growth-v1");
    expect(screen.getByLabelText("试投观察天数")).toHaveValue(10);
    expect(screen.queryByText("名单已确认，尚未投放")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认首批名单" }));
    fireEvent.change(screen.getByLabelText("当前操作角色"), { target: { value: "operator" } });
    expect(onCommand).toHaveBeenCalledWith("start_trial", undefined);
    expect(onActorRoleChange).toHaveBeenCalledWith("operator");
  });

  it("disables unsupported exclusion controls and offers focused error recovery", () => {
    const onSelect = vi.fn();
    render(<MemberTrialWorkbench {...props({ error: "版本已更新，请刷新。", onSelect })} />);
    const unavailableExclusions = screen.getByLabelText("排除字段：待补");
    expect(unavailableExclusions).toHaveTextContent("黑名单 / 活动冲突");
    expect(unavailableExclusions).toHaveTextContent("会员平台未提供字段，不能按 0 人处理");
    fireEvent.click(screen.getByRole("button", { name: "刷新当前会员" }));
    expect(onSelect).toHaveBeenCalledWith("02-U004");
  });
});
