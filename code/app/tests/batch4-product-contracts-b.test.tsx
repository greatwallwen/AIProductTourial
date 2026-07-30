// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { CutterHealthWorkbench } from "../src/components/workbenches/case-specific/CutterHealthWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";
import { WindUnderperformanceWorkbench } from "../src/components/workbenches/case-specific/WindUnderperformanceWorkbench";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const windRow = {
  turbine_id: "7",
  day: "1",
  source_records: "144",
  valid_wind_records: "144",
  valid_power_records: "144",
  mean_wind_speed: "7.5",
  mean_active_power: "450",
  underperformance_share: "1",
};
const windSelected: CaseProjection = {
  caseId: "B016",
  objectId: "16-7-1",
  state: "待定位",
  version: 0,
  payload: windRow,
  updatedAt: "2026-07-26T08:00:00.000Z",
};

const cutterRow = {
  session_id: "BD-0003",
  health_deviation_index: "3.856",
  rule_threshold: "3.775",
  rule_review_level: "关注",
  dominant_deviation_signal: "切刀转矩均值",
  cutter_torque_mean: "-0.0215",
  cutter_torque_std: "0.4373",
  cutter_follow_error_mean: "-0.000002",
  cutter_follow_error_std: "0.0783",
  film_follow_error_mean: "0.8211",
  film_follow_error_std: "0.1057",
};
const cutterSelected: CaseProjection = {
  caseId: "B017",
  objectId: "B017-BD-0003",
  state: "待复核",
  version: 0,
  payload: cutterRow,
  updatedAt: "2026-07-26T08:00:00.000Z",
};
const waveform = [
  { session_id: "BD-0003", sample_index: "1", cutter_motor_torque: "-0.2", cutter_follow_error: "-0.03", film_follow_error: "0.75" },
  { session_id: "BD-0003", sample_index: "2", cutter_motor_torque: "-0.1", cutter_follow_error: "-0.02", film_follow_error: "0.78" },
];

function windProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B016")!,
    objects: [windSelected], selected: windSelected, events: [], metrics: [], datasetRowCount: 938,
    sceneRows: [windRow], supportingArtifacts: {}, actorRole: "supervisor",
    roles: ["reliability_engineer", "supervisor"],
    commands: [{ id: "schedule_maintenance", label: "确认核查已提交", tone: "primary" }],
    busy: false, onActorRoleChange: vi.fn(), onCommand: vi.fn(), onReset: vi.fn(), onSelect: vi.fn(), ...overrides,
  };
}

function cutterProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B017")!,
    objects: [cutterSelected], selected: cutterSelected, events: [], metrics: [], datasetRowCount: 519,
    sceneRows: [], supportingArtifacts: {}, actorRole: "maintenance_planner",
    roles: ["maintenance_planner", "supervisor"],
    commands: [{ id: "continue_monitoring", label: "继续采样观察", tone: "secondary" }],
    busy: false, onActorRoleChange: vi.fn(), onCommand: vi.fn(), onReset: vi.fn(), onSelect: vi.fn(), ...overrides,
  };
}

describe("batch 4 product contracts — cases 16 and 17", () => {
  it("案例 16：待定位且无持久化任务时主管不能确认核查", () => {
    const onCommand = vi.fn();
    render(<WindUnderperformanceWorkbench {...windProps({ onCommand })} />);

    const confirm = screen.getByRole("button", { name: "确认核查已提交" });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("案例 17：无波形不能继续采样；有波形时必须提交摘要、波形和游标证据", () => {
    const onCommand = vi.fn();
    const { rerender } = render(<CutterHealthWorkbench {...cutterProps({ onCommand })} />);

    fireEvent.change(screen.getByLabelText("继续采样数量"), { target: { value: "256" } });
    fireEvent.change(screen.getByLabelText("继续采样理由"), { target: { value: "当前窗口不足，需要补充采样覆盖下一生产节拍。" } });
    const continuation = screen.getByRole("button", { name: "请求继续采样" });
    expect(continuation).toBeDisabled();
    fireEvent.click(continuation);
    expect(onCommand).not.toHaveBeenCalled();

    rerender(<CutterHealthWorkbench {...cutterProps({ onCommand, supportingArtifacts: { "waveform.csv": waveform } })} />);
    const enabledContinuation = screen.getByRole("button", { name: "请求继续采样" });
    expect(enabledContinuation).toBeEnabled();
    fireEvent.click(enabledContinuation);
    expect(onCommand).toHaveBeenCalledWith(
      "continue_monitoring",
      expect.any(String),
      expect.objectContaining({
        evidenceIds: expect.arrayContaining([
          "session:BD-0003:summary",
          "waveform:BD-0003:samples-2",
          "waveform:BD-0003:cursor-1",
        ]),
      }),
    );
  });
});
