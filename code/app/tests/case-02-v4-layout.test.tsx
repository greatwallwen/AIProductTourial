// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { MemberTrialWorkbench } from "../src/components/workbenches/case-specific/MemberTrialWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(cleanup);

const rows = Array.from({ length: 20 }, (_, index) => ({
  user_id: `U${String(index + 1).padStart(3, "0")}`,
  buy_count: String(index % 5),
  cart_count: String(index % 7),
  view_count: String(index),
  engagement_score: String(index + (index % 7) * 3 + (index % 5) * 8),
  value_segment: index % 2 === 0 ? "成长" : "观察",
}));

function projection(payload: Record<string, unknown>): CaseProjection {
  return {
    caseId: "02",
    objectId: `02-${String(payload.user_id)}`,
    state: "待入组",
    version: 0,
    payload,
    updatedAt: "2026-07-27T08:00:00.000Z",
  };
}

function props(): CaseWorkbenchProps {
  const objects = rows.map(projection);
  return {
    definition: getCaseDefinition("02")!,
    objects,
    selected: objects[0]!,
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
  };
}

describe("Case 02 V4 8 元券首批试投", () => {
  it("以筛选收敛和人群星图为主舞台，不再默认展示成员表格墙", () => {
    render(<MemberTrialWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "8 元券首批试投" })).toBeVisible();
    expect(screen.getByRole("region", { name: "人群分组图" })).toBeVisible();
    expect(screen.getByRole("region", { name: "筛选收敛路径" })).toBeVisible();
    expect(screen.queryByRole("table", { name: "试投成员表" })).not.toBeInTheDocument();
    expect(screen.queryByText(/预计转化|预计收益|AI 评分/)).not.toBeInTheDocument();
  });

  it("在星图中切换组别并下钻真实成员行为", () => {
    render(<MemberTrialWorkbench {...props()} />);

    fireEvent.click(screen.getByRole("button", { name: "查看处理组名单" }));
    const constellation = screen.getByRole("region", { name: "人群分组图" });
    const treatmentNodes = within(constellation).getAllByRole("button", { name: /会员 U\d+ · 处理组/ });
    expect(treatmentNodes.length).toBeGreaterThan(0);
    expect(within(constellation).queryByRole("button", { name: /会员 U\d+ · 对照组/ })).not.toBeInTheDocument();

    fireEvent.click(treatmentNodes[0]!);
    const detail = screen.getByLabelText("成员入组说明");
    expect(detail).toHaveTextContent(/U\d+ · 处理组/);
    expect(detail).toHaveTextContent(/浏览|加购|购买/);
  });

  it("把 ¥8 预算、指标与停止线放在可操作的实验护栏中", () => {
    render(<MemberTrialWorkbench {...props()} />);
    const guardrails = screen.getByRole("complementary", { name: "实验护栏" });

    expect(within(guardrails).getByText("¥8")).toBeVisible();
    expect(within(guardrails).getByLabelText("试投预算上限")).toHaveValue(3000);
    expect(within(guardrails).getByLabelText("试投主指标")).toHaveValue("7 日核销率");
    expect(within(guardrails).getByLabelText("按样本规模停止")).toHaveValue(10);
    expect(within(guardrails).getByLabelText("按预算上限停止")).toHaveValue(3000);
  });
});
