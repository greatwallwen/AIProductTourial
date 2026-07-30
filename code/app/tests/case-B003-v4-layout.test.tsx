// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { ReviewResearchWorkbench } from "../src/components/workbenches/case-specific/ReviewResearchWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(cleanup);

function review(id: string, body: string, hospitality: number): CaseProjection {
  return {
    caseId: "B003",
    objectId: `03-${id}`,
    state: "待研判",
    version: 0,
    payload: {
      id,
      review: body,
      star: hospitality < 0 ? "1" : "5",
      "Service#Hospitality": String(hospitality),
      "Service#Queue": "0",
      "Service#Timely": "0",
      "Food#Taste": "0",
      source_id: "DATA-03",
    },
    updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

const selected = review("5353", "叫了四五个服务员都说没空，后来还拿着单子质问我们。", -1);
const counter = review("1948", "服务员主动处理问题，服务还不错。", 1);

function props(): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B003")!,
    objects: [selected, counter],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 6970,
    sceneRows: [selected.payload, counter.payload],
    supportingArtifacts: {},
    actorRole: "operator",
    roles: ["operator", "supervisor"],
    commands: [{ id: "create_validation_task", label: "创建需求验证单", tone: "primary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
  };
}

describe("case 03 v4 differentiated layout", () => {
  it("makes one review, one hypothesis and two opposing evidence seats the visible product", () => {
    render(<ReviewResearchWorkbench {...props()} />);

    expect(screen.getByText("评论调查台")).toBeVisible();
    expect(screen.getByRole("region", { name: "评论原文与出处" })).toBeVisible();
    expect(screen.getByRole("region", { name: "要查清的问题" })).toBeVisible();
    expect(screen.getByRole("group", { name: "支持这个判断的原话" })).toBeVisible();
    expect(screen.getByRole("group", { name: "不支持这个判断的原话" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "研究任务" })).toBeVisible();
    expect(screen.getByText(/DATA-03/)).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/门店名称|因果结论|AI 置信度|预测提升/)).not.toBeInTheDocument();
  });
});
