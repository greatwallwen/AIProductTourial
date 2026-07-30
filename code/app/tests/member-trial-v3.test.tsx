// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { MemberTrialWorkbench } from "../src/components/workbenches/case-specific/MemberTrialWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(cleanup);

function projection(payload: Record<string, unknown>): CaseProjection {
  return {
    caseId: "02",
    objectId: `02-${String(payload.user_id)}`,
    state: "待入组",
    version: 0,
    payload,
    updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

const memberRows = Array.from({ length: 20 }, (_, index) => ({
  user_id: `U${String(index + 1).padStart(3, "0")}`,
  buy_count: String(index % 5),
  cart_count: String(index % 7),
  view_count: String(index),
  engagement_score: String(index + (index % 7) * 3 + (index % 5) * 8),
  value_segment: index % 2 === 0 ? "成长" : "观察",
}));

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  const objects = memberRows.map(projection);
  return {
    definition: getCaseDefinition("02")!,
    objects,
    selected: objects[0]!,
    events: [],
    metrics: [],
    datasetRowCount: 5000,
    sceneRows: memberRows,
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

describe("Case 02 会员试投 V3", () => {
  it("默认展示真实成员星点，并支持处理组、对照组筛选与成员下钻", () => {
    render(<MemberTrialWorkbench {...props()} />);

    const constellation = screen.getByRole("region", { name: "人群分组图" });
    expect(within(constellation).getAllByRole("button", { name: /会员 U\d+ · (处理组|对照组)/ })).toHaveLength(18);

    fireEvent.click(screen.getByRole("button", { name: "查看处理组名单" }));
    const treatmentNodes = within(constellation).getAllByRole("button", { name: /会员 U\d+ · 处理组/ });
    expect(treatmentNodes.length).toBeGreaterThan(0);
    expect(within(constellation).queryByRole("button", { name: /会员 U\d+ · 对照组/ })).not.toBeInTheDocument();
    fireEvent.click(treatmentNodes[0]!);
    expect(screen.getByLabelText("成员入组说明")).toHaveTextContent(/U\d+ · 处理组/);

    fireEvent.click(screen.getByRole("button", { name: "查看对照组名单" }));
    expect(within(constellation).getAllByRole("button", { name: /会员 U\d+ · 对照组/ }).length).toBeGreaterThan(0);
  });

  it("筛选链路展示可复算漏斗，不把待补排除字段伪装为零", () => {
    render(<MemberTrialWorkbench {...props()} />);
    const funnel = screen.getByLabelText("人群筛选漏斗");

    expect(within(funnel).getByLabelText("全部记录：20")).toBeVisible();
    fireEvent.change(screen.getByLabelText("行为次数下限"), { target: { value: "10" } });
    expect(within(funnel).getByLabelText("阈值命中：10")).toBeVisible();
    fireEvent.change(screen.getByLabelText("会员价值分层"), { target: { value: "成长" } });
    expect(within(funnel).getByLabelText("分层命中：5")).toBeVisible();
    expect(within(funnel).getByLabelText("排除字段：待补")).toBeVisible();
    expect(within(funnel).getByLabelText("可抽样：5")).toBeVisible();
  });

  it("概览只展示事实 KPI，并联动样本、预算和人数差", () => {
    render(<MemberTrialWorkbench {...props()} />);
    const overview = screen.getByLabelText("试投运行概览");

    expect(within(overview).getByLabelText("候选人数")).toHaveTextContent("20");
    expect(within(overview).getByLabelText("抽样人数")).toHaveTextContent("20");
    expect(within(overview).getByLabelText("处理组人数")).toHaveTextContent("16");
    expect(within(overview).getByLabelText("券面预算")).toHaveTextContent("¥128");
    expect(within(overview).getByLabelText("预算使用率")).toHaveTextContent("4.3%");
    expect(within(overview).getByLabelText("人数差")).toHaveTextContent("12");
    expect(overview).not.toHaveTextContent(/GMV|转化|预计提升/);

    fireEvent.change(screen.getByLabelText("试投样本规模"), { target: { value: "9" } });
    expect(within(overview).getByLabelText("抽样人数")).toHaveTextContent("9");
    expect(within(overview).getByLabelText("券面预算")).toHaveTextContent("¥56");
    expect(within(overview).getByLabelText("人数差")).toHaveTextContent("5");
  });

  it("主操作有独立停靠区，短动效为减少动态偏好提供关闭规则", () => {
    render(<MemberTrialWorkbench {...props()} />);
    expect(screen.getByLabelText("试投提交操作")).toContainElement(
      screen.getByRole("button", { name: "提交首批试投名单" }),
    );

    const stylesheet = readFileSync(
      resolve(process.cwd(), "src/components/workbenches/case-specific/MemberTrialWorkbenchV3.module.css"),
      "utf8",
    );
    expect(stylesheet).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(stylesheet).not.toMatch(/animation-iteration-count:\s*infinite/);
  });
});
