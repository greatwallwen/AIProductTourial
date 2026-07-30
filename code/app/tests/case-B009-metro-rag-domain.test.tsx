// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { MetroCompressorWorkbench } from "../src/components/workbenches/case-specific/MetroCompressorWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const rows = [
  { investigation_id: "telemetry-gap", source_row_index: "5626540", timestamp: "2020-04-18 00:18:07", TP2: "-0.018", TP3: "8.248", H1: "8.238", DV_pressure: "-0.024", Oil_temperature: "49.45", Motor_current: "0.04", known_failure_window: "True" },
  { investigation_id: "telemetry-gap", source_row_index: "5626550", timestamp: "2020-04-18 00:23:59", TP2: "8.384", TP3: "8.172", H1: "-0.008", DV_pressure: "1.852", Oil_temperature: "68.525", Motor_current: "5.675", known_failure_window: "True" },
];

const knowledge = [
  { id: "DOC-SOURCE", type: "source-fact", title: "MetroPT-3 数据来源事实", source: "UCI 791", version: "v1", content: "公开连续切片。", boundary: "不是实时监控或故障诊断。" },
  { id: "DOC-OIL", type: "field-definition", title: "油温字段说明", source: "UCI 791", version: "v1", content: "Oil_temperature 表示油温。", boundary: "字段事实，不给出维修原因。" },
  { id: "DOC-PROC", type: "inspection-procedure", title: "现场检查顺序", source: "课程检查规则", version: "v2", content: "先核对样本、来源和传感记录。", boundary: "不是厂商维修手册。" },
  { id: "DOC-APPROVAL", type: "approval-policy", title: "人工审批要求", source: "课程检查规则", version: "v1", content: "现场目视检查申请必须由主管复核。", boundary: "不自动停机、维修或控制设备。" },
];

function projection(state = "待检索", task?: Record<string, unknown>): CaseProjection {
  return {
    caseId: "B009",
    objectId: "09-telemetry-gap",
    state,
    version: state === "待检索" ? 0 : 1,
    payload: rows[0],
    task,
    updatedAt: "2026-07-27T08:00:00.000Z",
  };
}

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  const selected = projection();
  return {
    definition: getCaseDefinition("B009")!,
    objects: [selected],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 4090,
    sceneRows: rows,
    supportingArtifacts: { "knowledge.jsonl": knowledge },
    actorRole: "engineer",
    roles: ["engineer", "supervisor"],
    commands: [{ id: "run_retrieval", label: "核对本地资料", tone: "primary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("MetroCompressorWorkbench deterministic local material review", () => {
  it("persists a window and measurement-specific local review task", () => {
    const onCommand = vi.fn();
    render(<MetroCompressorWorkbench {...props({ onCommand })} />);

    fireEvent.click(screen.getByRole("button", { name: "选择油温" }));
    fireEvent.change(screen.getByLabelText("资料核对问题"), { target: { value: "油温恢复后变化需要补充哪些现场检查记录？" } });
    fireEvent.click(screen.getByRole("button", { name: "核对本地资料" }));

    const [command, , options] = onCommand.mock.calls[0]!;
    expect(command).toBe("run_retrieval");
    expect(options.data.retrieval).toMatchObject({
      investigationId: "telemetry-gap",
      question: "油温恢复后变化需要补充哪些现场检查记录？",
      activeTrace: "Oil_temperature",
      timestamp: "2020-04-18 00:18:07",
      windowStart: "2020-04-18 00:18:07",
      windowEnd: "2020-04-18 00:23:59",
      createdBy: "case09-duty-engineer",
    });
    expect(options.data.retrieval.query).toContain("油温");
    expect(options.data.retrieval.rankedResults[0].id).toBe("DOC-OIL");
    expect(options.data.retrieval.rankedResults.map((item: { id: string }) => item.id)).toContain("DOC-APPROVAL");
    expect(options.evidenceIds).toContain("DOC-OIL@v1");
  });

  it("separates public facts from course inspection rules", () => {
    render(<MetroCompressorWorkbench {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: /本地资料 4/u }));

    expect(screen.getByRole("heading", { name: "公开数据事实" })).toBeVisible();
    expect(screen.getByText("MetroPT-3 数据来源事实")).toBeVisible();
    expect(screen.getByRole("heading", { name: "课程检查规则" })).toBeVisible();
    expect(screen.getByText("人工审批要求")).toBeVisible();
  });

  it("restores the persisted review without claiming unverified integrations", () => {
    const retrieval = {
      question: "油温恢复后变化需要补充哪些现场检查记录？",
      query: "油温 故障窗口 现场检查",
      activeTrace: "Oil_temperature",
      timestamp: "2020-04-18 00:18:07",
      windowStart: "2020-04-18 00:18:07",
      windowEnd: "2020-04-18 00:23:59",
      rankedResults: [
        { id: "DOC-OIL", title: "油温字段说明", score: 15, stance: "support", source: "UCI 791", version: "v1" },
        { id: "DOC-APPROVAL", title: "人工审批要求", score: 8, stance: "constraint", source: "课程检查规则", version: "v1" },
      ],
      createdBy: "case09-duty-engineer",
    };
    const selected = projection("资料待核验", { retrieval });
    render(<MetroCompressorWorkbench {...props({ selected, objects: [selected], actorRole: "supervisor", commands: [{ id: "hold_investigation", label: "请求补充设备记录", tone: "primary" }] })} />);

    expect(screen.getByLabelText("资料核对问题")).toHaveValue("油温恢复后变化需要补充哪些现场检查记录？");
    expect(screen.getByRole("button", { name: "选择油温" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("资料来源").closest("li")).toHaveTextContent("已通过");

    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/MetroCompressorWorkbench.tsx"), "utf8");
    expect(source).not.toContain("Agentic RAG");
    expect(source).not.toContain("MCP");
    expect(source).not.toContain("模型已验证");
  });
});
