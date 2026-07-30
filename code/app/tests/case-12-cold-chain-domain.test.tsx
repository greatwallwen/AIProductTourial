// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseEvent, CaseProjection, CommandResult } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { ColdChainInvestigationWorkbench } from "../src/components/workbenches/case-specific/ColdChainInvestigationWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const rows = [4.1, 5.2, 9.3, 8.4, 5.0].map((temperature, index) => ({
  investigation_id: "CCI-2026-001", event_id: `CN-CC-01-00${index + 1}`, route_id: "CN-SC-PZ-01", province: "四川", county: "彭州市",
  event_time: `2026-07-06T08:${String(index * 5).padStart(2, "0")}:00`, temperature_c: temperature,
  calibration_status: "valid", route_record_status: "complete", handoff_status: "missing", offline_minutes: 0,
  vehicle_code: "COURSE-VEH-01", logger_code: "COURSE-LOGGER-01", policy_version: "COLD-CHAIN-INVESTIGATION-2026.1",
}));

const selected: CaseProjection = { caseId: "12", objectId: "12-CCI-2026-001-CN-SC-PZ-01", state: "待调查", version: 0, payload: rows[2], updatedAt: "2026-07-26T07:00:00.000Z" };

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("12")!, objects: [selected], selected, events: [], metrics: [], datasetRowCount: rows.length, sceneRows: rows,
    supportingArtifacts: {}, actorRole: "quality_reviewer", roles: ["quality_reviewer", "supervisor"],
    commands: [{ id: "open_investigation", label: "启动运输记录调查", tone: "primary" }], busy: false,
    onActorRoleChange: vi.fn(), onCommand: vi.fn(), onReset: vi.fn(), onSelect: vi.fn(), ...overrides,
  };
}

function event(data: Record<string, unknown>): CaseEvent {
  return { eventId: "evt-12-domain", caseId: "12", objectId: selected.objectId, command: "open_investigation", actor: { id: "quality_reviewer", role: "quality_reviewer" }, fromState: "待调查", toState: "调查中", version: 1, evidenceIds: [], data, occurredAt: "2026-07-26T07:10:00.000Z" };
}

describe("case 12 investigation and route aggregate", () => {
  it("opens a typed investigation aggregate over real route events with stable idempotency", () => {
    const onCommand = vi.fn();
    render(<ColdChainInvestigationWorkbench {...props({ onCommand })} />);
    fireEvent.change(screen.getByLabelText("调查开始时间"), { target: { value: "08:00" } });
    fireEvent.change(screen.getByLabelText("调查结束时间"), { target: { value: "08:20" } });
    fireEvent.change(screen.getByLabelText("调查说明"), { target: { value: "核对超温事件与交接缺口" } });
    const submit = screen.getByRole("button", { name: "启动运输记录调查" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledTimes(2);
    const options = onCommand.mock.calls[0][2];
    expect(options.idempotencyKey).toBe("case-12:investigation:CCI-2026-001:route:CN-SC-PZ-01:open_investigation:v0");
    expect(onCommand.mock.calls[1][2].idempotencyKey).toBe(options.idempotencyKey);
    expect(options.data).toEqual(expect.objectContaining({
      aggregateType: "cold_chain_investigation", investigationId: "CCI-2026-001", routeId: "CN-SC-PZ-01",
      routeEventIds: rows.map((item) => item.event_id), evidenceGaps: ["handoff_record"], serverValidationRequired: true,
      investigationWindow: { start: "08:00", end: "08:20", sourceTimeRange: { start: "08:00", end: "08:20" } },
      observations: expect.objectContaining({ maxTemperatureC: 9.3, excursionEventIds: ["CN-CC-01-003", "CN-CC-01-004"] }),
    }));
  });

  it("restores task, event, and receipt evidence before supervisor cosign", () => {
    const pending: CaseProjection = { ...selected, state: "调查中", version: 1, task: { windowStart: "08:00", windowEnd: "08:20" } };
    const historical = event({ note: "交接单已回传" });
    const receiptEvent = event({ supplementalEvidence: { evidenceId: "HANDOFF-CCI-001", type: "handoff_record", summary: "收货端补签交接单", recordedAtEventId: "CN-CC-01-005", verificationStatus: "verified" } });
    const receipt: CommandResult = { receiptId: "receipt-12", inputHash: "input", eventHash: "event", projection: pending, event: receiptEvent, duplicate: false };
    const onCommand = vi.fn();
    render(<ColdChainInvestigationWorkbench {...props({ selected: pending, objects: [pending], events: [historical], receipt, actorRole: "supervisor", commands: [{ id: "quality_cosign", label: "完成调查复核", tone: "primary" }], onCommand })} />);

    expect(screen.getByLabelText("调查开始时间")).toHaveValue("08:00");
    expect(screen.getByLabelText("调查说明")).toHaveValue("交接单已回传");
    expect(screen.getByLabelText("补录证据编号")).toHaveValue("HANDOFF-CCI-001");
    expect(screen.getByLabelText("补录证据已由质量角色核验")).toBeChecked();
    const cosign = screen.getByRole("button", { name: "完成调查复核" });
    expect(cosign).toBeEnabled();
    fireEvent.click(cosign);

    expect(onCommand.mock.calls[0][2]).toEqual(expect.objectContaining({
      idempotencyKey: "case-12:investigation:CCI-2026-001:route:CN-SC-PZ-01:quality_cosign:v1",
      evidenceIds: expect.arrayContaining(["supplement:HANDOFF-CCI-001"]),
      data: expect.objectContaining({ qualityDecision: "cosign", supplementalEvidence: expect.objectContaining({ evidenceId: "HANDOFF-CCI-001", recordedAtEventId: "CN-CC-01-005", verificationStatus: "verified" }) }),
    }));
  });

  it("enforces role, evidence, and window gates without a product disposition", () => {
    const pending = { ...selected, state: "调查中", version: 1 };
    const onCommand = vi.fn();
    const { rerender } = render(<ColdChainInvestigationWorkbench {...props({ selected: pending, actorRole: "quality_reviewer", commands: [{ id: "quality_cosign", label: "完成调查复核" }, { id: "hold_batch", label: "等待补证", tone: "danger" }], onCommand })} />);
    expect(screen.getByRole("button", { name: "完成调查复核" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "等待补证" })).toBeDisabled();

    rerender(<ColdChainInvestigationWorkbench {...props({ selected: pending, actorRole: "supervisor", commands: [{ id: "hold_batch", label: "等待补证", tone: "danger" }], onCommand })} />);
    fireEvent.change(screen.getByLabelText("调查说明"), { target: { value: "超温且交接证据未闭环" } });
    fireEvent.click(screen.getByRole("button", { name: "等待补证" }));
    expect(onCommand.mock.calls[0][2].data.freezeScope).toEqual({ scope: "investigation_route", investigationId: "CCI-2026-001", routeId: "CN-SC-PZ-01", batchId: null, batchIdStatus: "not_available_in_dataset" });
    expect(document.body).not.toHaveTextContent("批次");
    expect(document.body).not.toHaveTextContent("放行");
  });

  it("selects real events from the time evidence band and only animates on a causal state", () => {
    render(<ColdChainInvestigationWorkbench {...props()} />);
    fireEvent.click(screen.getByRole("button", { name: /08:15，CN-CC-01-004，8.4℃/ }));
    expect(screen.getAllByText(/CN-CC-01-004/).length).toBeGreaterThan(0);
    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/ColdChainInvestigationWorkbench.tsx"), "utf8");
    expect(source).not.toContain("stepIndexes");
    expect(source).not.toContain("stageLabels");
    expect(source).not.toContain('repeatCount="indefinite"');
    expect(source).toContain("windowRevision");
    const css = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/ColdChainInvestigationWorkbench.module.css"), "utf8");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).not.toContain("infinite");
  });
});
