import { describe, expect, it } from "vitest";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import { validateDomainCommand, type DomainCommandInput } from "../../cases/domain-command";

function projection(
  caseId: string,
  payload: Record<string, unknown>,
  task: Record<string, unknown> = {},
  version = 0,
): CaseProjection {
  return {
    caseId,
    objectId: `${caseId}-OBJECT-1`,
    state: version ? "处理中" : "待处理",
    version,
    payload,
    task,
    updatedAt: "2026-07-26T00:00:00.000Z",
  };
}

describe("productized domain gates for cases 19 and 20", () => {
  it("case 19 persists a complete component order bound to current condition codes", () => {
    const payload = {
      cycle_id: "217",
      pump_state: "严重泄漏", pump_severity: "critical", pump_condition: "2.0",
      valve_state: "接近故障", valve_severity: "critical", valve_condition: "73.0",
      cooler_state: "接近故障", cooler_severity: "critical", cooler_condition: "3.0",
      accumulator_state: "最佳压力", accumulator_severity: "normal", accumulator_condition: "130.0",
      affected_component_count: "3",
    };
    const inspectionOrder = [
      { component: "pump", position: 1, label: "泵", state: "严重泄漏", severity: "critical", conditionCode: "2.0" },
      { component: "valve", position: 2, label: "比例阀", state: "接近故障", severity: "critical", conditionCode: "73.0" },
      { component: "cooler", position: 3, label: "冷却器", state: "接近故障", severity: "critical", conditionCode: "3.0" },
      { component: "accumulator", position: 4, label: "蓄能器", state: "最佳压力", severity: "normal", conditionCode: "130.0" },
    ];
    const data = {
      taskId: "HYD-217-v1",
      cycleId: "217",
      focused: "cooler",
      reviewed: ["pump", "valve", "cooler"],
      inspectionOrder,
      orderConfirmed: true,
      evidenceBasis: ["cycle-condition-flags", "sensor-trend-20"],
      owner: "液压检修组-A",
      dueAt: "2026-07-28T08:00",
      reviewerId: "reliability-engineer-01",
      reviewNote: "先核对泵泄漏，再核对比例阀和冷却器状态。",
    };
    const input: DomainCommandInput = {
      caseId: "B019",
      command: "submit_maintenance_review",
      actorRole: "reliability_engineer",
      actorId: "reliability-engineer-01",
      idempotencyKey: "hydraulic-check:19-217:0:submit",
      evidenceIds: [
        "cycle:217",
        "component:pump:condition:2.0",
        "component:valve:condition:73.0",
        "component:cooler:condition:3.0",
        "component:accumulator:condition:130.0",
        "basis:cycle-condition-flags",
        "basis:sensor-trend-20",
      ],
      data,
      current: projection("B019", payload),
    };
    expect(() => validateDomainCommand(input)).not.toThrow();
    expect(() => validateDomainCommand({
      ...input,
      data: {
        ...data,
        inspectionOrder: inspectionOrder.map((item) => item.component === "pump" ? { ...item, conditionCode: "0" } : item),
      },
    })).toThrow("hydraulic_order_mismatch");
  });

  it("case 20 records the loaded aggregate and all three explicit load failures", () => {
    const payload = {
      station_id: "8",
      date: "2020-05-19",
      mean_efficiency_ratio: "0.36193088",
      curtailment_suspected_share: "0.40625",
      mean_temperature_derating_pct: "0.0023726074",
    };
    const sources = [
      { sourceId: "station-day-aggregate", label: "公开站日汇总", status: "loaded", evidenceId: "station-day:8:2020-05-19" },
      { sourceId: "dispatch-curtailment-log", label: "调度限电记录", status: "load_failed", failureCode: "source_not_in_dataset" },
      { sourceId: "inverter-alert-log", label: "逆变器告警", status: "load_failed", failureCode: "source_not_in_dataset" },
      { sourceId: "maintenance-work-order", label: "站端检修工单", status: "load_failed", failureCode: "source_not_in_dataset" },
    ];
    const data = {
      taskId: "PV-8-20200519-v1",
      stationId: "8",
      date: "2020-05-19",
      direction: {
        code: "curtailment",
        label: "疑似限电",
        status: "provisional",
        basis: {
          meanEfficiencyRatio: "0.36193088",
          curtailmentSuspectedShare: "0.40625",
          temperatureDeratingShare: "0.0023726074",
        },
      },
      evidenceSources: sources,
      retrievalRequest: {
        requestedSourceIds: ["dispatch-curtailment-log", "inverter-alert-log", "maintenance-work-order"],
        owner: "华北站端运维组",
        dueAt: "2026-07-29T18:00",
        requesterId: "performance-engineer-01",
        note: "补取调度、逆变器告警和检修记录后再判断少发方向。",
      },
    };
    const input: DomainCommandInput = {
      caseId: "B020",
      command: "submit_station_check",
      actorRole: "performance_engineer",
      actorId: "performance-engineer-01",
      idempotencyKey: "pv-investigation:20-8-2020-05-19:0:handoff",
      evidenceIds: [
        "station-day:8:2020-05-19",
        "load-failure:dispatch-curtailment-log",
        "load-failure:inverter-alert-log",
        "load-failure:maintenance-work-order",
      ],
      data,
      current: projection("B020", payload),
    };
    expect(() => validateDomainCommand(input)).not.toThrow();
    expect(() => validateDomainCommand({
      ...input,
      data: {
        ...data,
        evidenceSources: sources.filter((item) => item.sourceId !== "maintenance-work-order"),
      },
    })).toThrow("pv_sources_required");
  });
});
