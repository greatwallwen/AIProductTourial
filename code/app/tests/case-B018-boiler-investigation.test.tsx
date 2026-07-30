// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadDatasetProjection } from "../../cases/load-dataset";
import { getCaseDefinition } from "../../cases/registry";
import { BoilerEventWorkbench } from "../src/components/workbenches/case-specific/BoilerEventWorkbench";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const definition = getCaseDefinition("B018")!;
const dataset = loadDatasetProjection(definition);
const featuredRow = dataset.rows.find((row) => row.objectId === definition.featuredObjectId)!;

function projection(row = featuredRow, overrides: Partial<CaseProjection> = {}): CaseProjection {
  const { objectId, decision: _decision, ...payload } = row;
  return {
    caseId: "B018",
    objectId,
    state: definition.initialState,
    version: 0,
    payload,
    updatedAt: "2026-07-27T08:00:00.000Z",
    ...overrides,
  };
}

const selected = projection();

function workbenchProps(overrides: Record<string, unknown> = {}) {
  return {
    definition,
    objects: [selected],
    selected,
    events: [],
    metrics: dataset.metrics,
    sceneRows: dataset.sceneRows,
    supportingArtifacts: dataset.supportingArtifacts,
    datasetRowCount: dataset.rowCount,
    actorRole: "process_engineer",
    roles: ["process_engineer", "supervisor"],
    commands: [{ id: "dispatch_shift_check", label: "提交当班排查", tone: "primary" as const }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("BoilerEventWorkbench", () => {
  it("renders the selected event as an industrial investigation console", () => {
    render(<BoilerEventWorkbench {...workbenchProps()} />);

    expect(screen.getByRole("main", { name: "主汽低温事件核查台" })).toHaveTextContent("BT-0044");
    expect(screen.getByRole("region", { name: "锅炉设备与证据路径" })).toBeVisible();
    expect(screen.getByRole("img", { name: "BT-0044 事件 25 分钟主蒸汽出口温度曲线" })).toBeVisible();
    expect(screen.getByText(/25 个连续分钟点/)).toBeVisible();
    expect(screen.getByText("530–545°C 是来源区间，不是厂方控制限。")).toBeVisible();
    expect(screen.getByRole("button", { name: "温度场" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("radio", { name: "出口测温链路" })).toBeChecked();
  });

  it("dispatches an event-bound task without treating requested sources as attached evidence", () => {
    const onCommand = vi.fn();
    render(<BoilerEventWorkbench {...workbenchProps({ onCommand })} />);

    fireEvent.click(screen.getByRole("radio", { name: "末级过热器出口段" }));
    fireEvent.change(screen.getByLabelText("检查负责人"), { target: { value: "运行一班 张工" } });
    fireEvent.change(screen.getByLabelText("当班排查说明"), {
      target: { value: "出口温度连续下偏，先核对末级过热器前后段温差。" },
    });
    const submit = screen.getByRole("button", { name: /提交当班排查/ });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    const [command, reason, options] = onCommand.mock.calls[0]!;
    expect(command).toBe("dispatch_shift_check");
    expect(reason).toContain("末级过热器");
    expect(options).toMatchObject({
      actorId: "case18-boiler-engineer",
      data: {
        taskId: "boiler-check:B018-BT-0044:v1",
        eventId: "BT-0044",
        windowStartMinute: "2022-03-29 17:22",
        windowEndMinute: "2022-03-29 17:46",
        windowRowCount: 25,
        segmentId: "final-superheater-section",
        requestedSourceIds: expect.arrayContaining(["desuperheater-valve", "desuperheater-flow", "section-temperatures"]),
      },
      evidenceIds: [
        "boiler-event:BT-0044",
        "boiler-window:2022-03-29 17:22:2022-03-29 17:46",
        "minute-temperature",
        "sample-integrity",
      ],
    });
    expect(options.evidenceIds).not.toContain("desuperheater-flow");
  });

  it("freezes the submitted segment for an independent supervisor", () => {
    const task = {
      taskId: "boiler-check:B018-BT-0044:v1",
      objectId: "B018-BT-0044",
      objectVersion: 1,
      eventId: "BT-0044",
      eventStartTime: "2022-03-29 17:22:39",
      eventEndTime: "2022-03-29 17:46:59",
      windowStartMinute: "2022-03-29 17:22",
      windowEndMinute: "2022-03-29 17:46",
      windowRowCount: 25,
      monitorMinute: "2022-03-29 17:46",
      observedTemperatureC: 529.8458333333333,
      segmentId: "desuperheater-section",
      investigationReason: "出口温度连续下偏，补取减温水阀位和流量核对响应。",
      assignee: "运行二班 李工",
      attachedEvidenceIds: ["minute-temperature", "sample-integrity"],
      requestedSourceIds: ["desuperheater-valve", "desuperheater-flow"],
      createdBy: "case18-boiler-engineer",
    };
    const progressed = projection(featuredRow, { state: "当班排查中", version: 1, task });
    const event: CaseEvent = {
      eventId: "evt-case18",
      caseId: "B018",
      objectId: progressed.objectId,
      command: "dispatch_shift_check",
      actor: { id: "case18-boiler-engineer", role: "process_engineer" },
      fromState: "待定位",
      toState: "当班排查中",
      version: 1,
      occurredAt: "2026-07-27T08:10:00.000Z",
      reason: task.investigationReason,
      evidenceIds: ["boiler-event:BT-0044"],
      data: task,
    };
    const onCommand = vi.fn();
    render(<BoilerEventWorkbench {...workbenchProps({
      objects: [progressed],
      selected: progressed,
      events: [event],
      actorRole: "supervisor",
      commands: [
        { id: "confirm_segment", label: "确认优先检查段", tone: "primary" as const },
        { id: "hold_control_change", label: "阻断自动调节", tone: "danger" as const },
      ],
      onCommand,
    })} />);

    expect(screen.getByRole("radio", { name: "减温水调节段" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "减温水调节段" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("主管核查意见"), {
      target: { value: "同意先查减温水调节段，完成后回填阀位与流量。" },
    });
    fireEvent.click(screen.getByRole("button", { name: /确认优先检查段/ }));
    expect(onCommand).toHaveBeenCalledWith(
      "confirm_segment",
      "同意先查减温水调节段，完成后回填阀位与流量。",
      expect.objectContaining({
        actorId: "case18-operation-supervisor",
        data: expect.objectContaining({ segmentId: "desuperheater-section", prerequisiteTaskId: task.taskId }),
      }),
    );
  });

  it("lets a supervisor block automatic control before a task exists", () => {
    const onCommand = vi.fn();
    render(<BoilerEventWorkbench {...workbenchProps({
      actorRole: "supervisor",
      commands: [{ id: "hold_control_change", label: "阻断自动调节", tone: "danger" as const }],
      onCommand,
    })} />);
    fireEvent.change(screen.getByLabelText("主管核查意见"), {
      target: { value: "控制边界未确认，先阻断自动调节并安排人工核查。" },
    });
    fireEvent.click(screen.getByRole("button", { name: /阻断自动调节/ }));
    expect(onCommand).toHaveBeenCalledWith(
      "hold_control_change",
      "控制边界未确认，先阻断自动调节并安排人工核查。",
      expect.objectContaining({
        actorId: "case18-operation-supervisor",
        evidenceIds: [
          "boiler-event:BT-0044",
          "boiler-window:2022-03-29 17:22:2022-03-29 17:46",
        ],
      }),
    );
  });
});
