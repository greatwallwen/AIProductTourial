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
import { PvLossWorkbench } from "../src/components/workbenches/case-specific/PvLossWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const selectedPayload = {
  station_id: "8", date: "2020-05-19", capacity_mw: "30", source_records: "96",
  mean_irradiance: "331.79396", mean_air_temperature: "21.608491", mean_power_mw: "3.6710417",
  mean_efficiency_ratio: "0.36193088", mean_temperature_derating_pct: "0.0023726074",
  curtailment_suspected_share: "0.40625", automatic_control_allowed: "False",
};
const selected: CaseProjection = {
  caseId: "B020", objectId: "20-8-2020-05-19", state: "待核查", version: 0,
  payload: selectedPayload, updatedAt: "2026-07-26T08:00:00.000Z",
};
const sameDateRows = ["1", "2", "4", "5", "6", "7", "8"].map((stationId, index) => ({
  ...selectedPayload,
  station_id: stationId,
  capacity_mw: ({ "1": "50", "2": "130", "4": "130", "5": "110", "6": "35", "7": "30", "8": "30" } as Record<string, string>)[stationId],
  mean_power_mw: stationId === "8" ? selectedPayload.mean_power_mw : String(2.1 + index * .22),
  mean_efficiency_ratio: stationId === "8" ? selectedPayload.mean_efficiency_ratio : String(.28 + index * .01),
}));
const priorHistory = Array.from({ length: 18 }, (_, index) => ({
  ...selectedPayload,
  date: `2020-05-${String(index + 1).padStart(2, "0")}`,
  mean_irradiance: String(250 + index * 8),
  mean_power_mw: String(2.2 + index * .12),
  mean_efficiency_ratio: index === 13 ? "" : String(.29 + index * .005),
}));
const sceneRows = [...sameDateRows, ...priorHistory];
const stationFacts = [
  ["1", "50"], ["2", "130"], ["3", "30"], ["4", "130"],
  ["5", "110"], ["6", "35"], ["7", "30"], ["8", "30"],
].map(([station_id, capacity_mw]) => ({ station_id, capacity_mw, data_nature: "public-station-fact" }));

const requestedSourceIds = [
  "dispatch-curtailment-log", "inverter-alert-log", "maintenance-work-order",
] as const;
const direction = {
  code: "curtailment", label: "疑似限电", status: "provisional",
  basis: {
    meanEfficiencyRatio: "0.36193088", curtailmentSuspectedShare: "0.40625",
    temperatureDeratingShare: "0.0023726074",
  },
} as const;
const evidenceSources = [
  { sourceId: "station-day-aggregate", label: "公开站日汇总", status: "loaded", evidenceId: "station-day:8:2020-05-19" },
  { sourceId: "dispatch-curtailment-log", label: "调度限电记录", status: "load_failed", failureCode: "source_not_in_dataset" },
  { sourceId: "inverter-alert-log", label: "逆变器告警", status: "load_failed", failureCode: "source_not_in_dataset" },
  { sourceId: "maintenance-work-order", label: "站端检修工单", status: "load_failed", failureCode: "source_not_in_dataset" },
] as const;
const task = {
  taskId: "PV-8-20200519-v1", stationId: "8", date: "2020-05-19", direction,
  evidenceSources,
  retrievalRequest: {
    requestedSourceIds: [...requestedSourceIds], owner: "华北站端运维组",
    dueAt: "2026-07-29T18:00", requesterId: "performance-engineer-01",
    note: "补取调度、逆变器告警和检修记录后再判断少发方向。",
  },
};

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B020")!, objects: [selected], selected, events: [],
    metrics: [], datasetRowCount: 5327, sceneRows, supportingArtifacts: { "stations.csv": stationFacts },
    actorRole: "performance_engineer", roles: ["performance_engineer", "supervisor"],
    commands: [{ id: "submit_station_check", label: "提交站端核查", tone: "primary" }], busy: false,
    onActorRoleChange: vi.fn(), onCommand: vi.fn(), onReset: vi.fn(), onSelect: vi.fn(), ...overrides,
  };
}

function completeSubmissionForm(): void {
  fireEvent.click(screen.getByRole("button", { name: /疑似限电/ }));
  for (const name of [/调度限电记录/, /逆变器告警/, /站端检修工单/]) {
    fireEvent.click(screen.getByRole("checkbox", { name }));
  }
  fireEvent.change(screen.getByLabelText("光伏证据补取负责人"), { target: { value: task.retrievalRequest.owner } });
  fireEvent.change(screen.getByLabelText("光伏证据补取截止时间"), { target: { value: task.retrievalRequest.dueAt } });
  fireEvent.change(screen.getByLabelText("光伏核查提交人ID"), { target: { value: task.retrievalRequest.requesterId } });
  fireEvent.change(screen.getByLabelText("光伏核查说明"), { target: { value: task.retrievalRequest.note } });
}

describe("PvLossWorkbench", () => {
  it("renders the four-stage evidence chain with exact facts and bounded missing-source copy", () => {
    render(<PvLossWorkbench {...props()} />);
    expect(screen.getByRole("heading", { name: "光伏站端记录核查" })).toBeVisible();
    expect(screen.queryByRole("img", { name: "光伏电站与逆变器现场" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("光伏核查指标")).toHaveTextContent("331.79 W/m²");
    expect(screen.getByLabelText("光伏核查指标")).toHaveTextContent("21.61℃");
    expect(screen.getByLabelText("光伏核查指标")).toHaveTextContent("3.67 MW");
    expect(screen.getByLabelText("证据缺口")).toHaveTextContent("数据集未包含");
    expect(screen.getByLabelText("证据缺口")).toHaveTextContent("申请补取");
    expect(screen.queryByText(/source_not_in_dataset/)).not.toBeInTheDocument();
    expect(screen.getByText("线索不等于少发原因")).toBeVisible();
    expect(screen.getByText("平台不下发控制")).toBeVisible();
    expect(screen.getByText("5,327 个站点日")).toBeVisible();
  });

  it("starts with no provisional direction or fabricated form defaults", () => {
    render(<PvLossWorkbench {...props()} />);
    expect(screen.getByRole("button", { name: /温度影响/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /疑似限电/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /设备侧待核对/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("光伏证据补取负责人")).toHaveValue("");
    expect(screen.getByLabelText("光伏证据补取截止时间")).toHaveValue("");
    expect(screen.getByLabelText("光伏核查提交人ID")).toHaveValue("");
    expect(screen.getByRole("button", { name: "提交站端核查" })).toBeDisabled();
  });

  it("keeps sparse station-days real and selects only an observed date", () => {
    const onSelect = vi.fn();
    render(<PvLossWorkbench {...props({ onSelect })} />);
    const rail = screen.getByLabelText("光伏电站列表");
    const station3 = within(rail).getByRole("button", { name: /PV-03.*当日无数据/ });
    expect(station3).toBeDisabled();
    fireEvent.click(station3);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("核查日期"), { target: { value: "2020-05-18" } });
    expect(onSelect).toHaveBeenCalledWith("20-8-2020-05-18");
  });

  it("shows missing values as em dashes and breaks the real 14-day ratio lane", () => {
    const missingSelected: CaseProjection = {
      ...selected,
      payload: {
        ...selectedPayload,
        mean_air_temperature: "",
        mean_temperature_derating_pct: "",
        mean_efficiency_ratio: "",
      },
    };
    render(<PvLossWorkbench {...props({ selected: missingSelected, objects: [missingSelected] })} />);
    expect(screen.getByLabelText("平均气温值")).toHaveTextContent("—");
    expect(screen.getByLabelText("归一化出力比值")).toHaveTextContent("—");
    expect(screen.getByRole("button", { name: /温度影响/ })).toHaveTextContent("—");
    const trend = screen.getByLabelText("PV-08 最近 14 个站日");
    expect(trend).toHaveAttribute("data-points", "14");
    const ratioLane = screen.getByLabelText("归一化出力比日级趋势");
    expect(ratioLane.querySelectorAll("polyline").length).toBeGreaterThan(1);
    expect(trend).toHaveTextContent("缺测断线，不补零");
  });

  it("requires an explicit direction and complete request before submitting the exact task", () => {
    const onCommand = vi.fn();
    render(<PvLossWorkbench {...props({ onCommand })} />);
    const submit = screen.getByRole("button", { name: "提交站端核查" });
    completeSubmissionForm();
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledWith("submit_station_check", task.retrievalRequest.note, {
      actorId: "performance-engineer-01",
      idempotencyKey: "pv-investigation:20-8-2020-05-19:0:handoff",
      evidenceIds: [
        "station-day:8:2020-05-19", "load-failure:dispatch-curtailment-log",
        "load-failure:inverter-alert-log", "load-failure:maintenance-work-order",
      ],
      data: task,
    });
  });

  it("restores a persisted task and requires a separately identified supervisor", () => {
    const reviewed: CaseProjection = { ...selected, state: "站端核查中", version: 1, task };
    const onCommand = vi.fn();
    render(<PvLossWorkbench {...props({
      selected: reviewed, objects: [reviewed], actorRole: "supervisor",
      commands: [{ id: "confirm_attribution", label: "确认核查方向", tone: "primary" }], onCommand,
    })} />);
    expect(screen.getByLabelText("已提交站端核查任务")).toHaveTextContent("PV-8-20200519-v1");
    expect(screen.getByLabelText("已提交站端核查任务")).toHaveTextContent("华北站端运维组");
    expect(screen.getByRole("button", { name: /疑似限电/ })).toHaveAttribute("aria-pressed", "true");
    const confirm = screen.getByRole("button", { name: "确认核查方向" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("光伏核查主管ID"), { target: { value: "operations-supervisor-01" } });
    fireEvent.change(screen.getByLabelText("光伏核查主管意见"), { target: { value: "确认补取方向，现场证据齐备前不认定少发根因。" } });
    fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledWith("confirm_attribution", "确认补取方向，现场证据齐备前不认定少发根因。", {
      actorId: "operations-supervisor-01",
      idempotencyKey: "pv-investigation:20-8-2020-05-19:1:confirm",
      evidenceIds: ["investigation-task:PV-8-20200519-v1", "station-day:8:2020-05-19"],
      data: {
        taskId: "PV-8-20200519-v1", direction, supervisorId: "operations-supervisor-01",
        supervisorNote: "确认补取方向，现场证据齐备前不认定少发根因。",
        decision: "confirmed_for_field_investigation",
      },
    });
  });

  it("labels the control command as an accountable platform-only record", () => {
    const onCommand = vi.fn();
    render(<PvLossWorkbench {...props({
      commands: [{ id: "hold_control_change", label: "阻断自动控制", tone: "danger" }], onCommand,
    })} />);
    const block = screen.getByRole("button", { name: "登记禁止控制变更" });
    expect(screen.queryByRole("button", { name: "阻断自动控制" })).not.toBeInTheDocument();
    expect(block).toBeDisabled();
    fireEvent.change(screen.getByLabelText("光伏禁止控制变更登记理由"), {
      target: { value: "三类站端证据均未取得，平台登记禁止自动调整控制参数。" },
    });
    fireEvent.change(screen.getByLabelText("光伏核查提交人ID"), { target: { value: "performance-engineer-01" } });
    fireEvent.click(block);
    expect(onCommand.mock.calls[0]?.[0]).toBe("hold_control_change");
    expect(onCommand.mock.calls[0]?.[2].data.controlScope).toBe("automatic-control");
  });

  it("restores task data from events and refreshes only the selected station-day", () => {
    const reviewed: CaseProjection = { ...selected, state: "站端核查中", version: 1 };
    const event: CaseEvent = {
      eventId: "evt-20", caseId: "B020", objectId: reviewed.objectId,
      command: "submit_station_check", fromState: "待核查", toState: "站端核查中",
      actor: { id: "performance-engineer-01", role: "performance_engineer" }, version: 1,
      occurredAt: "2026-07-26T08:10:00.000Z", evidenceIds: ["station-day:8:2020-05-19"], data: task,
    };
    const onSelect = vi.fn();
    render(<PvLossWorkbench {...props({
      selected: reviewed, objects: [reviewed], events: [event], actorRole: "supervisor",
      commands: [{ id: "confirm_attribution", label: "确认核查方向", tone: "primary" }],
      error: "核查记录写入失败，请刷新。", onSelect,
    })} />);
    expect(screen.getByLabelText("已提交站端核查任务")).toHaveTextContent("调度限电记录、逆变器告警、站端检修工单");
    fireEvent.click(screen.getByRole("button", { name: "刷新当前站日" }));
    expect(onSelect).toHaveBeenCalledWith(reviewed.objectId);
  });

  it("keeps server and client markup deterministic", async () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/PvLossWorkbench.tsx"), "utf8");
    expect(source).not.toContain("Date.now("); expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("typeof window"); expect(source).not.toContain("new Date(");
    const onConsoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const element = <PvLossWorkbench {...props()} />;
    const host = document.createElement("div"); document.body.append(host); host.innerHTML = renderToString(element);
    let root: ReturnType<typeof hydrateRoot> | undefined;
    await act(async () => { root = hydrateRoot(host, element); await Promise.resolve(); });
    await act(async () => root?.unmount()); host.remove();
    expect(onConsoleError.mock.calls.flat().join("\n")).not.toMatch(/hydration|didn't match|server rendered HTML/i);
  });

  it("keeps the first-screen action, readable type, focus, and reduced-motion contracts", () => {
    const css = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/PvLossWorkbench.module.css"), "utf8");
    expect(css).toMatch(/font-size:\s*13px/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toMatch(/\.actions\{[^}]*position:sticky;bottom:0/);
  });
});
