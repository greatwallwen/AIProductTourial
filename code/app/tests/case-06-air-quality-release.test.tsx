// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CaseEvent, CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getCaseDefinition } from "../../cases/registry";
import { AirQualityReleaseWorkbench } from "../src/components/workbenches/case-specific/AirQualityReleaseWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function projection(station: string, no: string, observedAt: string, missing = 0, state = "待审核"): CaseProjection {
  const hour = Number(observedAt.slice(11, 13));
  return {
    caseId: "06",
    objectId: `06-${station}-${no}`,
    state,
    version: state === "待审核" ? 0 : 1,
    payload: {
      station,
      No: no,
      observed_at: observedAt,
      hour: String(hour),
      "PM2.5": missing ? "" : "16",
      PM10: missing ? "" : "33",
      SO2: missing ? "" : "7",
      NO2: missing ? "" : "39",
      CO: missing ? "" : "700",
      O3: missing ? "" : "26",
      TEMP: "2.0",
      PRES: "1028.4",
      wd: "E",
      WSPM: "1.3",
      RAIN: "0.0",
      missing_pollutant_count: String(missing),
    },
    updatedAt: "2026-07-25T08:00:00.000Z",
  };
}

const selected = projection("Gucheng", "33541", "2016-12-27 12:00:00", 6);
const wanliu = projection("Wanliu", "33541", "2016-12-27 12:00:00");
const changping = projection("Changping", "33537", "2016-12-27 08:00:00");
const previous = projection("Gucheng", "33521", "2016-12-26 16:00:00");
const sceneRows = [selected.payload, wanliu.payload, changping.payload, previous.payload];
const completeMap = { "PM2.5": "present", PM10: "present", SO2: "present", NO2: "present", CO: "present", O3: "present" };
const missingMap = { "PM2.5": "missing", PM10: "missing", SO2: "missing", NO2: "missing", CO: "missing", O3: "missing" };
const wanliuPackage = {
  packageId: "AQ-20161227-Wanliu-33541-v1",
  version: "1.0",
  station: "Wanliu",
  observedAt: "2016-12-27 12:00:00",
  sourceRowId: "33541",
  pollutants: { "PM2.5": "16", PM10: "33", SO2: "7", NO2: "39", CO: "700", O3: "26" },
};

function props(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: getCaseDefinition("06")!,
    objects: [selected, wanliu, changping, previous],
    selected,
    events: [],
    metrics: [],
    datasetRowCount: 21039,
    sceneRows,
    supportingArtifacts: {},
    actorRole: "auditor",
    roles: ["auditor", "supervisor"],
    commands: [{ id: "freeze_release_scope", label: "冻结发布口径", tone: "secondary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("AirQualityReleaseWorkbench v5", () => {
  it("uses a six-gate excerpt check and distinguishes a real null from an unsampled station-hour", () => {
    render(<AirQualityReleaseWorkbench {...props()} />);

    expect(screen.getByRole("heading", { name: "历史空气质量数据摘录质检" })).toBeVisible();
    const gates = screen.getByRole("region", { name: "六指标质量闸门" });
    expect(within(gates).getAllByText("缺测")).toHaveLength(6);
    expect(within(gates).getByText("0 / 6 项可用")).toBeVisible();
    expect(screen.getByText("其他站点未进入当前切片，不等于缺测")).toBeVisible();
    expect(screen.queryByRole("button", { name: "锁定数据摘录" })).not.toBeInTheDocument();
    expect(screen.queryByText(/邻站|全市快照|北京市官方/)).not.toBeInTheDocument();
  });

  it("allows an incomplete record only to be excluded from this extract and retains the exact reason", () => {
    const onCommand = vi.fn();
    render(<AirQualityReleaseWorkbench {...props({
      actorRole: "supervisor",
      commands: [{ id: "reject_release", label: "拒绝发布", tone: "danger" }],
      onCommand,
    })} />);

    const submit = screen.getByRole("button", { name: "确认本批次不纳入" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("本批次不纳入原因"), {
      target: { value: "六项污染物均为空，保留原始空值，本批次不纳入。" },
    });
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledWith(
      "reject_release",
      "六项污染物均为空，保留原始空值，本批次不纳入。",
      {
        actorId: "case06-release-supervisor",
        idempotencyKey: `air-release:${selected.objectId}:${selected.version}:reject`,
        evidenceIds: ["station-hour:Gucheng:2016-12-27 12:00:00"],
        data: {
          returnReason: "六项污染物均为空，保留原始空值，本批次不纳入。",
          missingPollutants: ["PM2.5", "PM10", "SO2", "NO2", "CO", "O3"],
          approverId: "case06-release-supervisor",
        },
      },
    );
    expect(screen.queryByText(/补采|插补/)).not.toBeInTheDocument();
  });

  it("locks an exact six-pollutant extract for a complete record", () => {
    const onCommand = vi.fn();
    render(<AirQualityReleaseWorkbench {...props({ selected: wanliu, onCommand })} />);

    const gates = screen.getByRole("region", { name: "六指标质量闸门" });
    expect(within(gates).getAllByText("有值")).toHaveLength(6);
    expect(within(gates).getByText("6 / 6 项可用")).toBeVisible();
    const submit = screen.getByRole("button", { name: "锁定数据摘录" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("摘录检查说明"), {
      target: { value: "六项污染物、站点、时次和源行已经核对。" },
    });
    fireEvent.click(submit);

    expect(onCommand).toHaveBeenCalledWith(
      "freeze_release_scope",
      "六项污染物、站点、时次和源行已经核对。",
      {
        actorId: "case06-air-auditor",
        idempotencyKey: `air-release:${wanliu.objectId}:${wanliu.version}:freeze`,
        evidenceIds: ["station-hour:Wanliu:2016-12-27 12:00:00", "source-row:33541"],
        data: {
          releasePackage: wanliuPackage,
          completeness: completeMap,
          reviewNote: "六项污染物、站点、时次和源行已经核对。",
          reviewerId: "case06-air-auditor",
        },
      },
    );
  });

  it("restores the locked extract and requires a different reviewer to confirm it", () => {
    const pending: CaseProjection = {
      ...wanliu,
      state: "待复核",
      version: 1,
      task: {
        releasePackage: wanliuPackage,
        completeness: completeMap,
        reviewNote: "字段已核对。",
        reviewerId: "case06-air-auditor",
      },
    };
    const onCommand = vi.fn();
    render(<AirQualityReleaseWorkbench {...props({
      selected: pending,
      objects: [selected, pending, changping, previous],
      actorRole: "supervisor",
      commands: [{ id: "publish", label: "确认对外发布", tone: "primary" }],
      onCommand,
    })} />);

    expect(screen.getAllByText("摘录已锁定").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("AQ-20161227-Wanliu-33541-v1")).toBeVisible();
    const submit = screen.getByRole("button", { name: "确认本批次摘录" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("复核意见"), {
      target: { value: "已复核锁定记录与六项污染物原值。" },
    });
    fireEvent.click(submit);
    expect(onCommand).toHaveBeenCalledWith(
      "publish",
      "已复核锁定记录与六项污染物原值。",
      {
        actorId: "case06-release-supervisor",
        idempotencyKey: `air-release:${pending.objectId}:${pending.version}:publish`,
        evidenceIds: ["release-package:AQ-20161227-Wanliu-33541-v1"],
        data: {
          releasePackage: wanliuPackage,
          approvalNote: "已复核锁定记录与六项污染物原值。",
          approverId: "case06-release-supervisor",
        },
      },
    );
  });

  it("blocks confirmation when a restored extract belongs to another station-hour", () => {
    const mismatched: CaseProjection = {
      ...selected,
      state: "待复核",
      version: 1,
      task: {
        releasePackage: wanliuPackage,
        completeness: missingMap,
        reviewNote: "等待处理。",
        reviewerId: "case06-air-auditor",
      },
    };
    render(<AirQualityReleaseWorkbench {...props({
      selected: mismatched,
      actorRole: "supervisor",
      commands: [{ id: "publish", label: "确认对外发布", tone: "primary" }],
    })} />);

    expect(screen.getByRole("alert", { name: "摘录绑定异常" })).toHaveTextContent(/古城.*万柳|当前记录.*锁定摘录/);
    expect(screen.queryByRole("button", { name: "确认本批次摘录" })).not.toBeInTheDocument();
  });

  it("recovers persisted task data from events and exposes a focused conflict refresh", () => {
    const pending = { ...wanliu, state: "待复核", version: 1 };
    const event = {
      eventId: "evt-06", caseId: "06", objectId: pending.objectId,
      command: "freeze_release_scope", fromState: "待质检", toState: "待复核",
      actor: { id: "auditor-01", role: "auditor" }, version: 1,
      occurredAt: "2026-07-25T08:00:00.000Z", evidenceIds: [],
      data: { releasePackage: wanliuPackage, completeness: completeMap, reviewNote: "字段已核对。", reviewerId: "auditor-01" },
    } satisfies CaseEvent;
    const onSelect = vi.fn();
    render(<AirQualityReleaseWorkbench {...props({
      selected: pending,
      events: [event],
      actorRole: "supervisor",
      commands: [{ id: "publish", label: "确认对外发布", tone: "primary" }],
      error: "对象已更新，请刷新后继续。",
      onSelect,
    })} />);

    expect(screen.getByText("AQ-20161227-Wanliu-33541-v1")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "刷新当前记录" }));
    expect(onSelect).toHaveBeenCalledWith(pending.objectId);
  });

  it("does not restore another station's task events into the selected record", () => {
    const foreignEvent = {
      eventId: "evt-06-foreign", caseId: "06", objectId: wanliu.objectId,
      command: "freeze_release_scope", fromState: "待质检", toState: "待复核",
      actor: { id: "auditor-foreign", role: "auditor" }, version: 1,
      occurredAt: "2026-07-25T08:00:00.000Z", evidenceIds: [],
      data: { releasePackage: wanliuPackage, completeness: completeMap, reviewNote: "万柳记录已核对。", reviewerId: "auditor-foreign" },
    } satisfies CaseEvent;

    render(<AirQualityReleaseWorkbench {...props({
      selected: { ...selected, state: "待质检" },
      events: [foreignEvent],
      actorRole: "supervisor",
      commands: [{ id: "reject_release", label: "确认本批次不纳入", tone: "danger" }],
    })} />);

    expect(screen.queryByText("AQ-20161227-Wanliu-33541-v1")).not.toBeInTheDocument();
    expect(screen.getByText("AQ-20161227-Gucheng-33541-v1")).toBeVisible();
    expect(screen.getByRole("button", { name: "确认本批次不纳入" })).toBeDisabled();
  });

  it("renders the new terminal states without falling back to legacy labels", () => {
    const included: CaseProjection = {
      ...wanliu,
      state: "已纳入摘录",
      version: 2,
      task: { releasePackage: wanliuPackage, completeness: completeMap, reviewNote: "字段已核对。", reviewerId: "case06-air-auditor" },
    };
    const { rerender } = render(<AirQualityReleaseWorkbench {...props({ selected: included, objects: [included] })} />);
    expect(screen.getAllByText("摘录已确认").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "本批次摘录已确认" })).toBeDisabled();

    const excluded = { ...selected, state: "本批次不纳入", version: 1 };
    rerender(<AirQualityReleaseWorkbench {...props({ selected: excluded, objects: [excluded] })} />);
    expect(screen.getAllByText("本批次不纳入").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "已记录本批次不纳入" })).toBeDisabled();
  });

  it("uses the queue to change records without exposing a decorative map or an all-day wall", () => {
    const onSelect = vi.fn();
    render(<AirQualityReleaseWorkbench {...props({ onSelect })} />);

    fireEvent.click(screen.getByRole("button", { name: "万柳站 2016-12-27 12:00 六项有值" }));
    expect(onSelect).toHaveBeenCalledWith(wanliu.objectId);
    expect(screen.queryByRole("region", { name: /地图|24 小时|全市/ })).not.toBeInTheDocument();
  });

  it("keeps the current record in the same-hour comparison even when the sampled scene rows omit it", () => {
    render(<AirQualityReleaseWorkbench {...props({
      selected: wanliu,
      objects: [wanliu],
      sceneRows: [selected.payload],
    })} />);

    expect(screen.getByRole("heading", { name: "当前切片同一时点保留 2 条记录" })).toBeVisible();
    expect(screen.getByRole("row", { name: /万柳 16 33 7 39 0\.7 26 六项有值/ })).toBeVisible();
  });

  it("keeps hydration and motion deterministic", () => {
    const source = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/AirQualityReleaseWorkbench.tsx"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "src/components/workbenches/case-specific/AirQualityReleaseWorkbench.module.css"), "utf8");
    expect(source).not.toContain("Date.now(");
    expect(source).not.toContain("Math.random(");
    expect(source).not.toContain("typeof window");
    expect(source).not.toContain("new Date(");
    expect(source).not.toContain("stationPositions");
    expect(css).toMatch(/@media\(prefers-reduced-motion:reduce\)/);
    expect(css).not.toMatch(/animation:[^;]*(infinite)/);
  });
});
