// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { FlotationReviewWorkbench } from "../src/components/workbenches/case-specific/FlotationReviewWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function hour(index: number): string {
  const value = new Date(Date.UTC(2017, 2, 30, 8 + index));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")} ${String(value.getUTCHours()).padStart(2, "0")}:00:00`;
}

const rows = Array.from({ length: 72 }, (_, index) => ({
  monitor_hour: hour(index),
  source_samples: 180,
  completeness_state: "完整",
  feed_iron_mean: 56.73,
  feed_silica_mean: 12.73,
  starch_flow_mean: 2146.2 + index,
  amine_flow_mean: 487.5 + index * 0.1,
  pulp_flow_mean: 402.46 + Math.sin(index / 5) * 5,
  pulp_ph_mean: 9.744 + Math.sin(index / 7) * 0.04,
  pulp_density_mean: 1.632 + Math.sin(index / 8) * 0.02,
  column_1_air_mean: 200.05,
  column_1_level_mean: 809.93,
  column_2_air_mean: 199.89,
  column_2_level_mean: 801.58,
  column_3_air_mean: 200.01,
  column_3_level_mean: 810.77,
  column_4_air_mean: 295.096,
  column_4_level_mean: 454.46,
  column_5_air_mean: 306.4,
  column_5_level_mean: 447.27,
  column_6_air_mean: 250.13,
  column_6_level_mean: 479.92,
  column_7_air_mean: 249.84,
  column_7_level_mean: 467.25,
  concentrate_iron_mean: 64.03,
  concentrate_silica_mean: index >= 33 ? 3.11 : 2.78,
  quality_state: index >= 33 ? "高杂质" : "正常",
  consecutive_high_hours: index >= 33 ? index - 32 : 0,
}));

const events = [{
  event_id: "FQ-0016",
  start_hour: "2017-03-31 17:00:00",
  end_hour: "2017-04-02 07:00:00",
  duration_hours: "39",
  peak_silica: "3.11",
  dominant_deviation: "3号浮选柱风量:-3.07|1号浮选柱风量:-3.04|2号浮选柱风量:-2.82",
}, {
  event_id: "FQ-0015",
  start_hour: "2017-03-30 17:00:00",
  end_hour: "2017-03-31 03:00:00",
  duration_hours: "11",
  dominant_deviation: "1号浮选柱风量:-2.11",
}];

function projection(overrides: Partial<CaseProjection> = {}): CaseProjection {
  return {
    caseId: "B014",
    objectId: "14-2017-04-02-07-00-00",
    state: "待诊断",
    version: 0,
    payload: rows.at(-1)!,
    updatedAt: "2026-07-27T06:00:00.000Z",
    ...overrides,
  };
}

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  const selected = projection();
  return {
    definition: getCaseDefinition("B014")!,
    objects: [selected],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 720,
    sceneRows: rows,
    supportingArtifacts: { "events.csv": events },
    actorRole: "process_engineer",
    roles: ["process_engineer", "supervisor"],
    commands: [{ id: "submit_process_review", label: "提交工艺复核", tone: "primary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("FlotationReviewWorkbench", () => {
  it("treats FQ-0016 as the investigation object and uses its declared priority cells", () => {
    render(<FlotationReviewWorkbench {...props()} />);
    expect(screen.getByRole("main", { name: "连续高硅事件调查台" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "连续事件" })).toBeVisible();
    expect(screen.getByRole("complementary", { name: "调查流程" })).toBeVisible();
    expect(screen.getAllByText("FQ-0016").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("持续 39 小时")).toBeVisible();
    expect(screen.getByLabelText("3 号槽风量与液位")).toBeChecked();
    expect(screen.getByLabelText("1 号槽风量与液位")).toBeChecked();
    expect(screen.getByLabelText("2 号槽风量与液位")).toBeChecked();
    expect(screen.queryByLabelText("5 号槽风量与液位")).not.toBeInTheDocument();
    expect(screen.getByText("共变只决定先查什么，不直接判定根因。")).toBeVisible();
  });

  it("renders exactly 72 continuous points and changes to a real 24-hour slice", () => {
    render(<FlotationReviewWorkbench {...props()} />);
    expect(screen.getByText(/72 个连续点/)).toBeVisible();
    expect(document.querySelector('polyline[data-line="silica"]')?.getAttribute("points")?.trim().split(/\s+/u)).toHaveLength(72);
    fireEvent.change(screen.getByLabelText("趋势时间范围"), { target: { value: "24" } });
    expect(screen.getByText(/24 个连续点/)).toBeVisible();
    expect(document.querySelector('polyline[data-line="silica"]')?.getAttribute("points")?.trim().split(/\s+/u)).toHaveLength(24);
  });

  it("submits a frozen event-level check sheet backed by the selected window", () => {
    const onCommand = vi.fn();
    render(<FlotationReviewWorkbench {...props({ onCommand })} />);
    fireEvent.change(screen.getByLabelText("工艺核查说明"), { target: { value: "先核对三、一、二号槽的风量、液位与仪表记录。" } });
    fireEvent.click(screen.getByRole("button", { name: "提交工艺复核" }));
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0][0]).toBe("submit_process_review");
    expect(onCommand.mock.calls[0][2]).toMatchObject({
      actorId: "case14-process-engineer",
      data: { processReview: {
        taskId: "FLOT-FQ-0016",
        eventId: "FQ-0016",
        hours: "72",
        rowCount: 72,
        windowStart: "2017-03-30 08:00:00",
        windowEnd: "2017-04-02 07:00:00",
        selectedChecks: ["3", "1", "2"],
        priorityCellIds: ["3", "1", "2"],
        createdBy: "case14-process-engineer",
      } },
      evidenceIds: expect.arrayContaining(["event:FQ-0016", "cell-air:3", "cell-air:1", "cell-air:2", "quality:2017-04-02 07:00:00"]),
    });
  });

  it("restores and freezes the submitted sheet for an independent supervisor", () => {
    const saved = {
      taskId: "FLOT-FQ-0016", eventId: "FQ-0016", hours: "72", note: "先核对三、一、二号槽的风量与液位。",
      hypothesis: "air_balance", assignee: "当班工艺工程师", dueAt: "2026-07-30",
      windowStart: "2017-03-30 08:00:00", windowEnd: "2017-04-02 07:00:00", rowCount: 72,
      evidenceItems: ["event:FQ-0016", "trend:2017-03-30 08:00:00:2017-04-02 07:00:00", "cell-air:3", "cell-air:1", "cell-air:2", "quality:2017-04-02 07:00:00"],
      selectedChecks: ["3", "1", "2"], priorityCellIds: ["3", "1", "2"], createdBy: "case14-process-engineer",
    };
    const selected = projection({ state: "工艺复核中", version: 1, task: { processReview: saved } });
    const onCommand = vi.fn();
    render(<FlotationReviewWorkbench {...props({ selected, objects: [selected], actorRole: "supervisor", commands: [{ id: "dispatch_instrument_check", label: "下发仪表核查", tone: "primary" }], onCommand })} />);
    expect(screen.getByLabelText("趋势时间范围")).toBeDisabled();
    expect(screen.getByLabelText("核查负责人")).toBeDisabled();
    const review = screen.getByRole("complementary", { name: "调查流程" });
    fireEvent.change(within(review).getByLabelText("主管核查意见"), { target: { value: "同意按已冻结窗口下发现场核查。" } });
    fireEvent.click(within(review).getByRole("button", { name: "下发仪表核查" }));
    expect(onCommand.mock.calls[0][2]).toMatchObject({
      actorId: "case14-production-supervisor",
      data: { processReview: saved, supervisorDecision: { taskId: "FLOT-FQ-0016", supervisorId: "case14-production-supervisor" } },
    });
  });

  it("keeps markup deterministic and animation bounded", () => {
    const component = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/FlotationReviewWorkbench.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/FlotationReviewWorkbench.module.css"), "utf8");
    expect(component).not.toContain("Date.now(");
    expect(component).not.toContain("Math.random(");
    expect(component).not.toContain("typeof window");
    expect(component).not.toContain("new Date(");
    expect(component).toContain("suppressHydrationWarning");
    expect(css).toContain("prefers-reduced-motion");
    expect(css).not.toContain("infinite");
  });
});
