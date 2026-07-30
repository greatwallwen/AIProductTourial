// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { MemberTrialWorkbench } from "../src/components/workbenches/case-specific/MemberTrialWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const rows = [
  { user_id: "U00001", buy_count: "4", cart_count: "8", view_count: "12", engagement_score: "80", value_segment: "观察" },
  { user_id: "U00002", buy_count: "8", cart_count: "10", view_count: "12", engagement_score: "112", value_segment: "成长" },
  { user_id: "U00003", buy_count: "10", cart_count: "11", view_count: "12", engagement_score: "128", value_segment: "活跃" },
  { user_id: "U00004", buy_count: "12", cart_count: "12", view_count: "12", engagement_score: "144", value_segment: "核心" },
];

function projection(row: Record<string, unknown>, index: number, state = "待入组"): CaseProjection {
  return {
    caseId: "B002",
    objectId: `02-${String(row.user_id ?? index)}`,
    state,
    version: state === "待入组" ? 0 : 1,
    payload: row,
    updatedAt: "2026-07-25T08:00:00.000Z",
  };
}

const objects = rows.map(projection);

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B002")!,
    objects,
    selected: objects[3]!,
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

describe("MemberTrialWorkbench", () => {
  it("matches the constellation trial product and uses real cohort counts", () => {
    render(<MemberTrialWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "8 元券首批试投" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "目标人群构建" })).toBeVisible();
    expect(screen.getByRole("region", { name: "首批试投名单" })).toBeVisible();
    expect(screen.getByRole("region", { name: "人群分组图" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "实验护栏" })).toBeVisible();
    expect(screen.getByText("数据使用边界")).toBeVisible();
    expect(screen.getByText(/不展示购买力、预计增量、转化或 GMV/)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "试投成员表" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("处理组比例")).toHaveValue(80);
  });

  it("filters the loaded dataset by behaviour and value segment", () => {
    render(<MemberTrialWorkbench {...props()} />);
    const filters = screen.getByRole("complementary", { name: "目标人群构建" });

    fireEvent.click(within(filters).getByRole("button", { name: "购买" }));
    fireEvent.change(within(filters).getByLabelText("行为次数下限"), { target: { value: "10" } });
    fireEvent.change(within(filters).getByLabelText("会员价值分层"), { target: { value: "核心" } });

    expect(within(filters).getByLabelText("可抽样：1")).toBeVisible();
    const constellation = screen.getByRole("region", { name: "人群分组图" });
    expect(within(constellation).getByRole("button", { name: /会员 U00004 · (处理组|对照组)/ })).toBeVisible();
    expect(within(constellation).queryByRole("button", { name: /会员 U00003/ })).not.toBeInTheDocument();
  });

  it("blocks an over-budget draft and submits valid plan parameters as an auditable reason", () => {
    const onCommand = vi.fn();
    render(<MemberTrialWorkbench {...props({ onCommand })} />);
    const submit = screen.getByRole("button", { name: "提交首批试投名单" });

    fireEvent.change(screen.getByLabelText("试投预算上限"), { target: { value: "10" } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("试投预算上限"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("试投方案备注"), { target: { value: "验证真实响应" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0]?.[0]).toBe("design_trial");
    expect(String(onCommand.mock.calls[0]?.[1])).toContain("trial-plan:");
    expect(String(onCommand.mock.calls[0]?.[1])).toContain('"budget":5000');
    expect(String(onCommand.mock.calls[0]?.[1])).toContain("验证真实响应");
  });

  it("restores submitted plan parameters after reload and keeps supervisor decisions executable", () => {
    const reason = 'trial-plan:{"sampleSize":300,"budget":3600,"stopCount":300,"stopBudget":3000,"planName":"核心会员首批名单","note":"先验证领取和核销"}';
    const event: CaseEvent = {
      eventId: "evt-02-1",
      caseId: "B002",
      objectId: objects[3]!.objectId,
      command: "design_trial",
      actor: { id: "operator", role: "operator" },
      fromState: "待入组",
      toState: "试投待审",
      version: 1,
      reason,
      evidenceIds: ["dataset-row"],
      occurredAt: "2026-07-25T08:10:00.000Z",
    };
    const onCommand = vi.fn();
    const selected = projection(rows[3]!, 3, "试投待审");
    render(<MemberTrialWorkbench {...props({
      objects: [selected, ...objects.slice(0, 3)],
      selected,
      events: [event],
      actorRole: "supervisor",
      commands: [
        { id: "start_trial", label: "确认首批名单", tone: "secondary" },
        { id: "stop_trial", label: "退回名单调整", tone: "secondary" },
      ],
      onCommand,
    })} />);

    expect(screen.getByLabelText("试投样本规模")).toHaveValue(300);
    expect(screen.getByLabelText("试投预算上限")).toHaveValue(3600);
    expect(screen.getByLabelText("试投方案名称")).toHaveValue("核心会员首批名单");
    expect(screen.getByLabelText("试投方案备注")).toHaveValue("先验证领取和核销");
    fireEvent.click(screen.getByRole("button", { name: "确认首批名单" }));
    expect(onCommand).toHaveBeenCalledWith("start_trial", undefined);
  });
});
