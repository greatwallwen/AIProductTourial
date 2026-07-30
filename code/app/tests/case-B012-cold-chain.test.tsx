// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseEvent, CaseProjection, CommandResult } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { ColdChainInvestigationWorkbench } from "../src/components/workbenches/case-specific/ColdChainInvestigationWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const locations = [
  ["四川", "彭州市", "CN-SC-PZ-01"],
  ["四川", "都江堰市", "CN-SC-DJY-02"],
  ["云南", "安宁市", "CN-YN-AN-03"],
  ["云南", "嵩明县", "CN-YN-SM-04"],
  ["湖北", "新洲区", "CN-HB-XZ-05"],
  ["河南", "新郑市", "CN-HA-XZ-06"],
  ["陕西", "周至县", "CN-SN-ZZ-07"],
  ["浙江", "桐庐县", "CN-ZJ-TL-08"],
  ["广东", "龙门县", "CN-GD-LM-09"],
  ["福建", "闽侯县", "CN-FJ-MH-10"],
  ["辽宁", "法库县", "CN-LN-FK-11"],
  ["河北", "正定县", "CN-HE-ZD-12"],
] as const;

function eventTime(step: number): string {
  const totalMinutes = 7 * 60 + 30 + step * 5;
  return `2026-07-06T${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}:00`;
}

function routeRows(routeIndex: number): Record<string, unknown>[] {
  const routeNumber = routeIndex + 1;
  const [province, county, routeId] = locations[routeIndex];
  const hasExcursion = [1, 4, 7, 10].includes(routeNumber);
  const missingHandoff = [1, 8].includes(routeNumber);
  const offline = [6, 12].includes(routeNumber);
  return Array.from({ length: 30 }, (_, step) => {
    const excursionStep = hasExcursion && step >= 9 && step <= 13;
    return {
      investigation_id: `CCI-2026-${String(routeNumber).padStart(3, "0")}`,
      event_id: `CN-CC-${String(routeNumber).padStart(2, "0")}-${String(step + 1).padStart(3, "0")}`,
      event_time: eventTime(step),
      province,
      county,
      route_id: routeId,
      vehicle_code: `COURSE-VEH-${String(routeNumber).padStart(2, "0")}`,
      container_code: `COURSE-BOX-${String(routeNumber).padStart(2, "0")}`,
      logger_code: `COURSE-LOGGER-${String(routeNumber).padStart(2, "0")}`,
      temperature_c: excursionStep ? [8.2, 8.5, 8.8, 9.0, 9.3][step - 9] : 4.08 + (step % 5) * .12,
      calibration_status: "valid",
      route_record_status: "complete",
      handoff_status: missingHandoff ? "missing" : "complete",
      sample_completeness: 1,
      offline_minutes: offline && step === 14 ? 15 : 0,
      usability_decision_allowed: false,
      data_nature: "deterministic-synthetic-cn-operations",
    };
  });
}

const rows = locations.flatMap((_, index) => routeRows(index));

function projection(payload: Record<string, unknown>, state = "待调查", version = 0): CaseProjection {
  return {
    caseId: "B012",
    objectId: `12-${payload.investigation_id}-${payload.event_id}`,
    state,
    version,
    payload,
    updatedAt: "2026-07-26T06:00:00.000Z",
  };
}

const objects = locations.map((_, index) => {
  const sourceRows = routeRows(index);
  const peak = sourceRows.reduce((current, item) => Number(item.temperature_c) > Number(current.temperature_c) ? item : current, sourceRows[0]);
  return projection(peak);
});
const selected = objects[0];

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B012")!,
    objects,
    selected,
    events: [],
    metrics: [],
    datasetRowCount: rows.length,
    sceneRows: rows,
    supportingArtifacts: {},
    actorRole: "quality_reviewer",
    roles: ["quality_reviewer", "supervisor"],
    commands: [{ id: "open_investigation", label: "legacy-open", tone: "primary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

function domainEvent(data: Record<string, unknown>, reason?: string): CaseEvent {
  return {
    eventId: "evt-12",
    caseId: "B012",
    objectId: selected.objectId,
    command: "open_investigation",
    fromState: "待调查",
    toState: "调查中",
    actor: { id: "case12-quality-reviewer", role: "quality_reviewer" },
    version: 1,
    occurredAt: "2026-07-26T06:20:00.000Z",
    reason,
    evidenceIds: [],
    data,
  };
}

describe("ColdChainInvestigationWorkbench", () => {
  it("renders twelve investigation aggregates and a thirty-point evidence timeline without a map", () => {
    render(<ColdChainInvestigationWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "县域冷链运输记录调查" })).toBeVisible();
    const directory = screen.getByRole("complementary", { name: "调查列表" });
    expect(within(directory).getByText("12")).toBeVisible();
    expect(within(directory).getByText("当前显示 12 张调查单")).toBeVisible();
    expect(screen.getByText("07:30—09:55 · 30 条五分钟记录")).toBeVisible();
    expect(screen.getByRole("img", { name: /温度曲线，最高 9.3℃，5 条记录高于 8℃/ })).toBeVisible();
    expect(screen.getByText("2–8℃ 参考带")).toBeVisible();
    expect(screen.getByRole("button", { name: /08:35，CN-CC-01-014，9.3℃/ })).toBeVisible();
    expect(screen.queryByText("县域运输路线")).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("批次");
    expect(document.body).not.toHaveTextContent("放行");
  });

  it("filters anomaly families and selects a different investigation aggregate", () => {
    const onSelect = vi.fn();
    render(<ColdChainInvestigationWorkbench {...props({ onSelect })} />);
    const directory = screen.getByRole("complementary", { name: "调查列表" });

    fireEvent.click(within(directory).getByRole("button", { name: "记录仪离线" }));
    expect(within(directory).getByText("当前显示 2 张调查单")).toBeVisible();
    expect(within(directory).getByRole("button", { name: /新郑市/ })).toBeVisible();
    expect(within(directory).getByRole("button", { name: /正定县/ })).toBeVisible();

    fireEvent.click(within(directory).getByRole("button", { name: /新郑市/ }));
    expect(onSelect).toHaveBeenCalledWith(objects[5].objectId);
  });

  it("shows the selected event's handoff, route, offline, and calibration facts", () => {
    render(<ColdChainInvestigationWorkbench {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: "07:30，CN-CC-01-001，4.1℃" }));

    const detail = screen.getByLabelText("当前记录详情");
    expect(within(detail).getByText("CN-CC-01-001 · 07:30")).toBeVisible();
    expect(within(detail).getByText("4.1℃")).toBeVisible();
    expect(within(detail).getByText("交接").closest("div")).toHaveTextContent("待补");
    expect(within(detail).getByText("路线记录").closest("div")).toHaveTextContent("完整");
    expect(within(detail).getByText("离线").closest("div")).toHaveTextContent("0 分钟");
    expect(within(detail).getByText("校准").closest("div")).toHaveTextContent("有效");
  });

  it("opens a typed investigation over the selected real window", () => {
    const onCommand = vi.fn();
    render(<ColdChainInvestigationWorkbench {...props({ onCommand })} />);

    expect(screen.getByLabelText("调查开始时间")).toHaveValue("08:15");
    expect(screen.getByLabelText("调查结束时间")).toHaveValue("08:35");
    const submit = screen.getByRole("button", { name: "启动运输记录调查" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText("调查说明"), { target: { value: "核对 08:15—08:35 的越界记录与交接缺口" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0][0]).toBe("open_investigation");
    expect(onCommand.mock.calls[0][2]).toEqual(expect.objectContaining({
      idempotencyKey: "case-B012:investigation:CCI-2026-001:route:CN-SC-PZ-01:open_investigation:v0",
      evidenceIds: expect.arrayContaining(["route-event:CN-CC-01-001", "route-event:CN-CC-01-030"]),
      data: expect.objectContaining({
        aggregateType: "cold_chain_investigation",
        investigationId: "CCI-2026-001",
        routeId: "CN-SC-PZ-01",
        routeEventIds: expect.arrayContaining(["CN-CC-01-001", "CN-CC-01-030"]),
        investigationWindow: { start: "08:15", end: "08:35", sourceTimeRange: { start: "07:30", end: "09:55" } },
        observations: expect.objectContaining({ maxTemperatureC: 9.3, excursionEventIds: ["CN-CC-01-010", "CN-CC-01-011", "CN-CC-01-012", "CN-CC-01-013", "CN-CC-01-014"] }),
        evidenceGaps: ["handoff_record"],
      }),
    }));
  });

  it("keeps review blocked until a supervisor verifies route-matched evidence", () => {
    const pending = { ...selected, state: "调查中", version: 1, task: { windowStart: "08:15", windowEnd: "08:35", createdBy: "case12-quality-reviewer" } };
    const onCommand = vi.fn();
    const onActorRoleChange = vi.fn();
    render(<ColdChainInvestigationWorkbench {...props({
      selected: pending,
      objects: [pending, ...objects.slice(1)],
      actorRole: "supervisor",
      commands: [{ id: "quality_cosign", label: "legacy-quality-label", tone: "primary" }],
      onCommand,
      onActorRoleChange,
    })} />);

    expect(screen.getByText("当前不能完成调查复核")).toBeVisible();
    const complete = screen.getByRole("button", { name: "完成调查复核" });
    expect(complete).toBeDisabled();
    fireEvent.change(screen.getByLabelText("补录证据编号"), { target: { value: "HANDOFF-CCI-001" } });
    fireEvent.change(screen.getByLabelText("补录证据摘要"), { target: { value: "接收端交接记录已回传并核对" } });
    fireEvent.change(screen.getByLabelText("补录关联事件"), { target: { value: "CN-CC-01-030" } });
    fireEvent.click(screen.getByLabelText("补录证据已由质量角色核验"));

    expect(screen.getByText("补录证据已核验")).toBeVisible();
    expect(screen.getByText("补录材料可以提交复核")).toBeVisible();
    expect(screen.getByText(/交接记录已补录并核验，提交时仍会复核关联事件/)).toBeVisible();
    expect(complete).toBeEnabled();
    fireEvent.click(complete);
    expect(onCommand.mock.calls[0][0]).toBe("quality_cosign");
    expect(onCommand.mock.calls[0][2]).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        qualityDecision: "cosign",
        supplementalEvidence: expect.objectContaining({ evidenceId: "HANDOFF-CCI-001", recordedAtEventId: "CN-CC-01-030", verificationStatus: "verified" }),
      }),
      evidenceIds: expect.arrayContaining(["supplement:HANDOFF-CCI-001"]),
    }));

    fireEvent.change(screen.getByLabelText("当前操作角色"), { target: { value: "quality_reviewer" } });
    expect(onActorRoleChange).toHaveBeenCalledWith("quality_reviewer");
  });

  it("offers an explicit waiting-for-evidence branch without legacy visible copy", () => {
    const onCommand = vi.fn();
    const waiting = { ...selected, state: "调查中", version: 1 };
    const { rerender } = render(<ColdChainInvestigationWorkbench {...props({
      selected: waiting,
      objects: [waiting, ...objects.slice(1)],
      actorRole: "supervisor",
      commands: [{ id: "hold_batch", label: "legacy-hold-label", tone: "danger" }],
      onCommand,
    })} />);

    expect(screen.getByText(/调查处于等待补证状态/)).toBeVisible();
    const wait = screen.getByRole("button", { name: "等待补证" });
    expect(wait).toBeDisabled();
    fireEvent.change(screen.getByLabelText("调查说明"), { target: { value: "交接记录尚未回传" } });
    expect(wait).toBeEnabled();
    fireEvent.click(wait);
    expect(onCommand.mock.calls[0][0]).toBe("hold_batch");

    const persistedWaiting = { ...waiting, state: "批次暂缓", version: 2 };
    rerender(<ColdChainInvestigationWorkbench {...props({ selected: persistedWaiting, objects: [persistedWaiting, ...objects.slice(1)], actorRole: "supervisor", commands: [], onCommand })} />);
    expect(screen.getByText("等待补证", { selector: "span" })).toBeVisible();
    expect(document.body).not.toHaveTextContent("批次");
    expect(document.body).not.toHaveTextContent("放行");
  });

  it("restores the investigation draft, verified evidence, receipt, and focused recovery", () => {
    const pending = { ...selected, state: "调查中", version: 1, task: { windowStart: "08:10", windowEnd: "08:40" } };
    const historical = domainEvent({ note: "交接记录已回传" }, 'cold-chain-review:{"windowStart":"08:10","windowEnd":"08:40","note":"交接记录已回传"}');
    const receiptEvent = domainEvent({ supplementalEvidence: { evidenceId: "HANDOFF-CCI-001", type: "handoff_record", summary: "接收端记录已核对", recordedAtEventId: "CN-CC-01-030", verificationStatus: "verified" } });
    const receipt: CommandResult = { receiptId: "receipt-12", inputHash: "input", eventHash: "event", projection: pending, event: receiptEvent, duplicate: false };
    const onSelect = vi.fn();
    render(<ColdChainInvestigationWorkbench {...props({
      selected: pending,
      objects: [pending, ...objects.slice(1)],
      events: [historical],
      receipt,
      actorRole: "supervisor",
      commands: [{ id: "quality_cosign", label: "legacy-quality-label" }],
      error: "对象状态已更新，请刷新后重试。",
      onSelect,
    })} />);

    expect(screen.getByLabelText("调查开始时间")).toHaveValue("08:10");
    expect(screen.getByLabelText("调查结束时间")).toHaveValue("08:40");
    expect(screen.getByLabelText("调查说明")).toHaveValue("交接记录已回传");
    expect(screen.getByLabelText("补录证据编号")).toHaveValue("HANDOFF-CCI-001");
    expect(screen.getByLabelText("补录证据已由质量角色核验")).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("调查记录已保存");
    fireEvent.click(screen.getByRole("button", { name: "刷新当前调查" }));
    expect(onSelect).toHaveBeenCalledWith(pending.objectId);
  });

  it("keeps markup deterministic and motion causal with a reduced-motion escape hatch", () => {
    const component = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/ColdChainInvestigationWorkbench.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/ColdChainInvestigationWorkbench.module.css"), "utf8");
    expect(component).not.toContain("Date.now(");
    expect(component).not.toContain("Math.random(");
    expect(component).not.toContain("typeof window");
    expect(component).not.toContain("repeatCount=\"indefinite\"");
    expect(component).not.toContain("mapPattern");
    expect(component).toContain("windowRevision");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toContain("infinite");
  });
});
