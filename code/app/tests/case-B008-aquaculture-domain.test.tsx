// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { AquacultureResponseWorkbench } from "../src/components/workbenches/case-specific/AquacultureResponseWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function projection(state = "待分派", task?: Record<string, unknown>): CaseProjection {
  return {
    caseId: "B008",
    objectId: "B008-CN-AQ-02-038-CN-POND-02",
    state,
    version: state === "待分派" ? 0 : state === "现场取证中" ? 1 : 2,
    payload: {
      event_id: "CN-AQ-02-038",
      event_time: "2026-06-02T13:00:00+08:00",
      region_id: "CN-POND-02",
      archive_member: "Region2/region2_2024_merge.tif",
      temperature_c: "32.12",
      dissolved_oxygen_mg_l: "5.75",
      ph: "7.31",
      turbidity_ntu: "8.82",
      sensor_status: "online",
      evidence_status: "value_conflict",
      risk_level: "high",
      source_id: "COURSE-OPS-08",
    },
    task,
    updatedAt: "2026-07-26T08:00:00.000Z",
  };
}

const selected = projection();
const dispatch = {
  eventId: "CN-AQ-02-038",
  regionId: "CN-POND-02",
  fieldOperatorId: "AQ-FIELD-02",
  note: "复测四项读数并拍照",
  evidenceIssue: "value_conflict",
  createdBy: "case08-field-dispatcher",
};
const fieldReturn = {
  eventId: "CN-AQ-02-038",
  operatorId: "AQ-FIELD-02",
  capturedAt: "2026-06-02T14:05",
  photoAssetId: "PHOTO-CN-AQ-02-038",
  temperatureC: 31.2,
  dissolvedOxygenMgL: 5.9,
  ph: 7.28,
  turbidityNtu: 8.4,
};

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("B008")!,
    objects: [selected],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 864,
    sceneRows: [selected.payload],
    supportingArtifacts: {
      "repair-evidence.jsonl": [{ repair_id: "REPAIR-CN-AQ-02-038-V1", event_id: "CN-AQ-02-038", status: "verified_repaired", evidence_hash: "03B5E618" }],
    },
    actorRole: "dispatcher",
    roles: ["dispatcher", "field_operator", "supervisor"],
    commands: [{ id: "dispatch_field_check", label: "派发现场核查", tone: "secondary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

function completeFieldReturn(region: HTMLElement) {
  expect(within(region).getByLabelText("现场回传人员")).toHaveValue("AQ-FIELD-02");
  fireEvent.change(within(region).getByLabelText("采集时间"), { target: { value: "2026-06-02T14:05" } });
  fireEvent.change(within(region).getByLabelText("现场照片资产号"), { target: { value: "PHOTO-CN-AQ-02-038" } });
  fireEvent.change(within(region).getByLabelText("现场水温"), { target: { value: "31.2" } });
  fireEvent.change(within(region).getByLabelText("现场溶解氧"), { target: { value: "5.9" } });
  fireEvent.change(within(region).getByLabelText("现场 pH"), { target: { value: "7.28" } });
  fireEvent.change(within(region).getByLabelText("现场浊度"), { target: { value: "8.4" } });
}

describe("AquacultureResponseWorkbench domain loop", () => {
  it("persists a field return as a separate field-operator command", () => {
    const current = projection("现场取证中", { dispatch });
    const onCommand = vi.fn();
    render(<AquacultureResponseWorkbench {...props({
      selected: current,
      objects: [current],
      actorRole: "field_operator",
      commands: [{ id: "submit_field_return", label: "提交现场回传", tone: "primary" }],
      onCommand,
    })} />);

    const region = screen.getByRole("region", { name: "现场回传" });
    completeFieldReturn(region);
    fireEvent.click(within(region).getByRole("button", { name: "提交现场回传" }));

    const [command, reason, options] = onCommand.mock.calls[0]!;
    expect(command).toBe("submit_field_return");
    expect(reason).toBe("现场四项读数与照片已登记");
    expect(options).toMatchObject({
      actorId: "AQ-FIELD-02",
      data: { fieldReturn },
      idempotencyKey: `case-B008:${current.objectId}:submit_field_return:v1:AQ-FIELD-02`,
    });
    expect(options.evidenceIds).toEqual(["CN-AQ-02-038", "PHOTO-CN-AQ-02-038"]);
  });

  it("rejects an impossible field reading before it reaches the domain command", () => {
    const current = projection("现场取证中", { dispatch });
    const onCommand = vi.fn();
    render(<AquacultureResponseWorkbench {...props({ selected: current, objects: [current], actorRole: "field_operator", commands: [{ id: "submit_field_return", label: "提交现场回传" }], onCommand })} />);
    const region = screen.getByRole("region", { name: "现场回传" });
    completeFieldReturn(region);
    fireEvent.change(within(region).getByLabelText("现场 pH"), { target: { value: "15.2" } });
    expect(within(region).getByRole("button", { name: "提交现场回传" })).toBeDisabled();
    expect(within(region).getByText("pH 应在 0–14 之间")).toBeVisible();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("unlocks supervisor adoption only from a persisted field return", () => {
    const current = projection("待主管复核", { dispatch, fieldReturn });
    const onCommand = vi.fn();
    render(<AquacultureResponseWorkbench {...props({
      selected: current,
      objects: [current],
      actorRole: "supervisor",
      commands: [{ id: "confirm_event", label: "确认采信", tone: "primary" }],
      onCommand,
    })} />);

    const returned = screen.getByRole("region", { name: "现场回传" });
    expect(within(returned).getByText("PHOTO-CN-AQ-02-038")).toBeVisible();
    expect(within(returned).queryByLabelText("现场回传人员")).not.toBeInTheDocument();
    const supervisor = screen.getByRole("region", { name: "主管采信" });
    fireEvent.change(within(supervisor).getByLabelText("采信说明"), { target: { value: "现场复测记录完整，采信现场读数作为本次核查结论" } });
    fireEvent.click(within(supervisor).getByLabelText("确认现场证据已经人工复核"));
    fireEvent.click(within(supervisor).getByRole("button", { name: "确认采信" }));

    const [command, reason, options] = onCommand.mock.calls[0]!;
    expect(command).toBe("confirm_event");
    expect(reason).toBe("现场复测记录完整，采信现场读数作为本次核查结论");
    expect(options.actorId).toBe("case08-aquaculture-supervisor");
    expect(options.data).toEqual({
      eventId: "CN-AQ-02-038",
      validation: {
        issueResolved: true,
        originalEvidenceStatus: "value_conflict",
        note: "现场复测记录完整，采信现场读数作为本次核查结论",
        repairEvidenceId: "REPAIR-CN-AQ-02-038-V1",
        confirmedBy: "case08-aquaculture-supervisor",
      },
    });
    expect(options.data).not.toHaveProperty("fieldReturn");
    expect(options.evidenceIds).toEqual(expect.arrayContaining(["CN-AQ-02-038", "PHOTO-CN-AQ-02-038", "REPAIR-CN-AQ-02-038-V1"]));
  });

  it("requires named missing evidence and a reason before holding the event", () => {
    const current = projection("现场取证中", { dispatch });
    const onCommand = vi.fn();
    render(<AquacultureResponseWorkbench {...props({ selected: current, objects: [current], actorRole: "supervisor", commands: [{ id: "hold_for_evidence", label: "请求补充现场读数", tone: "danger" }], onCommand })} />);
    fireEvent.click(screen.getByRole("button", { name: "暂缓并补充证据" }));
    const dialog = screen.getByRole("dialog", { name: "暂缓并补充证据" });
    const submit = within(dialog).getByRole("button", { name: "确认暂缓" });
    expect(submit).toBeDisabled();
    fireEvent.click(within(dialog).getByLabelText("现场照片"));
    fireEvent.change(within(dialog).getByLabelText("暂缓原因"), { target: { value: "照片无法辨认测点编号，需要现场重新拍摄并回传" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(onCommand.mock.calls[0]![2].data.hold).toEqual({
      eventId: "CN-AQ-02-038",
      missingEvidence: ["field_photo"],
      reason: "照片无法辨认测点编号，需要现场重新拍摄并回传",
      heldBy: "case08-aquaculture-supervisor",
    });
  });
});
