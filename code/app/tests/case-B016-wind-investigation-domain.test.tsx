// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { WindUnderperformanceWorkbench } from "../src/components/workbenches/case-specific/WindUnderperformanceWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

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
}));

const locations = Array.from({ length: 134 }, (_, index) => ({
  turbine_id: String(index + 1),
  turbine_x: String(3300 + (index % 14) * 39),
  turbine_y: String(5800 + Math.floor(index / 14) * 307),
}));

const selected: CaseProjection = {
  caseId: "B016",
  objectId: "16-7-1",
  state: "待定位",
  version: 0,
  payload: windRows[0],
  updatedAt: "2026-07-26T08:00:00.000Z",
};

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B016")!,
    objects: [selected],
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

describe("case 16 wind investigation aggregate", () => {
  it("opens an unloaded turbine by its deterministic first-day object id", () => {
    const onSelect = vi.fn();
    render(<WindUnderperformanceWorkbench {...props({ onSelect })} />);

    fireEvent.click(screen.getByRole("button", { name: "打开 T134 的首个运行日" }));
    expect(onSelect).toHaveBeenCalledWith("16-134-1");
  });

  it("creates a named field-check task with four requested evidence items and stable idempotency", () => {
    const onCommand = vi.fn();
    render(<WindUnderperformanceWorkbench {...props({ onCommand })} />);

    const submit = screen.getByRole("button", { name: "提交现场核查" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledTimes(2);
    const options = onCommand.mock.calls[0][2];
    expect(options.idempotencyKey).toBe("case-B016:turbine:7:submit_field_check:v0");
    expect(onCommand.mock.calls[1][2].idempotencyKey).toBe(options.idempotencyKey);
    expect(options.actorId).toBe("reliability-engineer-01");
    expect(options.data).toEqual(expect.objectContaining({
      aggregateType: "wind_underperformance_investigation",
      investigationId: "WIND-INV-7",
      taskVersion: 1,
      turbineId: "7",
      decision: "request_field_inspection",
      serverValidationRequired: true,
      request: expect.objectContaining({
        requestId: "WIND-CHECK-7",
        requesterId: "reliability-engineer-01",
        assigneeId: "field-team-01",
        status: "requested",
      }),
      evidence: {
        peer_baseline: { status: "requested", reference: undefined },
        curtailment_order: { status: "requested", reference: undefined },
        alarm_log: { status: "requested", reference: undefined },
        maintenance_result: { status: "requested", reference: undefined },
      },
    }));
  });

  it("restores a requested task, blocks an incomplete confirmation, then confirms returned evidence as another actor", () => {
    const pending: CaseProjection = {
      ...selected,
      state: "现场核查中",
      version: 1,
      task: {
        aggregateType: "wind_underperformance_investigation",
        investigationId: "WIND-INV-7",
        turbineId: "7",
        taskVersion: 1,
        request: {
          requestId: "WIND-CHECK-7",
          requesterId: "engineer-01",
          assigneeId: "field-team-01",
          expectedShift: "下一运行班",
          checks: ["补充同群基线", "核对限电指令"],
          note: "核对 T007 外部运行条件。",
          status: "requested",
        },
        evidence: {
          peer_baseline: { status: "requested" },
          curtailment_order: { status: "requested" },
          alarm_log: { status: "requested" },
          maintenance_result: { status: "requested" },
        },
      },
    };
    const onCommand = vi.fn();
    render(<WindUnderperformanceWorkbench {...props({
      selected: pending,
      objects: [pending],
      actorRole: "supervisor",
      commands: [{ id: "schedule_maintenance", label: "确认核查已提交", tone: "primary" }],
      onCommand,
    })} />);

    expect(screen.getAllByText("已申请")).toHaveLength(4);
    expect(screen.getByLabelText("现场核查发起人")).toHaveValue("engineer-01");
    const confirm = screen.getByRole("button", { name: "确认核查已提交" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText("现场检查人员"), { target: { value: "inspector-01" } });
    fireEvent.change(screen.getByLabelText("现场检查班次"), { target: { value: "夜班交接前" } });
    fireEvent.change(screen.getByLabelText("同群基线回执"), { target: { value: "peer-v3" } });
    fireEvent.change(screen.getByLabelText("限电指令回执"), { target: { value: "curtailment-none" } });
    fireEvent.change(screen.getByLabelText("告警记录回执"), { target: { value: "alarm-2026-07" } });
    fireEvent.change(screen.getByLabelText("维修结果回执"), { target: { value: "maintenance-closed" } });
    fireEvent.change(screen.getByLabelText("现场检查发现"), { target: { value: "功率测量链路需要重新标定。" } });
    fireEvent.change(screen.getByLabelText("主管确认说明"), { target: { value: "四类回执已逐项核对，同意提交维护安排。" } });

    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    const options = onCommand.mock.calls[0][2];
    expect(options.actorId).toBe("supervisor-01");
    expect(options.idempotencyKey).toBe("case-B016:turbine:7:schedule_maintenance:v1");
    expect(options.data).toEqual(expect.objectContaining({
      investigationId: "WIND-INV-7",
      decision: "confirm_field_inspection",
      fieldInspection: expect.objectContaining({ inspectorId: "inspector-01", peerBaselineRef: "peer-v3", status: "returned" }),
      supervisorConfirmation: { supervisorId: "supervisor-01", decision: "confirm", note: "四类回执已逐项核对，同意提交维护安排。" },
      evidence: {
        peer_baseline: { status: "verified", reference: "peer-v3" },
        curtailment_order: { status: "verified", reference: "curtailment-none" },
        alarm_log: { status: "verified", reference: "alarm-2026-07" },
        maintenance_result: { status: "verified", reference: "maintenance-closed" },
      },
    }));
  }, 10_000);
});
