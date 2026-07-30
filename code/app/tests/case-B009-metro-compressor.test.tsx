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

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const base = {
  TP3: "8.248",
  H1: "8.238",
  DV_pressure: "-0.024",
  known_failure_window: "True",
  maintenance_action_allowed: "False",
};

const boundaryRows = [
  { ...base, investigation_id: "fault-boundary", source_row_index: "5625630", timestamp: "2020-04-17 23:59:49", TP2: "-0.018", Oil_temperature: "49.45", Motor_current: "0.04" },
  { ...base, investigation_id: "fault-boundary", source_row_index: "5625640", timestamp: "2020-04-18 00:00:01", TP2: "-0.018", Oil_temperature: "49.45", Motor_current: "0.04" },
];

const gapRows = [
  { ...base, investigation_id: "telemetry-gap", source_row_index: "5626540", timestamp: "2020-04-18 00:18:07", TP2: "-0.018", Oil_temperature: "49.45", Motor_current: "0.04" },
  { ...base, investigation_id: "telemetry-gap", source_row_index: "5626550", timestamp: "2020-04-18 00:23:59", TP2: "8.384", Oil_temperature: "68.525", Motor_current: "5.675" },
];

const recoveredRows = [
  { ...base, investigation_id: "recovered-window", source_row_index: "5626550", timestamp: "2020-04-18 00:23:59", TP2: "8.384", Oil_temperature: "68.525", Motor_current: "5.675" },
  { ...base, investigation_id: "recovered-window", source_row_index: "5626560", timestamp: "2020-04-18 00:24:09", TP2: "8.422", Oil_temperature: "69.5", Motor_current: "5.7075" },
  { ...base, investigation_id: "recovered-window", source_row_index: "5626570", timestamp: "2020-04-18 00:24:18", TP2: "8.454", Oil_temperature: "70.2", Motor_current: "5.73" },
];

const thresholdGapRows = [
  { ...base, investigation_id: "threshold-gap", source_row_index: "5627000", timestamp: "2020-04-18 00:30:00", TP2: "8.4", Oil_temperature: "70.1", Motor_current: "5.7" },
  { ...base, investigation_id: "threshold-gap", source_row_index: "5627010", timestamp: "2020-04-18 00:32:01", TP2: "8.42", Oil_temperature: "70.3", Motor_current: "5.72" },
];

const sceneRows = [...boundaryRows, ...gapRows, ...recoveredRows];

const knowledge = [
  { id: "DOC-SOURCE", type: "source-fact", title: "MetroPT-3 数据来源事实", source: "UCI 791", version: "v1", content: "公开连续切片。", boundary: "不是故障诊断。" },
  { id: "DOC-TP2", type: "field-definition", title: "TP2 排气压力字段说明", source: "UCI 791", version: "v1", content: "TP2 表示压缩机排气压力。", boundary: "字段事实，不给出原因。" },
  { id: "DOC-PROC", type: "inspection-procedure", title: "现场检查顺序", source: "课程检查规则", version: "v2", content: "先核对窗口、样本和来源。", boundary: "不是厂商维修手册。" },
  { id: "DOC-APPROVAL", type: "approval-policy", title: "人工审批要求", source: "课程检查规则", version: "v1", content: "申请必须由主管复核。", boundary: "不能自动停机或维修。" },
];

const rowsByInvestigation = { "fault-boundary": boundaryRows, "telemetry-gap": gapRows, "recovered-window": recoveredRows } as const;

function projection(investigationId = "telemetry-gap", state = "待检索", task?: Record<string, unknown>): CaseProjection {
  return {
    caseId: "B009",
    objectId: `09-${investigationId}`,
    state,
    version: state === "待检索" ? 0 : 1,
    payload: rowsByInvestigation[investigationId as keyof typeof rowsByInvestigation][0],
    task,
    updatedAt: "2026-07-27T08:00:00.000Z",
  };
}

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  const selected = projection();
  return {
    definition: getCaseDefinition("B009")!,
    objects: [projection("fault-boundary"), selected, projection("recovered-window")],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 4090,
    sceneRows,
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

const persistedRetrieval = {
  question: "恢复后的 TP2 变化是否足以提交现场目视检查申请？",
  query: "TP2 排气压力 故障窗口 现场检查",
  activeTrace: "TP2",
  timestamp: "2020-04-18 00:24:09",
  windowStart: "2020-04-18 00:23:59",
  windowEnd: "2020-04-18 00:24:18",
  rankedResults: [
    { id: "DOC-TP2", title: "TP2 排气压力字段说明", score: 12, stance: "support", source: "UCI 791", version: "v1" },
    { id: "DOC-PROC", title: "现场检查顺序", score: 9, stance: "support", source: "课程检查规则", version: "v2" },
    { id: "DOC-APPROVAL", title: "人工审批要求", score: 8, stance: "constraint", source: "课程检查规则", version: "v1" },
  ],
  createdBy: "case09-duty-engineer",
};

describe("MetroCompressorWorkbench investigation product", () => {
  it("renders the selected design with three real windows, equipment context and a failed continuity gate", () => {
    render(<MetroCompressorWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "空压机遥测断档调查" })).toBeVisible();
    expect(screen.getByRole("button", { name: "故障区间起点" })).toBeVisible();
    expect(screen.getByRole("button", { name: "遥测断档" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "恢复后连续窗口" })).toBeVisible();
    expect(screen.getByRole("region", { name: "空压机设备信息图" })).toBeVisible();
    expect(screen.getByText("设备位置示意 · 非真实几何")).toBeVisible();
    expect(screen.getByRole("button", { name: "选择 TP2 排气压力" })).toBeVisible();
    expect(screen.getByRole("button", { name: "选择油温" })).toBeVisible();
    expect(screen.getByRole("button", { name: "选择电机电流" })).toBeVisible();
    expect(screen.getByText("断档前 00:18:07")).toBeVisible();
    expect(screen.getAllByText("352 秒无记录").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("恢复后 00:23:59")).toBeVisible();
    expect(screen.getByRole("complementary", { name: "数据连续性门禁" })).toBeVisible();
    expect(screen.getByText("状态变化过程缺失，申请暂不可提交。")).toBeVisible();
    expect(screen.getByLabelText("检查范围")).toBeDisabled();
  });

  it("switches to the recovered investigation object and opens the continuity gate", () => {
    const onSelect = vi.fn();
    render(<MetroCompressorWorkbench {...props({ onSelect })} />);

    fireEvent.click(screen.getByRole("button", { name: "恢复后连续窗口" }));
    expect(onSelect).toHaveBeenCalledWith("09-recovered-window");
    expect(screen.getByText("记录连续")).toBeVisible();
    expect(screen.getByText("最大间隔 10 秒")).toBeVisible();
  });

  it("treats an interval above the shared 120-second limit as a locked gap window", () => {
    const selected: CaseProjection = {
      caseId: "B009",
      objectId: "09-threshold-gap",
      state: "待检索",
      version: 0,
      payload: thresholdGapRows[0],
      updatedAt: "2026-07-27T08:00:00.000Z",
    };
    render(<MetroCompressorWorkbench {...props({
      selected,
      objects: [projection("fault-boundary"), selected],
      sceneRows: [...boundaryRows, ...thresholdGapRows],
    })} />);

    expect(screen.getByRole("button", { name: "遥测断档" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("121 秒无记录").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText("检查范围")).toBeDisabled();
  });

  it("restores the persisted recovered window after a command response even when payload is stale", () => {
    const rawSceneRows = sceneRows.map(({ investigation_id: _investigationId, ...row }) => row);
    const selected = projection("telemetry-gap", "资料待核验", {
      retrieval: { ...persistedRetrieval, investigationId: "recovered-window" },
    });
    render(<MetroCompressorWorkbench {...props({
      selected,
      objects: [projection("fault-boundary"), selected, projection("recovered-window")],
      sceneRows: rawSceneRows,
      actorRole: "supervisor",
      commands: [{ id: "create_inspection_order", label: "提交现场检查申请", tone: "primary" }],
    })} />);

    expect(screen.getByRole("button", { name: "恢复后连续窗口" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("最大间隔 10 秒").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText("检查范围")).toBeEnabled();
  });

  it("prefers the latest recovered-window review over an older gap hold after reload", () => {
    const rawSceneRows = sceneRows.map(({ investigation_id: _investigationId, ...row }) => row);
    const selected = projection("telemetry-gap", "资料已核对", {
      hold: { investigationId: "telemetry-gap", reason: "older hold" },
      retrieval: { ...persistedRetrieval, investigationId: "recovered-window" },
    });
    render(<MetroCompressorWorkbench {...props({
      selected,
      objects: [projection("fault-boundary"), selected, projection("recovered-window")],
      sceneRows: rawSceneRows,
      actorRole: "supervisor",
      commands: [{ id: "create_inspection_order", label: "提交现场检查申请", tone: "primary" }],
    })} />);

    expect(screen.getByRole("button", { name: "恢复后连续窗口" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("最大间隔 10 秒").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText("检查范围")).toBeEnabled();
  });

  it("allows only a request for missing records in the 352-second gap window", () => {
    const onCommand = vi.fn();
    render(<MetroCompressorWorkbench {...props({
      actorRole: "supervisor",
      commands: [
        { id: "hold_investigation", label: "请求补充设备记录", tone: "primary" },
        { id: "create_inspection_order", label: "提交现场检查申请", tone: "primary" },
      ],
      onCommand,
    })} />);

    fireEvent.change(screen.getByLabelText("申请说明"), { target: { value: "补充断档期间的设备记录和交接日志" } });
    expect(screen.getByRole("button", { name: "提交现场检查申请" })).toBeDisabled();
    const hold = screen.getByRole("button", { name: "请求补充设备记录" });
    expect(hold).toBeEnabled();
    fireEvent.click(hold);

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0]![0]).toBe("hold_investigation");
    expect(onCommand.mock.calls[0]![2].data.hold).toMatchObject({
      investigationId: "telemetry-gap",
      reason: "补充断档期间的设备记录和交接日志",
    });
  });

  it("unlocks the recovered-window application after local material review and supervisor checks", () => {
    const selected = projection("recovered-window", "资料待核验", { retrieval: persistedRetrieval });
    const onCommand = vi.fn();
    render(<MetroCompressorWorkbench {...props({
      selected,
      objects: [projection("fault-boundary"), projection(), selected],
      actorRole: "supervisor",
      commands: [{ id: "create_inspection_order", label: "提交现场检查申请", tone: "primary" }],
      onCommand,
    })} />);

    for (const name of ["核对五分钟窗口与故障边界", "核对传感字段、样本数与来源", "确认现场检查不触发设备控制"]) {
      fireEvent.click(screen.getByRole("checkbox", { name }));
    }
    fireEvent.change(screen.getByLabelText("申请说明"), { target: { value: "现场仅核对仪表、环境和维护记录" } });
    const submit = screen.getByRole("button", { name: "提交现场检查申请" });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0]![2].data.inspection).toMatchObject({
      investigationId: "recovered-window",
      requestedAction: "on_site_visual_inspection",
      reviewedBy: "case09-maintenance-supervisor",
    });
  });

  it("keeps hydration inputs deterministic and removes perpetual motion", () => {
    const component = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/MetroCompressorWorkbench.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/MetroCompressorWorkbench.module.css"), "utf8");
    expect(component).not.toContain("Date.now(");
    expect(component).not.toContain("Math.random(");
    expect(component).not.toContain("new Date(");
    expect(css).not.toMatch(/animation:[^;]*infinite/u);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/u);
  });
});
