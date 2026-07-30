// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { CutterHealthWorkbench } from "../src/components/workbenches/case-specific/CutterHealthWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const summary = {
  session_id: "BD-0003",
  cutter_torque_mean: "-0.0215",
  cutter_torque_std: "0.4373",
  cutter_follow_error_mean: "-0.000002",
  cutter_follow_error_std: "0.0783",
  film_follow_error_mean: "0.8211",
  film_follow_error_std: "0.1057",
  health_deviation_index: "3.856",
  rule_threshold: "3.775",
  rule_review_level: "关注",
  dominant_deviation_signal: "切刀转矩均值",
};

const waveform = Array.from({ length: 6 }, (_, index) => ({
  session_id: "BD-0003",
  sample_index: String(index + 1),
  cutter_motor_torque: String(-0.2 + index * 0.08),
  cutter_follow_error: String(-0.03 + index * 0.012),
  film_follow_error: String(0.75 + index * 0.03),
}));

const waveformSessionIds = Array.from({ length: 8 }, (_, index) => `BD-${String(index + 1).padStart(4, "0")}`);
const allWaveforms = waveformSessionIds.flatMap((candidateSessionId) => waveform.map((item) => ({
  ...item,
  session_id: candidateSessionId,
})));

const selected: CaseProjection = {
  caseId: "17",
  objectId: "17-BD-0003",
  state: "待复核",
  version: 0,
  payload: summary,
  updatedAt: "2026-07-26T08:00:00.000Z",
};
const second: CaseProjection = {
  ...selected,
  objectId: "17-BD-0010",
  payload: { ...summary, session_id: "BD-0010", health_deviation_index: "2.1" },
};
const waveformObjects = waveformSessionIds.map((candidateSessionId) => candidateSessionId === "BD-0003"
  ? selected
  : {
      ...selected,
      objectId: `17-${candidateSessionId}`,
      payload: { ...summary, session_id: candidateSessionId, rule_review_level: candidateSessionId === "BD-0007" ? "优先复核" : "常规" },
    });

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("17")!,
    objects: [...waveformObjects, second],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 519,
    sceneRows: [],
    supportingArtifacts: {
      "waveform.csv": allWaveforms,
      "review-queue.csv": Array.from({ length: 152 }, (_, index) => ({ queue_id: `Q-${index + 1}` })),
    },
    actorRole: "maintenance_planner",
    roles: ["maintenance_planner", "supervisor"],
    commands: [{ id: "schedule_night_inspection", label: "列入夜班排检候选", tone: "primary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("case 17 cutter review aggregate", () => {
  it("replaces decorative navigation with a real searchable session rail", () => {
    const onSelect = vi.fn();
    render(<CutterHealthWorkbench {...props({ onSelect })} />);

    expect(screen.getByLabelText("设备会话检索")).toHaveTextContent("519 摘要行");
    expect(screen.getByLabelText("设备会话检索")).toHaveTextContent("8 波形会话");
    expect(screen.getByLabelText("设备会话检索")).toHaveTextContent("152 规则队列");
    expect(screen.queryByRole("button", { name: "资产总览" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("搜索设备会话"), { target: { value: "BD-0008" } });
    expect(screen.queryByRole("button", { name: /BD-0003/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /BD-0008/ }));
    expect(onSelect).toHaveBeenCalledWith("17-BD-0008");
    expect(screen.queryByRole("button", { name: /BD-0010/ })).not.toBeInTheDocument();
  });

  it("moves three synchronized cursors and submits one versioned inspection window", () => {
    const onCommand = vi.fn();
    render(<CutterHealthWorkbench {...props({ onCommand })} />);

    expect(screen.getAllByText(/来源未标单位/)).toHaveLength(3);
    expect(document.body).not.toHaveTextContent(/N·m|\bmm\b/);
    expect(screen.getByLabelText("维护计划员排检表单")).toBeVisible();
    expect(screen.queryByLabelText("维护主管确认表单")).not.toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "保存排检计划" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("三通道同步游标"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("检查窗口起点"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("检查窗口终点"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("切刀复核说明"), { target: { value: "样本四附近三路波形同步抬升，安排窗口内排检。" } });

    const cursors = [...document.querySelectorAll('line[data-cursor]')];
    expect(cursors).toHaveLength(3);
    expect(cursors.map((item) => item.getAttribute("x1"))).toEqual(["600", "600", "600"]);
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledTimes(2);
    const options = onCommand.mock.calls[0][2];
    expect(options.actorId).toBe("planner-01");
    expect(options.idempotencyKey).toBe("case-17:session:BD-0003:schedule_night_inspection:v0");
    expect(onCommand.mock.calls[1][2].idempotencyKey).toBe(options.idempotencyKey);
    expect(options.data).toEqual(expect.objectContaining({
      aggregateType: "cutter_health_review_session",
      reviewId: "CUTTER-REVIEW-BD-0003",
      taskVersion: 1,
      sessionId: "BD-0003",
      decision: "schedule_inspection",
      serverValidationRequired: true,
      source: expect.objectContaining({
        channels: [
          { field: "cutter_motor_torque" },
          { field: "cutter_follow_error" },
          { field: "film_follow_error" },
        ],
      }),
      inspectionPlan: expect.objectContaining({
        planId: "CUTTER-PLAN-BD-0003",
        plannerId: "planner-01",
        inspectionWindow: { startSample: 2, endSample: 5 },
        syncedCursor: expect.objectContaining({
          sampleIndex: 4,
          channels: ["cutter_motor_torque", "cutter_follow_error", "film_follow_error"],
        }),
      }),
    }));
  });

  it("restores an event-backed plan and requires a different supervisor before confirmation", () => {
    const plan = {
      planId: "CUTTER-PLAN-BD-0003",
      sessionId: "BD-0003",
      plannerId: "planner-01",
      selectedSignal: "film_follow_error",
      syncedCursor: { sampleIndex: 3, channels: ["cutter_motor_torque", "cutter_follow_error", "film_follow_error"], values: {} },
      inspectionWindow: { startSample: 2, endSample: 5 },
      direction: "切刀转矩与薄膜跟随性能",
      note: "窗口二到五需要现场核对。",
      status: "pending_confirmation",
    };
    const event: CaseEvent = {
      eventId: "evt-17-plan",
      caseId: "17",
      objectId: selected.objectId,
      command: "schedule_night_inspection",
      actor: { id: "planner-01", role: "maintenance_planner" },
      fromState: "待复核",
      toState: "排检候选待确认",
      version: 1,
      evidenceIds: [],
      data: { aggregateType: "cutter_health_review_session", inspectionPlan: plan },
      occurredAt: "2026-07-26T09:00:00.000Z",
    };
    const pending: CaseProjection = { ...selected, state: "排检候选待确认", version: 1 };
    const onCommand = vi.fn();
    render(<CutterHealthWorkbench {...props({
      selected: pending,
      objects: [pending, second],
      events: [event],
      actorRole: "supervisor",
      commands: [{ id: "confirm_maintenance", label: "确认排检候选", tone: "primary" }],
      onCommand,
    })} />);

    expect(screen.getByLabelText("三通道同步游标")).toHaveValue("2");
    expect(screen.getByLabelText("已保存检查窗口")).toHaveTextContent("2—5");
    expect(screen.queryByLabelText("维护计划员账号")).not.toBeInTheDocument();
    expect(screen.getByLabelText("维护主管确认表单")).toBeVisible();
    const confirm = screen.getByRole("button", { name: "确认排检候选" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("维护主管账号"), { target: { value: "planner-01" } });
    fireEvent.change(screen.getByLabelText("维护主管确认说明"), { target: { value: "核对窗口和三路同步游标后确认。" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("维护主管账号"), { target: { value: "supervisor-02" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    expect(onCommand.mock.calls[0][2]).toEqual(expect.objectContaining({
      actorId: "supervisor-02",
      idempotencyKey: "case-17:session:BD-0003:confirm_maintenance:v1",
      data: expect.objectContaining({
        decision: "confirm_inspection",
        inspectionPlan: plan,
        supervisorConfirmation: {
          supervisorId: "supervisor-02",
          confirmedPlanId: "CUTTER-PLAN-BD-0003",
          note: "核对窗口和三路同步游标后确认。",
          decision: "confirm",
        },
      }),
    }));
  });

  it("requires a bounded continuation request and contains no autonomous animation", () => {
    const onCommand = vi.fn();
    render(<CutterHealthWorkbench {...props({ commands: [{ id: "continue_monitoring", label: "继续采样观察", tone: "secondary" }], onCommand })} />);
    const action = screen.getByRole("button", { name: "请求继续采样" });
    expect(action).toBeDisabled();
    fireEvent.change(screen.getByLabelText("继续采样数量"), { target: { value: "64" } });
    fireEvent.change(screen.getByLabelText("继续采样理由"), { target: { value: "当前窗口波形长度不足，需要覆盖下一生产节拍。" } });
    expect(action).toBeDisabled();
    fireEvent.change(screen.getByLabelText("继续采样数量"), { target: { value: "256" } });
    expect(action).toBeEnabled();
    fireEvent.click(action);
    expect(onCommand.mock.calls[0][2]).toEqual(expect.objectContaining({
      idempotencyKey: "case-17:session:BD-0003:continue_monitoring:v0",
      data: expect.objectContaining({ continuation: { additionalSamples: 256, reason: "当前窗口波形长度不足，需要覆盖下一生产节拍。", status: "requested" } }),
    }));

    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/CutterHealthWorkbench.tsx"), "utf8");
    const stylesheet = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/CutterHealthWorkbench.module.css"), "utf8");
    expect(source).not.toContain("animateMotion");
    expect(source).not.toContain('repeatCount="indefinite"');
    expect(source).not.toContain("setInterval(");
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
    expect(stylesheet).toMatch(/\.primaryAction\s*\{[^}]*min-height:\s*48px/s);
    expect(stylesheet).toMatch(/\.headerActions button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s);
  });

  it("keeps server markup deterministic and removes unsupported time promises", () => {
    const element = <CutterHealthWorkbench {...props()} />;
    expect(renderToString(element)).toBe(renderToString(element));

    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/CutterHealthWorkbench.tsx"), "utf8");
    expect(source).not.toMatch(/Date\.now|Math\.random|typeof window|new Date\(/);
    expect(document.body).not.toHaveTextContent(/今晚|夜班/);
  });
});
