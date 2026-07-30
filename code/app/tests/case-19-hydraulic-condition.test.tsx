// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { HydraulicConditionWorkbench } from "../src/components/workbenches/case-specific/HydraulicConditionWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const payload = {
  cycle_id: "217", main_pressure_mean: "156.552065", return_pressure_mean: "105.31137183333334",
  system_pressure_mean: "1.645498", motor_power_mean: "2423.7161", main_flow_mean: "6.234048333333334",
  tank_temperature_mean: "54.27211666666667", system_vibration_mean: "0.68205",
  cooler_condition: "3.0", cooler_state: "接近故障", cooler_severity: "critical",
  valve_condition: "73.0", valve_state: "接近故障", valve_severity: "critical",
  pump_condition: "2.0", pump_state: "严重泄漏", pump_severity: "critical",
  accumulator_condition: "130.0", accumulator_state: "最佳压力", accumulator_severity: "normal",
  stability_label: "稳定", overall_severity_label: "临界", affected_component_count: "3",
  automatic_maintenance_allowed: "False",
};

function projection(cycle: number, state = "待排序"): CaseProjection {
  return {
    caseId: "19", objectId: `19-${cycle}`, state, version: state === "待排序" ? 0 : 1,
    payload: { ...payload, cycle_id: String(cycle), main_pressure_mean: String(156.552065 + (cycle - 217) * .11), main_flow_mean: String(6.234048 + (cycle - 217) * .008) },
    updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

const selected = projection(217);
const objects = [projection(216), selected, projection(218)];
const sceneRows = Array.from({ length: 49 }, (_, index) => ({
  cycle_id: String(193 + index), main_pressure_mean: String(154.2 + index * .1),
  main_flow_mean: String(6 + Math.sin(index / 4) * .2), tank_temperature_mean: String(50 + index * .02),
  system_vibration_mean: String(.54 + Math.cos(index / 5) * .04),
}));

const inspectionOrder = [
  { component: "pump", position: 1, label: "泵", state: "严重泄漏", severity: "critical", conditionCode: "2.0" },
  { component: "valve", position: 2, label: "比例阀", state: "接近故障", severity: "critical", conditionCode: "73.0" },
  { component: "cooler", position: 3, label: "冷却器", state: "接近故障", severity: "critical", conditionCode: "3.0" },
  { component: "accumulator", position: 4, label: "蓄能器", state: "最佳压力", severity: "normal", conditionCode: "130.0" },
];
const task = {
  taskId: "HYD-217-v1", cycleId: "217", focused: "cooler",
  reviewed: ["pump", "valve", "cooler"], inspectionOrder, orderConfirmed: true,
  evidenceBasis: ["cycle-condition-flags", "sensor-trend-20"],
  owner: "液压检修组-A", dueAt: "2026-07-28T08:00", reviewerId: "reliability-engineer-01",
  reviewNote: "先核对泵泄漏，再核对比例阀和冷却器状态。",
};

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("19")!, objects, selected, events: [], metrics: [], datasetRowCount: 2205,
    sceneRows, supportingArtifacts: {}, actorRole: "reliability_engineer", roles: ["reliability_engineer", "supervisor"],
    commands: [{ id: "submit_maintenance_review", label: "提交检查顺序", tone: "primary" }], busy: false,
    onActorRoleChange: vi.fn(), onCommand: vi.fn(), onReset: vi.fn(), onSelect: vi.fn(), ...overrides,
  };
}

describe("HydraulicConditionWorkbench", () => {
  it("shows the real cycle facts, component states, and inspection boundary", () => {
    render(<HydraulicConditionWorkbench {...props()} />);
    expect(screen.getByRole("heading", { name: "液压动力单元检查排序" })).toBeVisible();
    const summary = screen.getByLabelText("本循环汇总");
    expect(summary).toHaveTextContent("156.552");
    expect(summary).toHaveTextContent("105.311");
    expect(summary).toHaveTextContent("1.645");
    expect(summary).toHaveTextContent("2,423.716");
    expect(summary).toHaveTextContent("6.234");
    expect(summary).toHaveTextContent("54.272");
    expect(summary).toHaveTextContent("0.682");
    expect(screen.queryByText(/实时工况/u)).not.toBeInTheDocument();
    expect(screen.getByLabelText("最近二十次循环趋势")).toHaveTextContent("当前载入 20 次");
    expect(screen.getByText("记录序号 198–217，不是时间")).toBeVisible();
    for (const label of ["主压力最近20次循环", "主流量最近20次循环", "油温最近20次循环", "振动最近20次循环"]) {
      expect(screen.getByRole("img", { name: label }).querySelectorAll("polyline")).toHaveLength(1);
    }
    expect(screen.getByText("状态等级不是维修结论")).toBeVisible();
    expect(screen.getByText("2,205 个测量循环")).toBeVisible();
  });

  it("keeps the scene contextual, the approximate 3D mode opt-in, and same-severity ordering explicitly unconfirmed", () => {
    render(<HydraulicConditionWorkbench {...props()} />);
    const scene = screen.getByLabelText("液压动力单元现场");
    expect(scene).toHaveAttribute("data-render-mode", "static-fallback");
    expect(within(scene).getByRole("button", { name: "现场示意" })).toHaveAttribute("aria-pressed", "true");
    expect(within(scene).getByRole("button", { name: "近似三维定位" })).toHaveAttribute("aria-pressed", "false");
    expect(within(scene).getByText("仅用于部件选取；非测量、非真实管路")).toBeVisible();
    expect(within(scene).getByText("三项同为最高关注级；同级、尚未人工确认")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "检查流程" })).not.toBeInTheDocument();

    const cooler = within(scene).getByRole("button", { name: "检查冷却器：接近故障" });
    expect(cooler).toHaveStyle({ "--x": "25%", "--y": "22%" });
  });

  it("keeps the review fields, confirmation, and both engineer actions in one labelled first-screen action region", () => {
    render(<HydraulicConditionWorkbench {...props({
      commands: [
        { id: "submit_maintenance_review", label: "提交检查顺序", tone: "primary" },
        { id: "continue_sampling", label: "继续循环采样", tone: "secondary" },
      ],
    })} />);
    const region = screen.getByLabelText("维护复核操作区");
    expect(within(region).getByText(/重点部件 0\/3/u)).toBeVisible();
    expect(within(region).getByText(/依据 0\/2/u)).toBeVisible();
    expect(within(region).getByLabelText("液压检查负责人")).toBeVisible();
    expect(within(region).getByLabelText("液压检查截止时间")).toBeVisible();
    expect(within(region).getByLabelText("液压复核提交人ID")).toBeVisible();
    expect(within(region).getByLabelText("液压检查说明")).toBeVisible();
    expect(within(region).getByRole("checkbox", { name: "我已按当前循环记录核对检查顺序" })).toBeVisible();
    expect(within(region).getByRole("button", { name: "提交检查顺序" })).toBeVisible();
    expect(within(region).getByRole("button", { name: "继续循环采样" })).toBeVisible();
  });

  it("requires component review, evidence basis, ownership, deadline, and submits an exact task", () => {
    const onCommand = vi.fn();
    render(<HydraulicConditionWorkbench {...props({ onCommand })} />);
    const submit = screen.getByRole("button", { name: "提交检查顺序" });
    expect(submit).toBeDisabled();
    for (const name of ["检查泵：严重泄漏", "检查比例阀：接近故障", "检查冷却器：接近故障"]) fireEvent.click(screen.getByRole("button", { name }));
    fireEvent.click(screen.getByRole("checkbox", { name: /本循环部件状态/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /最近 20 次循环趋势/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "我已按当前循环记录核对检查顺序" }));
    fireEvent.change(screen.getByLabelText("液压检查负责人"), { target: { value: task.owner } });
    fireEvent.change(screen.getByLabelText("液压检查截止时间"), { target: { value: task.dueAt } });
    fireEvent.change(screen.getByLabelText("液压复核提交人ID"), { target: { value: task.reviewerId } });
    fireEvent.change(screen.getByLabelText("液压检查说明"), { target: { value: task.reviewNote } });
    expect(screen.getByLabelText("液压检查负责人")).toHaveValue("液压检修组-A");
    expect(screen.getByLabelText("液压检查截止时间")).toHaveValue("2026-07-28T08:00");
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledWith("submit_maintenance_review", task.reviewNote, {
      actorId: "reliability-engineer-01",
      idempotencyKey: "hydraulic-check:19-217:0:submit",
      evidenceIds: [
        "cycle:217", "component:pump:condition:2.0", "component:valve:condition:73.0",
        "component:cooler:condition:3.0", "component:accumulator:condition:130.0",
        "basis:cycle-condition-flags", "basis:sensor-trend-20",
      ],
      data: task,
    });
  });

  it("restores the task and requires an identified supervisor to confirm the exact order", () => {
    const reviewed: CaseProjection = { ...projection(217, "检查顺序待确认"), task };
    const onCommand = vi.fn();
    render(<HydraulicConditionWorkbench {...props({
      selected: reviewed, objects: [reviewed], actorRole: "supervisor",
      commands: [{ id: "confirm_check_order", label: "确认部件检查顺序", tone: "primary" }], onCommand,
    })} />);
    expect(screen.getByLabelText("已提交维护检查任务")).toHaveTextContent("1.泵 → 2.比例阀 → 3.冷却器 → 4.蓄能器");
    const confirm = screen.getByRole("button", { name: "确认部件检查顺序" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("液压维护主管ID"), { target: { value: "maintenance-supervisor-01" } });
    fireEvent.change(screen.getByLabelText("液压主管复核意见"), { target: { value: "顺序、依据、负责人和期限均已复核。" } });
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledWith("confirm_check_order", "顺序、依据、负责人和期限均已复核。", {
      actorId: "maintenance-supervisor-01",
      idempotencyKey: "hydraulic-check:19-217:1:confirm",
      evidenceIds: ["maintenance-task:HYD-217-v1", "cycle:217"],
      data: {
        taskId: "HYD-217-v1", inspectionOrder, supervisorId: "maintenance-supervisor-01",
        supervisorNote: "顺序、依据、负责人和期限均已复核。", decision: "confirmed",
      },
    });
  });

  it("records an explicit reason when the engineer continues sampling", () => {
    const onCommand = vi.fn();
    render(<HydraulicConditionWorkbench {...props({
      commands: [{ id: "continue_sampling", label: "继续循环采样", tone: "secondary" }], onCommand,
    })} />);
    const button = screen.getByRole("button", { name: "继续循环采样" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("液压复核提交人ID"), { target: { value: "reliability-engineer-01" } });
    fireEvent.change(screen.getByLabelText("液压检查说明"), { target: { value: "当前趋势不足以确定检查顺序，继续采样。" } });
    fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledWith("continue_sampling", "当前趋势不足以确定检查顺序，继续采样。", {
      actorId: "reliability-engineer-01", idempotencyKey: "hydraulic-check:19-217:0:continue",
      evidenceIds: ["cycle:217"],
      data: { cycleId: "217", observationReason: "当前趋势不足以确定检查顺序，继续采样。", owner: "", dueAt: "" },
    });
  });

  it("recovers task data from events and refreshes only the current cycle on errors", () => {
    const reviewed = projection(217, "检查顺序待确认");
    const event: CaseEvent = {
      eventId: "evt-19", caseId: "19", objectId: reviewed.objectId, command: "submit_maintenance_review",
      fromState: "待排序", toState: "检查顺序待确认", actor: { id: "reliability-engineer-01", role: "reliability_engineer" },
      version: 1, occurredAt: "2026-07-26T08:00:00.000Z", evidenceIds: ["cycle:217"], data: task,
    };
    const onSelect = vi.fn();
    render(<HydraulicConditionWorkbench {...props({
      selected: reviewed, objects: [reviewed], events: [event], actorRole: "supervisor",
      commands: [{ id: "confirm_check_order", label: "确认部件检查顺序", tone: "primary" }],
      error: "复核记录写入失败，请刷新。", onSelect,
    })} />);
    expect(screen.getByLabelText("已提交维护检查任务")).toHaveTextContent("液压检修组-A");
    fireEvent.click(screen.getByRole("button", { name: "刷新当前循环" }));
    expect(onSelect).toHaveBeenCalledWith(reviewed.objectId);
  });

  it("keeps server and client markup deterministic", async () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/HydraulicConditionWorkbench.tsx"), "utf8");
    expect(source).not.toContain("Date.now("); expect(source).not.toContain("Math.random("); expect(source).not.toContain("new Date(");
    const onConsoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const element = <HydraulicConditionWorkbench {...props()} />;
    const host = document.createElement("div"); document.body.append(host); host.innerHTML = renderToString(element);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => { root = hydrateRoot(host, element); await Promise.resolve(); });
    await act(async () => root?.unmount()); host.remove();
    expect(onConsoleError.mock.calls.flat().join("\n")).not.toMatch(/hydration|didn't match|server rendered HTML/i);
  });

  it("keeps readable typography, primary controls, focus, and reduced-motion gates in CSS", () => {
    const stylesheet = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/HydraulicConditionWorkbench.module.css"), "utf8");
    expect(stylesheet).toMatch(/--body-size:\s*13px/u);
    expect(stylesheet).toMatch(/\.actions button[^{]*\{[^}]*min-height:\s*44px/su);
    expect(stylesheet).toMatch(/\.root button:focus-visible/su);
    expect(stylesheet).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/u);
  });
});
