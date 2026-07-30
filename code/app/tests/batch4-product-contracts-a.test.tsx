// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { FlotationReviewWorkbench } from "../src/components/workbenches/case-specific/FlotationReviewWorkbench";
import { MetroCompressorWorkbench } from "../src/components/workbenches/case-specific/MetroCompressorWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const knowledge = [
  { id: "DOC-TP2", type: "field-definition", title: "TP2 排气压力字段说明", source: "UCI 791", version: "v1", content: "TP2 表示排气压力。", boundary: "字段事实，不是诊断结论。" },
  { id: "DOC-APPROVAL", type: "approval-policy", title: "人工审批边界", source: "课程策略", version: "v1", content: "现场检查必须由主管批准。", boundary: "不能将检索结果当作故障诊断。" },
];

const metroGapRows = [
  { source_row_index: "5626000", timestamp: "2020-04-18 00:18:07", TP2: "-0.018", TP3: "8.248", H1: "8.238", DV_pressure: "-0.024", Oil_temperature: "49.45", Motor_current: "0.04", known_failure_window: "True" },
  { source_row_index: "5626001", timestamp: "2020-04-18 00:23:59", TP2: "-0.016", TP3: "8.250", H1: "8.240", DV_pressure: "-0.022", Oil_temperature: "49.61", Motor_current: "0.06", known_failure_window: "True" },
];

function metroProjection(task?: Record<string, unknown>): CaseProjection {
  return {
    caseId: "B009",
    objectId: "09-gap-window",
    state: "待检索",
    version: 0,
    payload: metroGapRows[1]!,
    task,
    updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

function metroProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  const selected = metroProjection();
  return {
    definition: getCaseDefinition("B009")!,
    objects: [selected], selected, events: [], metrics: [], datasetRowCount: 4090,
    sceneRows: metroGapRows, supportingArtifacts: { "knowledge.jsonl": knowledge },
    actorRole: "engineer", roles: ["engineer", "supervisor"],
    commands: [{ id: "run_retrieval", label: "核对维修资料", tone: "primary" }], busy: false,
    onActorRoleChange: vi.fn(), onCommand: vi.fn(), onReset: vi.fn(), onSelect: vi.fn(),
    ...overrides,
  };
}

const flotationRows = Array.from({ length: 73 }, (_, index) => ({
  monitor_hour: `2017-04-${String(1 + Math.floor(index / 24)).padStart(2, "0")} ${String(index % 24).padStart(2, "0")}:00:00`,
  source_samples: 180, completeness_state: "完整", feed_iron_mean: 56.73, feed_silica_mean: 12.73,
  starch_flow_mean: 2146.2 + index, amine_flow_mean: 487.5 + index * 0.1,
  pulp_flow_mean: 402.46, pulp_ph_mean: 9.744, pulp_density_mean: 1.632,
  column_1_air_mean: 200.05, column_1_level_mean: 809.93, column_2_air_mean: 199.89, column_2_level_mean: 801.58,
  column_3_air_mean: 200.01, column_3_level_mean: 810.77, column_4_air_mean: 295.096, column_4_level_mean: 454.46,
  column_5_air_mean: 306.4, column_5_level_mean: 447.27, column_6_air_mean: 250.13, column_6_level_mean: 479.92,
  column_7_air_mean: 249.84, column_7_level_mean: 467.25, concentrate_iron_mean: 64.03,
  concentrate_silica_mean: 3.11, quality_state: "高杂质", consecutive_high_hours: index + 1,
}));

const persistedReview = {
  taskId: "FLOT-2017040307", hours: "72", rowCount: 56,
  windowStart: flotationRows[0]!.monitor_hour, windowEnd: flotationRows[55]!.monitor_hour,
  hypothesis: "air_balance", assignee: "当班工艺工程师", dueAt: "2026-07-27",
  note: "核对五号槽风量与仪表完整性", evidenceItems: [
    `trend:${flotationRows[0]!.monitor_hour}:${flotationRows[55]!.monitor_hour}`,
    "cell-air:5", `quality:${flotationRows[55]!.monitor_hour}`,
  ], createdBy: "case14-process-engineer",
};

function flotationProjection(task?: Record<string, unknown>): CaseProjection {
  return {
    caseId: "B014", objectId: "14-55", state: "工艺复核中", version: 1,
    payload: flotationRows[55]!, task, updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

function flotationProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  const selected = flotationProjection();
  return {
    definition: getCaseDefinition("B014")!, objects: [selected], selected, events: [], metrics: [], datasetRowCount: 720,
    sceneRows: flotationRows, supportingArtifacts: {}, actorRole: "process_engineer", roles: ["process_engineer", "supervisor"],
    commands: [{ id: "submit_process_review", label: "提交工艺复核", tone: "primary" }], busy: false,
    onActorRoleChange: vi.fn(), onCommand: vi.fn(), onReset: vi.fn(), onSelect: vi.fn(),
    ...overrides,
  };
}

function reducedMotionMedia(): MediaQueryList {
  return {
    matches: true, media: "(prefers-reduced-motion: reduce)", onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  };
}

describe("Batch 4 product contracts: cases 09 and 14", () => {
  it("case 09 preserves retrieval but fails closed for inspection orders on a sampled-data gap", () => {
    const retrievalCommand = vi.fn();
    render(<MetroCompressorWorkbench {...metroProps({ onCommand: retrievalCommand })} />);
    fireEvent.click(screen.getByRole("button", { name: "核对维修资料" }));
    expect(retrievalCommand).toHaveBeenCalledWith("run_retrieval", expect.any(String), expect.any(Object));
    cleanup();

    const inspectionCommand = vi.fn();
    render(<MetroCompressorWorkbench {...metroProps({
      selected: metroProjection({ retrieval: { question: "TP2 在采样缺口窗口中需要补充哪些现场检查证据？", query: "TP2 故障窗口 现场检查", activeTrace: "TP2" } }),
      actorRole: "supervisor", commands: [{ id: "create_inspection_order", label: "提交现场检查申请", tone: "primary" }], onCommand: inspectionCommand,
    })} />);
    const application = screen.getByRole("region", { name: "现场检查申请" });
    expect(application).toHaveTextContent("已锁定");
    expect(application).toHaveTextContent("状态变化过程缺失，申请暂不可提交。");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "提交现场检查申请" });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute("title", "采样连续性未通过，只能先补设备记录");
    fireEvent.click(submit);
    expect(inspectionCommand).not.toHaveBeenCalled();
  });

  it("case 09 omits replay controls and continuous scene motion for reduced motion", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => reducedMotionMedia()));
    render(<MetroCompressorWorkbench {...metroProps()} />);

    expect(screen.getByText("减弱动效：开")).toBeVisible();
    expect(screen.queryByRole("button", { name: /播放/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "遥测断档" })).toHaveAttribute("aria-pressed", "true");
    const styles = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/MetroCompressorWorkbench.module.css"), "utf8");
    expect(styles).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/u);
    expect(styles).toMatch(/animation:\s*none\s*!important/u);
  });

  it("case 14 supervisor dispatch preserves the persisted review window and evidence", () => {
    const onCommand = vi.fn();
    const selected = flotationProjection({ processReview: persistedReview });
    render(<FlotationReviewWorkbench {...flotationProps({
      selected, objects: [selected], actorRole: "supervisor",
      commands: [{ id: "dispatch_instrument_check", label: "下发仪表核查", tone: "primary" }], onCommand,
    })} />);

    fireEvent.change(screen.getByLabelText("趋势时间范围"), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText("主管核查意见"), { target: { value: "同意按已提交的复核范围下发仪表核查" } });
    fireEvent.click(screen.getByRole("button", { name: "下发仪表核查" }));

    expect(onCommand).toHaveBeenCalledWith("dispatch_instrument_check", expect.any(String), expect.objectContaining({
      data: expect.objectContaining({ processReview: expect.objectContaining({
        hours: persistedReview.hours, windowStart: persistedReview.windowStart, windowEnd: persistedReview.windowEnd,
        rowCount: persistedReview.rowCount, evidenceItems: persistedReview.evidenceItems,
      }) }),
    }));
  });

  it("case 14 omits the infinite flow animation when reduced motion is requested", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => reducedMotionMedia()));
    const { container } = render(<FlotationReviewWorkbench {...flotationProps()} />);
    expect(container.querySelector("animateMotion")).not.toBeInTheDocument();
  });
});
