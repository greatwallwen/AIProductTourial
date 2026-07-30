// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validateDomainCommand } from "../../cases/domain-command";
import { loadDatasetProjection } from "../../cases/load-dataset";
import { getCaseDefinition } from "../../cases/registry";
import { CaseExperience } from "../src/components/CaseExperience";
import { BoilerEventWorkbench } from "../src/components/workbenches/case-specific/BoilerEventWorkbench";
import { PvLossWorkbench } from "../src/components/workbenches/case-specific/PvLossWorkbench";
import type { CaseWorkbenchProps } from "../src/components/workbenches/case-specific/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const case18 = getCaseDefinition("B018")!;
const case20 = getCaseDefinition("B020")!;
const dataset18 = loadDatasetProjection(case18);
const dataset20 = loadDatasetProjection(case20);

function projectionFromDataset(
  caseId: string,
  row: (typeof dataset18.rows)[number],
  state: string,
  overrides: Partial<CaseProjection> = {},
): CaseProjection {
  const { objectId, decision: _decision, ...payload } = row;
  return {
    caseId,
    objectId,
    state,
    version: 0,
    payload,
    updatedAt: "2026-07-26T08:00:00.000Z",
    ...overrides,
  };
}

const row18 = dataset18.rows.find((row) => row.objectId === case18.featuredObjectId)!;
const selected18 = projectionFromDataset("18", row18, case18.initialState);

const row20 = dataset20.rows.find((row) => row.objectId === case20.featuredObjectId)!;
const selected20 = projectionFromDataset("20", row20, case20.initialState);
const stationFacts20 = dataset20.supportingArtifacts["stations.csv"] ?? [];

const pvDirection = {
  code: "curtailment",
  label: "疑似限电",
  status: "provisional",
  basis: {
    meanEfficiencyRatio: String(selected20.payload.mean_efficiency_ratio),
    curtailmentSuspectedShare: String(selected20.payload.curtailment_suspected_share),
    temperatureDeratingShare: String(selected20.payload.mean_temperature_derating_pct),
  },
} as const;

const pvTask = {
  taskId: "PV-8-20200519-v1",
  stationId: "8",
  date: "2020-05-19",
  direction: pvDirection,
  evidenceSources: [
    {
      sourceId: "station-day-aggregate",
      label: "公开站日汇总",
      status: "loaded",
      evidenceId: "station-day:8:2020-05-19",
    },
    {
      sourceId: "dispatch-curtailment-log",
      label: "调度限电记录",
      status: "load_failed",
      failureCode: "source_not_in_dataset",
    },
    {
      sourceId: "inverter-alert-log",
      label: "逆变器告警",
      status: "load_failed",
      failureCode: "source_not_in_dataset",
    },
    {
      sourceId: "maintenance-work-order",
      label: "站端检修工单",
      status: "load_failed",
      failureCode: "source_not_in_dataset",
    },
  ],
  retrievalRequest: {
    requestedSourceIds: [
      "dispatch-curtailment-log",
      "inverter-alert-log",
      "maintenance-work-order",
    ],
    owner: "华北站端运维组",
    dueAt: "2026-07-29T18:00",
    requesterId: "performance-engineer-01",
    note: "补取调度、逆变器告警和检修记录后再判断少发方向。",
  },
};

function pvProps(overrides: Partial<CaseWorkbenchProps> = {}): CaseWorkbenchProps {
  return {
    definition: case20,
    objects: [selected20],
    selected: selected20,
    events: [],
    metrics: [],
    datasetRowCount: dataset20.rowCount,
    sceneRows: dataset20.sceneRows,
    supportingArtifacts: dataset20.supportingArtifacts,
    actorRole: "performance_engineer",
    roles: ["performance_engineer", "supervisor"],
    commands: [{ id: "submit_station_check", label: "提交站端核查", tone: "primary" }],
    busy: false,
    onActorRoleChange: vi.fn(),
    onCommand: vi.fn(),
    onReset: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe("batch 4 product contracts C", () => {
  it("case 18 separates attached evidence from requested sources and rejects forged evidence IDs", () => {
    const onCommand = vi.fn();
    render(
      <BoilerEventWorkbench
        definition={case18}
        objects={[selected18]}
        selected={selected18}
        events={[]}
        sceneRows={dataset18.sceneRows}
        supportingArtifacts={dataset18.supportingArtifacts}
        metrics={dataset18.metrics}
        datasetRowCount={dataset18.rowCount}
        actorRole="process_engineer"
        roles={["process_engineer", "supervisor"]}
        commands={[{ id: "dispatch_shift_check", label: "提交当班排查", tone: "primary" }]}
        busy={false}
        onActorRoleChange={vi.fn()}
        onCommand={onCommand}
        onReset={vi.fn()}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /末级过热器出口段/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /减温水流量/ }));
    fireEvent.change(screen.getByLabelText("检查负责人"), { target: { value: "运行一班 张工" } });
    fireEvent.change(screen.getByLabelText("当班排查说明"), {
      target: { value: "出口温度连续下偏，先核对末级过热器前后段温差。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "提交当班排查" }));

    expect(onCommand).toHaveBeenCalledTimes(1);
    const commandOptions = onCommand.mock.calls[0]![2] as {
      data: Record<string, unknown>;
      evidenceIds: string[];
    };
    expect.soft(commandOptions.evidenceIds).not.toContain("desuperheater-flow");

    let validationError: unknown;
    try {
      validateDomainCommand({
        caseId: "B018",
        command: "dispatch_shift_check",
        actorRole: "process_engineer",
        actorId: "case18-boiler-engineer",
        idempotencyKey: "case18-bt0044-forged-evidence",
        evidenceIds: [...commandOptions.evidenceIds, "desuperheater-flow"],
        data: {
          ...commandOptions.data,
          evidenceItems: ["minute-temperature", "sample-integrity", "desuperheater-flow"],
        },
        current: selected18,
        sceneRows: dataset18.sceneRows,
      });
    } catch (error) {
      validationError = error;
    }
    expect.soft(validationError).toBeInstanceOf(Error);
    expect.soft((validationError as Error | undefined)?.message).toBe("boiler_evidence_mismatch");
  });

  it("case 18 exposes real event and imputation artifacts with the flow-imputation boundary", () => {
    render(
      <CaseExperience
        definition={case18}
        activeView="work"
        initialObjects={[selected18]}
        initialEvents={[]}
        initialReceipt={undefined}
        datasetRowCount={dataset18.rowCount}
        datasetHash={dataset18.sha256}
        metrics={dataset18.metrics}
        sceneRows={dataset18.sceneRows}
        supportingArtifacts={dataset18.supportingArtifacts}
      />,
    );

    expect(dataset18.supportingArtifacts["events.csv"]).toHaveLength(93);
    expect(dataset18.supportingArtifacts["imputation-points.csv"]).toHaveLength(30);
    expect(dataset18.supportingArtifacts["imputation-points.csv"]?.[0]).toHaveProperty("primary_desuperheater_water_flow_imputed");
    expect(screen.getByRole("region", { name: "事件时间线" })).toHaveTextContent("25 个连续分钟点");
    expect(screen.getByText(/530–545.*来源区间/)).toBeVisible();
    expect(screen.queryByText(/30 条补点记录/)).not.toBeInTheDocument();
  });

  it("case 20 locks the persisted review direction across aria state, summary, and command payload", () => {
    const reviewed: CaseProjection = {
      ...selected20,
      state: "站端核查中",
      version: 1,
      task: pvTask,
    };
    const onCommand = vi.fn();
    render(
      <PvLossWorkbench
        {...pvProps({
          selected: reviewed,
          objects: [reviewed],
          actorRole: "supervisor",
          commands: [{ id: "confirm_attribution", label: "确认核查方向", tone: "primary" }],
          onCommand,
        })}
      />,
    );

    const curtailment = screen.getByRole("button", { name: /疑似限电/ });
    const equipment = screen.getByRole("button", { name: /设备侧待核对/ });
    expect.soft(curtailment).toBeDisabled();
    expect.soft(equipment).toBeDisabled();
    fireEvent.click(equipment);
    expect.soft(curtailment).toHaveAttribute("aria-pressed", "true");
    expect.soft(equipment).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("已提交站端核查任务")).toHaveTextContent("疑似限电");

    fireEvent.change(screen.getByLabelText("光伏核查主管ID"), {
      target: { value: "operations-supervisor-01" },
    });
    fireEvent.change(screen.getByLabelText("光伏核查主管意见"), {
      target: { value: "确认补取方向，现场证据齐备前不认定少发根因。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认核查方向" }));

    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand.mock.calls[0]![2].data.direction.code).toBe("curtailment");
  });

  it("case 20 never emits a fabricated object ID for a sparse real station-day matrix", () => {
    const onSelect = vi.fn();
    render(<PvLossWorkbench {...pvProps({ onSelect })} />);

    const rail = screen.getByLabelText("光伏电站列表");
    const station3 = within(rail).getByRole("button", { name: /PV-03/ });
    const unavailable = (station3 as HTMLButtonElement).disabled
      || station3.getAttribute("aria-disabled") === "true";
    fireEvent.click(station3);

    if (unavailable) {
      expect(onSelect).not.toHaveBeenCalled();
      return;
    }

    expect(onSelect).toHaveBeenCalledTimes(1);
    const selectedObjectId = onSelect.mock.calls[0]![0] as string;
    const realObjectIds = new Set(
      dataset20.sceneRows.map((row) => `20-${String(row.station_id)}-${String(row.date)}`),
    );
    expect(realObjectIds).toContain(selectedObjectId);
  });
});
