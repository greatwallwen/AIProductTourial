// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { WaferRetestWorkbench } from "../src/components/workbenches/case-specific/WaferRetestWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const sensorValues = {
  sensor_021: "-5447.75", sensor_022: "2701.75", sensor_024: "-1916.5", sensor_090: "9317.1698",
  sensor_158: "", sensor_159: "562", sensor_160: "788", sensor_161: "759", sensor_162: "2100",
  sensor_294: "251.4536", sensor_295: "329.6406", sensor_296: "325.0672",
};

function objectAt(index: number, state = "待复核", task?: Record<string, unknown>): CaseProjection {
  const waferId = `SECOM-${String(index + 1).padStart(4, "0")}`;
  return {
    caseId: "15",
    objectId: `15-${waferId}`,
    state,
    version: state === "待复核" ? 0 : 1,
    payload: {
      wafer_id: waferId,
      test_timestamp: `19/07/2008 13:${String(index % 60).padStart(2, "0")}:00`,
      quality_label: index % 3 === 2 ? "fail" : "pass",
      review_priority: index % 3 === 2 ? "quality-gate-review" : "routine-review",
      ...sensorValues,
    },
    task,
    updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

const objects = Array.from({ length: 55 }, (_, index) => objectAt(index));
const selected = objects[2];
const ranking = Object.keys(sensorValues).map((sensorId, index) => ({
  sensor_id: sensorId,
  missing_rows: sensorId === "sensor_158" ? "1429" : String(index),
}));

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("15")!,
    objects,
    selected,
    events: [],
    metrics: [{ id: "failed", label: "未通过观测", value: "104", note: "原始质量标签" }],
    datasetRowCount: 1567,
    sceneRows: objects.map((item) => item.payload),
    supportingArtifacts: { "sensor-ranking.csv": ranking },
    actorRole: "quality_engineer",
    roles: ["quality_engineer", "supervisor"],
    commands: [{ id: "request_retest", label: "隔离记录并提交复测", tone: "primary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

function completeRequestForm() {
  for (const name of ["保留原始记录与质量标签", "核对缺失通道与全局缺失量", "确认复测结果仍需人工复核"]) {
    fireEvent.click(screen.getByRole("checkbox", { name }));
  }
  fireEvent.change(screen.getByLabelText("复测说明"), { target: { value: "复测缺失通道并保留原始质量标签" } });
}

describe("WaferRetestWorkbench domain loop", () => {
  it("paginates every loaded observation and can select a record beyond the first page", () => {
    const onSelect = vi.fn();
    render(<WaferRetestWorkbench {...props({ onSelect })} />);
    expect(screen.getByText("演示队列 55 / 数据集 1,567")).toBeVisible();
    expect(screen.getByText(/第 1 \/ 7 页/)).toBeVisible();
    expect(screen.queryByRole("button", { name: /SECOM-0025/ })).not.toBeInTheDocument();
    for (let index = 0; index < 3; index += 1) fireEvent.click(screen.getByRole("button", { name: "下一页演示观测" }));
    expect(screen.getByText(/第 4 \/ 7 页/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /SECOM-0025/ }));
    expect(onSelect).toHaveBeenCalledWith("15-SECOM-0025");
  });

  it("persists wafer identity, selected sensor evidence and a named retest task", () => {
    const onCommand = vi.fn();
    render(<WaferRetestWorkbench {...props({ onCommand })} />);
    completeRequestForm();
    fireEvent.click(screen.getByRole("button", { name: "隔离记录并提交复测" }));

    const [command, reason, options] = onCommand.mock.calls[0]!;
    expect(command).toBe("request_retest");
    expect(reason).toContain("wafer-retest:");
    expect(options.data).toMatchObject({
      aggregateType: "wafer_retest_case",
      waferObservationId: "SECOM-0003",
      observationVersion: 0,
      originalQualityLabel: "fail",
      decision: "request_retest",
      serverValidationRequired: true,
      retestTask: {
        taskId: "RETEST-SECOM-0003-V1",
        selectedSensorIds: ["sensor_158"],
        requestedByRole: "quality_engineer",
        requestedByActorId: "case15-quality-engineer",
        status: "requested",
      },
    });
    expect(options.data.sensorEvidence).toEqual([
      expect.objectContaining({ sensorId: "sensor_158", rawValue: null, numericValue: null, isMissing: true, datasetMissingRows: 1429 }),
    ]);
    expect(options.evidenceIds).toEqual(expect.arrayContaining(["wafer:SECOM-0003", "sensor:SECOM-0003:sensor_158", "retest-task:RETEST-SECOM-0003-V1"]));
    expect(options.idempotencyKey).toBe("case-15:wafer:SECOM-0003:request_retest:v0");
  });

  it("restores the retest aggregate and requires a supervisor before confirmation", () => {
    const task = {
      aggregateType: "wafer_retest_case",
      retestTask: {
        taskId: "RETEST-SECOM-0003-V1",
        selectedSensorIds: ["sensor_158", "sensor_090"],
        requestedChecks: { preserve: true, missing: true, manual: true },
        requestedByRole: "quality_engineer",
        requestedByActorId: "case15-quality-engineer",
        note: "复测缺失通道并保留原始记录",
        status: "requested",
      },
    };
    const progressed = { ...objectAt(2, "复测申请已提交", task), objectId: selected.objectId };
    const command = [{ id: "release_batch", label: "确认复测申请", tone: "primary" as const }];
    const { rerender } = render(<WaferRetestWorkbench {...props({ selected: progressed, objects: [progressed, ...objects.filter((item) => item.objectId !== progressed.objectId)], commands: command })} />);
    expect(screen.getByRole("button", { name: "确认复测申请" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /从复测中移除 sensor_090/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("复测说明")).toHaveValue("复测缺失通道并保留原始记录");

    const onCommand = vi.fn();
    rerender(<WaferRetestWorkbench {...props({ selected: progressed, objects: [progressed, ...objects.filter((item) => item.objectId !== progressed.objectId)], actorRole: "supervisor", commands: command, onCommand })} />);
    fireEvent.change(screen.getByLabelText("复测说明"), { target: { value: "确认任务范围后进入复测执行" } });
    const confirm = screen.getByRole("button", { name: "确认复测申请" });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(onCommand.mock.calls[0]![2].data.supervisorReview).toEqual({
      decision: "confirm_retest_request",
      reviewerRole: "supervisor",
      reviewerId: "case15-quality-supervisor",
      prerequisiteTaskId: "RETEST-SECOM-0003-V1",
      note: "确认任务范围后进入复测执行",
    });
  });

  it("allows only a supervisor with a reason to continue quarantine", () => {
    const onCommand = vi.fn();
    render(<WaferRetestWorkbench {...props({ actorRole: "supervisor", commands: [{ id: "quarantine_batch", label: "继续隔离观察", tone: "danger" }], onCommand })} />);
    const quarantine = screen.getByRole("button", { name: "继续隔离观察" });
    expect(quarantine).toBeDisabled();
    fireEvent.change(screen.getByLabelText("复测说明"), { target: { value: "缺失通道尚未形成可复核的新读数" } });
    expect(quarantine).toBeEnabled();
    fireEvent.click(quarantine);
    expect(onCommand.mock.calls[0]![2]).toMatchObject({
      data: {
        decision: "continue_quarantine",
        retestTask: null,
        supervisorReview: { reviewerRole: "supervisor", reviewerId: "case15-quality-supervisor", prerequisiteTaskId: null, note: "缺失通道尚未形成可复核的新读数" },
      },
      idempotencyKey: "case-15:wafer:SECOM-0003:quarantine_batch:v0",
    });
    expect(onCommand.mock.calls[0]![2].evidenceIds.some((id: string) => id.startsWith("retest-task:"))).toBe(false);
  });

  it("has no fake navigation or non-deterministic scene behavior", () => {
    render(<WaferRetestWorkbench {...props()} />);
    expect(screen.queryByRole("button", { name: /更多操作/ })).not.toBeInTheDocument();
    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/WaferRetestWorkbench.tsx"), "utf8");
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("repeatCount=\"indefinite\"");
    expect(source).not.toContain("animateMotion");
  });

  it("shows a stable four-step completion state after supervisor confirmation", () => {
    const task = {
      retestTask: {
        taskId: "RETEST-SECOM-0003-V1",
        selectedSensorIds: ["sensor_158"],
        requestedChecks: { preserve: true, missing: true, manual: true },
        requestedByRole: "quality_engineer",
        requestedByActorId: "case15-quality-engineer",
        note: "复测缺失通道并保留原始记录",
        status: "requested",
      },
      supervisorReview: {
        decision: "confirm_retest_request",
        reviewerRole: "supervisor",
        reviewerId: "case15-quality-supervisor",
        prerequisiteTaskId: "RETEST-SECOM-0003-V1",
        note: "确认任务范围后进入复测执行",
      },
    };
    const completed = { ...objectAt(2, "复测申请已确认", task), objectId: selected.objectId, version: 2 };
    render(<WaferRetestWorkbench {...props({ selected: completed, objects: [completed], actorRole: "supervisor", commands: [] })} />);
    expect(screen.getByText("四步已完成")).toBeVisible();
    expect(screen.getAllByText("复测申请已确认").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("RETEST-SECOM-0003-V1").length).toBeGreaterThanOrEqual(1);
  });
});
