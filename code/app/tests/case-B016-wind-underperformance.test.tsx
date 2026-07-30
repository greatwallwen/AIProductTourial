// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { WindUnderperformanceWorkbench } from "../src/components/workbenches/case-specific/WindUnderperformanceWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const windRows = [
  [1, 8.7921678, 579.36203, 143],
  [2, 6.4378873, 443.77986, 142],
  [3, 11.596667, 1140.758, 144],
  [4, 10.373125, 735.04451, 144],
  [5, 10.339028, 696.75111, 144],
  [6, 4.731875, 250.32181, 144],
  [7, 3.4093706, 90.366573, 143],
].map(([day, wind, power, valid]) => ({
  turbine_id: "7",
  day: String(day),
  source_records: "144",
  valid_wind_records: String(valid),
  valid_power_records: String(valid),
  mean_wind_speed: String(wind),
  mean_active_power: String(power),
  underperformance_share: "1",
  manual_inspection_only: "True",
}));

const locations = Array.from({ length: 134 }, (_, index) => ({
  turbine_id: String(index + 1),
  turbine_x: String(3300 + (index % 14) * 39),
  turbine_y: String(5800 + Math.floor(index / 14) * 307),
  data_nature: "public-location-fact",
}));

function projection(turbineId: string, day = "1"): CaseProjection {
  const row = turbineId === "7"
    ? windRows[Number(day) - 1]
    : { ...windRows[0], turbine_id: turbineId, day, underperformance_share: "0" };
  return {
    caseId: "B016",
    objectId: `16-${turbineId}-${day}`,
    state: "待定位",
    version: 0,
    payload: row,
    updatedAt: "2026-07-26T07:00:00.000Z",
  };
}

const selected = projection("7");
const second = projection("8");

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B016")!,
    objects: [selected, second],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 938,
    sceneRows: windRows,
    supportingArtifacts: { "turbine-locations.csv": locations },
    actorRole: "reliability_engineer",
    roles: ["reliability_engineer", "supervisor"],
    commands: [{ id: "submit_field_check", label: "提交现场核查", tone: "primary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("WindUnderperformanceWorkbench", () => {
  it("renders 134 public relative locations and the seven-day T007 evidence without overstating the marker", () => {
    render(<WindUnderperformanceWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "风机出力下偏核查" })).toBeVisible();
    expect(document.querySelectorAll(".wind-relative-field__turbine")).toHaveLength(134);
    expect(screen.getByLabelText("风机相对坐标示意")).toHaveTextContent("T007");
    expect(screen.getByText("7 / 7 个运行日")).toBeVisible();
    expect(screen.getByText("运行日 7")).toBeVisible();
    expect(screen.getAllByText("1,004 / 1,008")).toHaveLength(2);
    expect(screen.getAllByText("未提供")).toHaveLength(4);
    expect(screen.getByText("日级标记，不是故障概率")).toBeVisible();
    expect(screen.getByText(/当前数据只能说明七个运行日均出现下偏标记/)).toBeVisible();
    expect(screen.queryByText(/故障概率\s*[:：]?\s*\d/)).not.toBeInTheDocument();
    expect(screen.getByText("课程指定对象，并非最差机组")).toBeVisible();
  });

  it("uses one selector for turbine choice and keeps both evidence units visibly separate", () => {
    const onSelect = vi.fn();
    render(<WindUnderperformanceWorkbench {...props({ onSelect })} />);

    fireEvent.change(screen.getByLabelText("选择风机"), { target: { value: "8" } });
    expect(onSelect).toHaveBeenCalledWith("16-8-1");
    expect(screen.getByRole("img", { name: "平均风速七日趋势，单位 m/s" })).toBeVisible();
    expect(screen.getByRole("img", { name: "平均有功功率七日趋势，单位 kW" })).toBeVisible();
    expect(screen.getByText(/两个指标采用独立量纲展示/)).toBeVisible();
  });

  it("submits the reliability engineer field-check action with a structured reason", () => {
    const onCommand = vi.fn();
    render(<WindUnderperformanceWorkbench {...props({ onCommand })} />);

    fireEvent.click(screen.getByRole("button", { name: "提交现场核查" }));

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0][0]).toBe("submit_field_check");
    const reason = JSON.parse(String(onCommand.mock.calls[0][1]).replace("wind-field-check:", ""));
    expect(reason).toMatchObject({
      turbineId: "7",
      scope: "seven_operating_days",
      actorRole: "reliability_engineer",
      command: "submit_field_check",
    });
  });

  it("blocks supervisor confirmation before a field task exists and still allows an evidence hold", () => {
    const onCommand = vi.fn();
    const onActorRoleChange = vi.fn();
    render(
      <WindUnderperformanceWorkbench
        {...props({
          actorRole: "supervisor",
          commands: [
            { id: "schedule_maintenance", label: "确认核查已提交", tone: "primary" },
            { id: "hold_attribution", label: "请求补充同群数据", tone: "secondary" },
          ],
          onCommand,
          onActorRoleChange,
        })}
      />,
    );

    expect(screen.getAllByText("业务主管").length).toBeGreaterThanOrEqual(1);
    fireEvent.change(screen.getByLabelText("当前操作角色"), { target: { value: "reliability_engineer" } });
    fireEvent.change(screen.getByLabelText("现场核查说明"), { target: { value: "先核对 T007 功率测量链路。" } });
    const confirm = screen.getByRole("button", { name: "确认核查已提交" });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    fireEvent.click(screen.getByRole("button", { name: "请求补充同群数据" }));

    expect(onActorRoleChange).toHaveBeenCalledWith("reliability_engineer");
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls.map((call) => call[0])).toEqual(["hold_attribution"]);
    const persisted = JSON.parse(String(onCommand.mock.calls[0][1]).replace("wind-field-check:", ""));
    expect(persisted).toMatchObject({
      turbineId: "7",
      scope: "seven_operating_days",
      actorRole: "supervisor",
      command: "hold_attribution",
      note: "先核对 T007 功率测量链路。",
    });
    expect(persisted.checks).toContain("补充同群基线");
  });

  it("restores the latest structured reason and offers object-scoped error recovery", () => {
    const reason = 'wind-field-check:{"turbineId":"7","scope":"seven_operating_days","checks":["核对限电指令"],"note":"恢复后的核查说明","actorRole":"reliability_engineer","command":"submit_field_check"}';
    const event = {
      eventId: "evt-16",
      caseId: "B016",
      objectId: selected.objectId,
      command: "submit_field_check",
      fromState: "待定位",
      toState: "现场核查中",
      actor: { id: "reliability_engineer", role: "reliability_engineer" },
      version: 1,
      occurredAt: "2026-07-26T07:20:00.000Z",
      reason,
      evidenceIds: [],
    } satisfies CaseEvent;
    const onSelect = vi.fn();
    render(<WindUnderperformanceWorkbench {...props({ events: [event], error: "对象状态已更新，请重新载入。", onSelect })} />);

    expect(screen.getByLabelText("现场核查说明")).toHaveValue("恢复后的核查说明");
    expect(screen.getByLabelText("核对限电指令")).toBeChecked();
    expect(screen.getByLabelText("补充同群基线")).not.toBeChecked();
    expect(screen.getByText("已从最近一次核查事件恢复说明")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "重新载入 T007" }));
    expect(onSelect).toHaveBeenCalledWith(selected.objectId);
  });

  it("keeps rendering deterministic and free of runtime-dependent branches", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/workbenches/case-specific/WindUnderperformanceWorkbench.tsx"),
      "utf8",
    );
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("typeof window");
    expect(source).not.toContain("new Date(");
  });

  it("keeps actions in the current step without an independently scrolling dossier", () => {
    render(<WindUnderperformanceWorkbench {...props()} />);
    const actions = screen.getByRole("region", { name: "核查任务动作" });
    expect(actions).toHaveAttribute("data-sticky-actions", "false");

    const css = readFileSync(
      resolve(process.cwd(), "src/components/workbenches/case-specific/WindUnderperformanceWorkbench.module.css"),
      "utf8",
    );
    expect(css).not.toContain("overflow-y: auto");
    expect(css).toMatch(/\.actions button \{[\s\S]*?min-height: 46px/);
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
