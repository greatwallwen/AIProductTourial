// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { CutterHealthWorkbench } from "../src/components/workbenches/case-specific/CutterHealthWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";
import { WindUnderperformanceWorkbench } from "../src/components/workbenches/case-specific/WindUnderperformanceWorkbench";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function projection(
  caseId: "16" | "17",
  objectId: string,
  state: string,
  payload: Record<string, unknown>,
): CaseProjection {
  return {
    caseId,
    objectId,
    state,
    version: 0,
    payload,
    updatedAt: "2026-07-25T08:00:00.000Z",
  };
}

function baseProps(
  caseId: "16" | "17",
  selected: CaseProjection,
  overrides: Partial<CaseWorkbenchProps> = {},
): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition(caseId)!,
    objects: [selected],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: caseId === "16" ? 938 : 519,
    sceneRows: [],
    supportingArtifacts: {},
    actorRole: caseId === "16" ? "reliability_engineer" : "maintenance_planner",
    roles: caseId === "16"
      ? ["reliability_engineer", "supervisor"]
      : ["maintenance_planner", "supervisor"],
    commands: [],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

const windRows = [
  [1, 8.7921678, 579.36203],
  [2, 6.4378873, 443.77986],
  [3, 11.596667, 1140.758],
  [4, 10.373125, 735.04451],
  [5, 10.339028, 696.75111],
  [6, 4.731875, 250.32181],
  [7, 3.4093706, 90.366573],
].map(([day, wind, power]) => ({
  turbine_id: "7",
  day: String(day),
  source_records: "144",
  valid_wind_records: "144",
  valid_power_records: "144",
  mean_wind_speed: String(wind),
  mean_active_power: String(power),
  underperformance_share: "1",
  manual_inspection_only: "True",
}));

const windSelected = projection("16", "16-7-1", "待定位", {
  ...windRows[0],
  valid_wind_records: "143",
  valid_power_records: "143",
});

const cutterSelected = projection("17", "17-BD-0003", "待复核", {
  session_id: "BD-0003",
  operating_mode: "1",
  source_samples: "2048",
  cutter_torque_mean: "-0.02152884",
  cutter_torque_std: "0.43730253",
  cutter_torque_rms: "0.43783215",
  cutter_torque_abs_peak: "4.47759246",
  cutter_follow_error_mean: "-0.00000217",
  cutter_follow_error_std: "0.07830023",
  cutter_follow_error_rms: "0.07830023",
  cutter_follow_error_abs_peak: "1.30289363",
  film_follow_error_mean: "0.82114835",
  film_follow_error_std: "0.10570246",
  film_follow_error_rms: "0.82792368",
  film_follow_error_abs_peak: "1.11555159",
  health_deviation_index: "3.85604256",
  rule_threshold: "3.77546317",
  evidence_coverage: "可用",
  dominant_deviation_signal: "切刀转矩均值",
  rule_review_level: "关注",
  causal_root_cause_allowed: "False",
  automatic_stop_allowed: "False",
  automatic_replacement_allowed: "False",
});

const waveform = [
  [-0.10974129, -0.0075531, 0.77471131],
  [-0.16795916, 0.0036354, 0.80762952],
  [-0.15233635, 0.01150894, 0.7841708],
  [0.104671, -0.018254, 0.842915],
].map(([torque, cutter, film], index) => ({
  session_id: "BD-0003",
  sample_index: String(index + 1),
  cutter_motor_torque: String(torque),
  cutter_follow_error: String(cutter),
  film_follow_error: String(film),
}));

describe("WindUnderperformanceWorkbench", () => {
  it("uses seven operating days and 134 relative locations without inventing a calendar or map", () => {
    const locations = Array.from({ length: 134 }, (_, index) => ({
      turbine_id: String(index + 1),
      turbine_x: String(3300 + (index % 14) * 37),
      turbine_y: String(5800 + Math.floor(index / 14) * 311),
      data_nature: "public-location-fact",
    }));
    render(
      <WindUnderperformanceWorkbench
        {...baseProps("16", windSelected, {
          sceneRows: windRows,
          supportingArtifacts: { "turbine-locations.csv": locations },
        })}
      />,
    );

    expect(screen.getByRole("heading", { name: "风机出力下偏核查" })).toBeVisible();
    expect(screen.getByLabelText("风机相对坐标示意")).toHaveTextContent("T007");
    expect(document.querySelectorAll(".wind-relative-field__turbine")).toHaveLength(134);
    expect(screen.getByText("7 / 7 个运行日")).toBeVisible();
    expect(screen.getByText("运行日 7")).toBeVisible();
    expect(screen.getAllByText("未提供")).toHaveLength(4);
    expect(screen.getByText("下偏不等于故障")).toBeVisible();
    expect(screen.queryByText(/2026-\d{2}-\d{2}/)).not.toBeInTheDocument();
    expect(screen.getByText("相对坐标，不是真实地图")).toBeVisible();
  });

  it("exposes role, command, selection, error, and reset through the shared workbench controls", () => {
    const onActorRoleChange = vi.fn();
    const onCommand = vi.fn();
    const onReset = vi.fn();
    const onSelect = vi.fn();
    const second = projection("16", "16-8-1", "待定位", {
      ...windRows[0],
      turbine_id: "8",
      underperformance_share: "0",
    });
    render(
      <WindUnderperformanceWorkbench
        {...baseProps("16", windSelected, {
          objects: [windSelected, second],
          sceneRows: windRows,
          actorRole: "reliability_engineer",
          commands: [{ id: "submit_field_check", label: "提交现场核查", tone: "primary" }],
          error: "核查记录写入失败，请恢复后重试",
          onActorRoleChange,
          onCommand,
          onReset,
          onSelect,
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText("当前操作角色"), { target: { value: "supervisor" } });
    fireEvent.click(screen.getByRole("button", { name: "提交现场核查" }));
    fireEvent.click(screen.getByRole("button", { name: /T008/ }));
    fireEvent.click(screen.getByRole("button", { name: "恢复案例 B16" }));

    expect(onActorRoleChange).toHaveBeenCalledWith("supervisor");
    expect(onCommand).toHaveBeenCalledOnce();
    expect(onCommand.mock.calls[0]?.[0]).toBe("submit_field_check");
    expect(onCommand.mock.calls[0]?.[1]).toEqual(expect.stringMatching(/^wind-field-check:/));
    expect(onCommand.mock.calls[0]?.[2]).toMatchObject({
      data: {
        aggregateType: "wind_underperformance_investigation",
        turbineId: "7",
        decision: "request_field_inspection",
        serverValidationRequired: true,
      },
      evidenceIds: expect.any(Array),
      idempotencyKey: expect.stringMatching(/^case-16:turbine:7:submit_field_check:v0/),
    });
    expect(onSelect).toHaveBeenCalledWith("16-8-1");
    expect(onReset).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent("核查记录写入失败，请恢复后重试");
  });
});

describe("CutterHealthWorkbench", () => {
  it("renders the Image2 A three-track review surface and the decision boundary", () => {
    render(
      <CutterHealthWorkbench
        {...baseProps("17", cutterSelected, {
          supportingArtifacts: {
            "waveform.csv": [
              ...waveform,
              { session_id: "BD-0001", sample_index: "1", cutter_motor_torque: "1", cutter_follow_error: "1", film_follow_error: "1" },
            ],
          },
        })}
      />,
    );

    expect(screen.getByRole("heading", { name: "包装切刀会话复核" })).toBeVisible();
    expect(screen.getByLabelText("三路同步波形工作区")).toBeVisible();
    expect(screen.getByRole("img", { name: "BD-0003 三通道原始波形" }).querySelectorAll("polyline")).toHaveLength(3);
    expect(screen.getByText("3.856")).toBeVisible();
    expect(screen.getByText("3.775")).toBeVisible();
    expect(screen.getByText("切刀转矩均值")).toBeVisible();
    expect(screen.getByText("偏差不等于设备故障")).toBeVisible();
    expect(screen.getByText("规则偏差只形成排检候选")).toBeVisible();
    expect(screen.queryByText("BD-0001 三路原始波形")).not.toBeInTheDocument();
    expect(screen.queryByText(/184835/)).not.toBeInTheDocument();
  });

  it("lists only waveform sessions and keeps the no-waveform summary truthful", () => {
    const onSelect = vi.fn();
    const withoutWaveform = projection("17", "17-BD-0010", "待复核", { ...cutterSelected.payload, session_id: "BD-0010" });
    const { rerender } = render(
      <CutterHealthWorkbench
        {...baseProps("17", cutterSelected, {
          objects: [cutterSelected, withoutWaveform],
          supportingArtifacts: { "waveform.csv": waveform },
          onSelect,
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: /BD-0010/ })).not.toBeInTheDocument();
    rerender(<CutterHealthWorkbench {...baseProps("17", withoutWaveform, { objects: [cutterSelected, withoutWaveform], supportingArtifacts: { "waveform.csv": waveform } })} />);
    expect(screen.getByText("当前会话只有摘要，没有可核对的本地波形。")).toBeVisible();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("requires waveform review and a note before recording a structured inspection direction", () => {
    const onCommand = vi.fn();
    render(
      <CutterHealthWorkbench
        {...baseProps("17", cutterSelected, {
          supportingArtifacts: { "waveform.csv": waveform },
          commands: [{ id: "schedule_night_inspection", label: "列入排检候选", tone: "primary" }],
          onCommand,
        })}
      />,
    );

    const submit = screen.getByRole("button", { name: "保存排检计划" });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /薄膜跟随误差/ }));
    fireEvent.change(screen.getByLabelText("切刀复核说明"), { target: { value: "波形抬升，核对切刀转矩与薄膜跟随。" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0][0]).toBe("schedule_night_inspection");
    expect(JSON.parse(String(onCommand.mock.calls[0][1]).replace("cutter-review:", ""))).toEqual({ signal: "film_follow_error", viewed: true, direction: "切刀转矩与薄膜跟随性能", note: "波形抬升，核对切刀转矩与薄膜跟随。" });
  });

  it("restores the review draft and exposes role, recovery, and reset controls", () => {
    const event: CaseEvent = { eventId: "evt-17", caseId: "17", objectId: cutterSelected.objectId, command: "schedule_night_inspection", fromState: "待复核", toState: "排检候选待确认", actor: { id: "maintenance_planner", role: "maintenance_planner" }, version: 1, occurredAt: "2026-07-26T08:00:00.000Z", reason: 'cutter-review:{"signal":"cutter_follow_error","viewed":true,"direction":"切刀跟随误差与传动间隙","note":"复核传动间隙。"}', evidenceIds: [] };
    const onActorRoleChange = vi.fn(); const onSelect = vi.fn(); const onReset = vi.fn();
    render(<CutterHealthWorkbench {...baseProps("17", cutterSelected, { events: [event], supportingArtifacts: { "waveform.csv": waveform }, error: "记录写入失败，请刷新后重试", onActorRoleChange, onSelect, onReset })} />);
    expect(screen.getByRole("button", { name: /切刀跟随误差/ })).toHaveAttribute("data-active", "true");
    expect(screen.getByLabelText("排检方向")).toHaveValue("切刀跟随误差与传动间隙");
    expect(screen.getByLabelText("切刀复核说明")).toHaveValue("复核传动间隙。");
    fireEvent.change(screen.getByLabelText("当前操作角色"), { target: { value: "supervisor" } });
    expect(onActorRoleChange).toHaveBeenCalledWith("supervisor");
    fireEvent.click(screen.getByRole("button", { name: "刷新当前会话" }));
    expect(onSelect).toHaveBeenCalledWith(cutterSelected.objectId);
    fireEvent.click(screen.getByRole("button", { name: "恢复案例 B17" }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});

describe("case 16/17 server-rendering determinism", () => {
  it("does not use runtime-dependent hydration branches", () => {
    const sources = [
      "WindUnderperformanceWorkbench.tsx",
      "CutterHealthWorkbench.tsx",
    ].map((name) => readFileSync(
      resolve(process.cwd(), "src/components/workbenches/case-specific", name),
      "utf8",
    ));

    for (const source of sources) {
      expect(source).not.toContain("Date.now(");
      expect(source).not.toContain("Math.random(");
      expect(source).not.toContain("typeof window");
      expect(source).not.toContain("new Date(");
    }
  });

  it("hydrates both workbenches without React mismatch diagnostics", async () => {
    const onConsoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const windProps = baseProps("16", windSelected, {
      sceneRows: windRows,
      supportingArtifacts: {
        "turbine-locations.csv": [
          { turbine_id: "7", turbine_x: "3360.5473", turbine_y: "8816.23834" },
          { turbine_id: "8", turbine_x: "3400", turbine_y: "8700" },
        ],
      },
    });
    const cutterProps = baseProps("17", cutterSelected, {
      supportingArtifacts: { "waveform.csv": waveform },
    });

    for (const element of [
      <WindUnderperformanceWorkbench key="wind" {...windProps} />,
      <CutterHealthWorkbench key="cutter" {...cutterProps} />,
    ]) {
      const host = document.createElement("div");
      document.body.append(host);
      host.innerHTML = renderToString(element);
      let root: ReturnType<typeof hydrateRoot> | undefined;
      await act(async () => {
        root = hydrateRoot(host, element);
        await Promise.resolve();
      });
      await act(async () => root?.unmount());
      host.remove();
    }

    const diagnostics = onConsoleError.mock.calls.flat().join("\n");
    expect(diagnostics).not.toMatch(/hydration|didn't match|server rendered HTML/i);
  });
});
