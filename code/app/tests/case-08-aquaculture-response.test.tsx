// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { AquacultureResponseWorkbench } from "../src/components/workbenches/case-specific/AquacultureResponseWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function projection(id: string, region: string, evidence: string, risk: string, state = "待分派"): CaseProjection {
  return {
    caseId: "08",
    objectId: `08-${id}-${region}`,
    state,
    version: state === "待分派" ? 0 : 1,
    payload: {
      event_id: id,
      event_time: "2026-06-02T13:00:00+08:00",
      region_id: region,
      archive_member: `Region${Number(region.slice(-2))}/region_2024_merge.tif`,
      temperature_c: "32.12",
      dissolved_oxygen_mg_l: "5.75",
      ph: "7.31",
      turbidity_ntu: "8.82",
      sensor_status: evidence === "source_missing" ? "offline" : "online",
      evidence_status: evidence,
      risk_level: risk,
      source_id: "COURSE-OPS-08",
    },
    updatedAt: "2026-07-25T08:00:00.000Z",
  };
}

const selected = projection("CN-AQ-02-038", "CN-POND-02", "value_conflict", "high");
const second = projection("CN-AQ-01-053", "CN-POND-01", "source_missing", "medium");
const sceneRows = [
  { ...selected.payload, event_time: "2026-05-29T13:00:00+08:00", temperature_c: "27.40", dissolved_oxygen_mg_l: "6.20", ph: "7.44", turbidity_ntu: "7.10", evidence_status: "complete", risk_level: "normal" },
  { ...selected.payload, event_time: "2026-05-31T13:00:00+08:00", temperature_c: "29.80", dissolved_oxygen_mg_l: "5.96", ph: "7.36", turbidity_ntu: "7.90", evidence_status: "complete", risk_level: "normal" },
  selected.payload,
  second.payload,
];

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("08")!,
    objects: [selected, second],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 864,
    sceneRows,
    supportingArtifacts: { "repair-evidence.jsonl": [] },
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

describe("AquacultureResponseWorkbench", () => {
  it("uses a three-stage evidence layout with only real source facts on the first screen", () => {
    const { container } = render(<AquacultureResponseWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "水质冲突现场取证单" })).toBeVisible();
    expect(screen.getByRole("region", { name: "系统记录" })).toBeVisible();
    expect(screen.getByRole("region", { name: "现场回传" })).toBeVisible();
    expect(screen.getByRole("region", { name: "主管采信" })).toBeVisible();
    expect(screen.getByText("32.12℃")).toBeVisible();
    expect(screen.getByText("5.75 mg/L")).toBeVisible();
    expect(screen.getByText("7.31")).toBeVisible();
    expect(screen.getByText("8.82 NTU")).toBeVisible();
    expect(screen.getByText(/上游未提供冲突字段/)).toBeVisible();
    expect(screen.getByText("人工复核规则")).toBeVisible();
    expect(screen.getByText("水温 ≥ 31℃ 进入高风险核查；这是本地复核规则，不是生产告警阈值。")).toBeVisible();
    expect(screen.getByText("确定性水质事件记录")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "系统记录" })).getByText("COURSE-OPS-08")).toBeVisible();
    expect(screen.getByText("等待派发现场取证")).toBeVisible();
    expect(screen.getByText("现场回传后解锁")).toBeVisible();
    expect(screen.getByText(/仅限人工复核/)).toBeVisible();
    expect(container).not.toHaveTextContent("value_conflict");
    expect(container).not.toHaveTextContent("珠海");
    expect(container).not.toHaveTextContent("45 分钟内");
    expect(container).not.toHaveTextContent("region2_2024_merge.tif");
    expect(screen.queryByRole("img", { name: /养殖塘|地图|卫星/ })).not.toBeInTheDocument();
  });

  it("moves the anomaly queue and four 96-hour trends into a detail drawer", () => {
    const onSelect = vi.fn();
    render(<AquacultureResponseWorkbench {...props({ onSelect })} />);

    expect(screen.queryByRole("dialog", { name: "异常队列与 96 小时趋势" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看异常与 96 小时趋势" }));
    const drawer = screen.getByRole("dialog", { name: "异常队列与 96 小时趋势" });
    expect(within(drawer).getByRole("img", { name: "水温 96 小时趋势" })).toBeVisible();
    expect(within(drawer).getByRole("img", { name: "溶解氧 96 小时趋势" })).toBeVisible();
    expect(within(drawer).getByRole("img", { name: "pH 96 小时趋势" })).toBeVisible();
    expect(within(drawer).getByRole("img", { name: "浊度 96 小时趋势" })).toBeVisible();
    fireEvent.click(within(drawer).getByRole("button", { name: /CN-AQ-01-053/ }));
    expect(onSelect).toHaveBeenCalledWith(second.objectId);
    fireEvent.click(within(drawer).getByRole("button", { name: "关闭详情" }));
    expect(screen.queryByRole("dialog", { name: "异常队列与 96 小时趋势" })).not.toBeInTheDocument();
  });

  it("collects a field-operator id without invented team or ETA defaults", () => {
    const onCommand = vi.fn();
    render(<AquacultureResponseWorkbench {...props({ onCommand })} />);

    fireEvent.click(screen.getByRole("button", { name: "派发现场取证" }));
    const dialog = screen.getByRole("dialog", { name: "派发现场取证" });
    expect(within(dialog).getByLabelText("现场人员编号")).toHaveValue("");
    expect(within(dialog).queryByLabelText("预计到达")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("核查说明")).toHaveValue("");
    fireEvent.change(within(dialog).getByLabelText("现场人员编号"), { target: { value: "AQ-FIELD-02" } });
    fireEvent.change(within(dialog).getByLabelText("核查说明"), { target: { value: "使用校准仪表复测四项读数，并登记现场照片资产号" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "确认派发" }));

    const [command, reason, options] = onCommand.mock.calls[0]!;
    expect(command).toBe("dispatch_field_check");
    expect(reason).toBe("使用校准仪表复测四项读数，并登记现场照片资产号");
    expect(options).toMatchObject({
      actorId: "case08-field-dispatcher",
      idempotencyKey: `case-08:${selected.objectId}:dispatch_field_check:v0`,
    });
    expect(options.data.dispatch).toEqual({
      eventId: "CN-AQ-02-038",
      regionId: "CN-POND-02",
      fieldOperatorId: "AQ-FIELD-02",
      note: "使用校准仪表复测四项读数，并登记现场照片资产号",
      evidenceIssue: "value_conflict",
      requiredEvidence: ["temperature_c", "dissolved_oxygen_mg_l", "ph", "turbidity_ntu", "field_photo"],
      createdBy: "case08-field-dispatcher",
    });
  });

  it("keeps role switching, reset, receipt and focused error recovery available", () => {
    const onActorRoleChange = vi.fn();
    const onSelect = vi.fn();
    const { rerender } = render(<AquacultureResponseWorkbench {...props({ onActorRoleChange, onSelect, error: "对象已更新，请刷新后重试。" })} />);

    fireEvent.change(screen.getByLabelText("当前操作角色"), { target: { value: "supervisor" } });
    expect(onActorRoleChange).toHaveBeenCalledWith("supervisor");
    fireEvent.click(screen.getByRole("button", { name: "刷新当前事件" }));
    expect(onSelect).toHaveBeenCalledWith(selected.objectId);

    rerender(<AquacultureResponseWorkbench {...props({ receipt: { ok: true, replayed: false, event: { eventId: "evt-08", caseId: "08", objectId: selected.objectId, command: "dispatch_field_check", fromState: "待分派", toState: "现场取证中", actor: { id: "case08-field-dispatcher", role: "dispatcher" }, version: 1, occurredAt: "2026-07-25T08:00:00.000Z", evidenceIds: [] }, projection: { ...selected, state: "现场取证中", version: 1 } } })} />);
    expect(screen.getByText(/最近操作已保存/)).toBeVisible();
  });

  it("keeps server and client markup deterministic and respects reduced motion", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/AquacultureResponseWorkbench.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/AquacultureResponseWorkbench.module.css"), "utf8");
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("typeof window");
    expect(source).not.toContain("new Date(");
    expect(source).not.toContain("suppressHydrationWarning");
    expect(css).toContain("prefers-reduced-motion");
  });
});
