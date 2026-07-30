// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { HospitalTransferWorkbench } from "../src/components/workbenches/case-specific/HospitalTransferWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const sceneRows = [
  { event_id: "TRN-0001-01", transport_id: "TRN-0001", flow_token: "FLOW-0001", event_version: "1", event_time: "2026-07-03T08:07:00+08:00", received_at: "2026-07-03T08:08:00+08:00", source_system: "ED_BOARD", from_department: "急诊观察区", to_department: "外科留观区", bed_request_id: "BED-008", role: "emergency_nurse", actor_id: "ER-N-01", event_type: "transport_requested", co_sign_status: "pending", conflict_type: "none", late_event: "False" },
  { event_id: "TRN-0001-02", transport_id: "TRN-0001", flow_token: "FLOW-0001", event_version: "2", event_time: "2026-07-03T08:11:00+08:00", received_at: "2026-07-03T08:30:00+08:00", source_system: "TRANSPORT_DISPATCH", from_department: "急诊观察区", to_department: "外科留观区", bed_request_id: "BED-008", role: "transport_coordinator", actor_id: "TR-C-01", event_type: "transport_assigned", co_sign_status: "pending", conflict_type: "out_of_order", late_event: "False" },
  { event_id: "TRN-0001-03", transport_id: "TRN-0001", flow_token: "FLOW-0001", event_version: "3", event_time: "2026-07-03T08:15:00+08:00", received_at: "2026-07-03T08:17:00+08:00", source_system: "BED_CONTROL", from_department: "急诊观察区", to_department: "外科留观区", bed_request_id: "BED-008", role: "bed_coordinator", actor_id: "BED-C-01", event_type: "bed_request_confirmed", co_sign_status: "pending", conflict_type: "none", late_event: "False" },
  { event_id: "TRN-0001-04", transport_id: "TRN-0001", flow_token: "FLOW-0001", event_version: "4", event_time: "2026-07-03T08:19:00+08:00", received_at: "2026-07-03T08:21:00+08:00", source_system: "WARD_BOARD", from_department: "急诊观察区", to_department: "外科留观区", bed_request_id: "BED-008", role: "bed_coordinator", actor_id: "BED-C-01", event_type: "handoff_received", co_sign_status: "pending", conflict_type: "none", late_event: "False" },
  { event_id: "TRN-0001-05", transport_id: "TRN-0001", flow_token: "FLOW-0001", event_version: "5", event_time: "2026-07-03T08:23:00+08:00", received_at: "2026-07-03T08:25:00+08:00", source_system: "OPS_AUDIT", from_department: "急诊观察区", to_department: "外科留观区", bed_request_id: "BED-008", role: "coordination_lead", actor_id: "COORD-01", event_type: "coordination_snapshot", co_sign_status: "pending", conflict_type: "none", late_event: "False" },
  { event_id: "TRN-0001-06", transport_id: "TRN-0001", flow_token: "FLOW-0001", event_version: "6", event_time: "2026-07-03T08:27:00+08:00", received_at: "2026-07-03T09:09:00+08:00", source_system: "OPS_AUDIT", from_department: "急诊观察区", to_department: "外科留观区", bed_request_id: "BED-008", role: "coordination_lead", actor_id: "COORD-01", event_type: "correction_appended", co_sign_status: "pending", conflict_type: "late_event", late_event: "True" },
];

function projection(state = "待会签", task?: Record<string, unknown>): CaseProjection {
  return {
    caseId: "05",
    objectId: "05-TRN-0001-TRN-0001-06",
    state,
    version: state === "待会签" ? 0 : 1,
    payload: sceneRows[5],
    task,
    updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  const selected = projection();
  return {
    definition: getCaseDefinition("05")!,
    objects: [selected],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 4320,
    sceneRows,
    supportingArtifacts: {},
    actorRole: "coordinator",
    roles: ["coordinator", "supervisor"],
    commands: [{ id: "nurse_confirm", label: "确认转运事件", tone: "secondary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("HospitalTransferWorkbench v5", () => {
  it("sorts the business and receive clocks independently and selects the late conflict", () => {
    render(<HospitalTransferWorkbench {...props({ sceneRows: [...sceneRows].reverse() })} />);
    const occurred = screen.getByRole("region", { name: "业务发生时间轴" });
    const received = screen.getByRole("region", { name: "系统接收时间轴" });

    expect(within(occurred).getAllByRole("button").map((node) => node.dataset.eventId)).toEqual([
      "TRN-0001-01", "TRN-0001-02", "TRN-0001-03", "TRN-0001-04", "TRN-0001-05", "TRN-0001-06",
    ]);
    expect(within(received).getAllByRole("button").map((node) => node.dataset.eventId)).toEqual([
      "TRN-0001-01", "TRN-0001-03", "TRN-0001-04", "TRN-0001-05", "TRN-0001-02", "TRN-0001-06",
    ]);
    expect(screen.getByRole("complementary", { name: "当前冲突调和" })).toHaveTextContent("TRN-0001-06");
    expect(screen.getAllByText("晚到 42 分钟").length).toBeGreaterThanOrEqual(1);
  });

  it.each([
    ["late_event", "晚到事件", true],
    ["late_reopen", "晚到重开", true],
    ["out_of_order", "乱序到达", false],
    ["duplicate", "重复事件", false],
    ["missing", "会签缺失", false],
    ["mutually_exclusive", "互斥状态", false],
  ])("labels %s without calling non-late conflicts late", (conflictType, label, showsMinutes) => {
    const selected = projection();
    selected.payload = { ...selected.payload, conflict_type: conflictType, late_event: String(showsMinutes) };
    render(<HospitalTransferWorkbench {...props({ selected, objects: [selected], sceneRows: [selected.payload] })} />);
    const detail = screen.getByRole("complementary", { name: "当前冲突调和" });
    expect(within(detail).getByText(label)).toBeVisible();
    const minuteLabel = within(detail).queryByText(/晚到 \d+ 分钟/);
    if (showsMinutes) expect(minuteLabel).toBeVisible();
    else expect(minuteLabel).not.toBeInTheDocument();
  });

  it("starts without an authoritative choice and submits structured reconciliation evidence", () => {
    const onCommand = vi.fn();
    render(<HospitalTransferWorkbench {...props({ onCommand })} />);
    const submit = screen.getByRole("button", { name: "确认转运事件" });

    expect(screen.getByLabelText("处理策略")).toHaveValue("");
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("处理策略"), { target: { value: "接收方已接收，保留迟到修正" } });
    fireEvent.change(screen.getByLabelText("调和理由"), { target: { value: "接收记录已存在，保留历史并追加晚到更正" } });
    fireEvent.change(screen.getByLabelText("转出方签署人"), { target: { value: "ER-N-07" } });
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledWith(
      "nurse_confirm",
      "接收记录已存在，保留历史并追加晚到更正",
      expect.objectContaining({
        actorId: "ER-N-07",
        data: expect.objectContaining({
          selectedEventId: "TRN-0001-06",
          authoritativeState: "接收方已接收，保留迟到修正",
          senderActorId: "ER-N-07",
        }),
        evidenceIds: ["TRN-0001-06", "BED-008", "FLOW-0001"],
      }),
    );
  });

  it("restores the first signature and requires a different receiver for cosign", () => {
    const persisted: CaseEvent = {
      eventId: "evt-05-1", caseId: "05", objectId: projection().objectId, command: "nurse_confirm",
      actor: { id: "ER-N-07", role: "coordinator" }, fromState: "待会签", toState: "待接收会签", version: 1,
      reason: "保留迟到修正", evidenceIds: ["TRN-0001-06"],
      data: { selectedEventId: "TRN-0001-06", authoritativeState: "接收方已接收，保留迟到修正", reconciliationReason: "接收记录已存在，迟到事件仅追加更正", senderActorId: "ER-N-07" },
      occurredAt: "2026-07-26T08:10:00.000Z",
    };
    const onCommand = vi.fn();
    render(<HospitalTransferWorkbench {...props({ selected: projection("待接收会签"), objects: [projection("待接收会签")], events: [persisted], actorRole: "supervisor", commands: [{ id: "cosign_transfer", label: "完成接收会签", tone: "secondary" }], onCommand })} />);

    expect(screen.getByLabelText("处理策略")).toHaveValue("接收方已接收，保留迟到修正");
    expect(screen.getByLabelText("转出方签署人")).toHaveValue("ER-N-07");
    fireEvent.change(screen.getByLabelText("接收方签署人"), { target: { value: "ER-N-07" } });
    fireEvent.change(screen.getByLabelText("接收会签说明"), { target: { value: "已核对接收事件" } });
    expect(screen.getByRole("button", { name: "完成接收会签" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("接收方签署人"), { target: { value: "WARD-N-03" } });
    fireEvent.click(screen.getByRole("button", { name: "完成接收会签" }));
    expect(onCommand).toHaveBeenCalledWith("cosign_transfer", "已核对接收事件", expect.objectContaining({ actorId: "WARD-N-03" }));
  });

  it("persists the handled late-event set and submits the old set plus the current event", () => {
    const onCommand = vi.fn();
    render(<HospitalTransferWorkbench {...props({
      selected: projection("待会签", { handledLateEventIds: ["TRN-0000-06"] }),
      objects: [projection("待会签", { handledLateEventIds: ["TRN-0000-06"] })],
      commands: [{ id: "reopen_late_event", label: "重新打开会签", tone: "secondary" }],
      onCommand,
    })} />);

    fireEvent.change(screen.getByLabelText("转出方签署人"), { target: { value: "COORD-07" } });
    fireEvent.click(screen.getByRole("button", { name: "重新打开会签" }));

    expect(onCommand).toHaveBeenCalledWith(
      "reopen_late_event",
      "晚到事件首次到达，重新打开状态会签。",
      expect.objectContaining({
        actorId: "COORD-07",
        data: expect.objectContaining({
          lateEventId: "TRN-0001-06",
          lateEventOccurredAt: "2026-07-03T08:27:00+08:00",
          lateEventReceivedAt: "2026-07-03T09:09:00+08:00",
          handledLateEventIds: ["TRN-0000-06", "TRN-0001-06"],
        }),
      }),
    );
  });

  it("does not reopen a late event already restored from persisted task state", () => {
    const handledTask = { handledLateEventIds: ["TRN-0001-06"], senderActorId: "COORD-07" };
    const selected = projection("待会签", handledTask);
    render(<HospitalTransferWorkbench {...props({
      selected,
      objects: [selected],
      commands: [{ id: "reopen_late_event", label: "重新打开会签", tone: "secondary" }],
    })} />);

    expect(screen.getByRole("button", { name: "重新打开会签" })).toBeDisabled();
    expect(screen.getByText(/已经触发过重开/)).toBeVisible();
  });

  it("offers a focused refresh when runtime submission fails", () => {
    const onSelect = vi.fn();
    render(<HospitalTransferWorkbench {...props({ error: "版本冲突，请刷新后重试", onSelect })} />);
    fireEvent.click(screen.getByRole("button", { name: "刷新当前调和单" }));
    expect(onSelect).toHaveBeenCalledWith("05-TRN-0001-TRN-0001-06");
  });

  it("does not expose fabricated hospital locations and defines reduced-motion", () => {
    render(<HospitalTransferWorkbench {...props()} />);
    expect(screen.queryByText(/F2|专用电梯|药品封签|影像资料|氧气接口|腕带核验|留观床 08/)).not.toBeInTheDocument();
    expect(screen.getByText(/不含患者身份、诊断、治疗或临床优先级/)).toBeVisible();
    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/HospitalTransferWorkbench.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/HospitalTransferWorkbench.module.css"), "utf8");
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("typeof window");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
