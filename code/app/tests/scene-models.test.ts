import type { CaseProjection } from "@course-ai-product/case-runtime";
import { describe, expect, it } from "vitest";
import { buildSceneModel } from "../src/components/spatial/scene-models";

function projection(
  caseId: string,
  objectId: string,
  payload: Record<string, unknown>,
): CaseProjection {
  return {
    caseId,
    objectId,
    state: "待复核",
    version: 0,
    payload,
    updatedAt: "2026-07-24T00:00:00.000Z",
  };
}

describe("spatial scene models", () => {
  it("builds a deterministic 12-sensor wafer view without inventing coordinates", () => {
    const wafer = projection("B015", "B015-SECOM-0003", {
      wafer_id: "SECOM-0003",
      quality_label: "fail",
      sensor_161: "759",
      sensor_159: "",
      sensor_021: "-5447.75",
    });

    const first = buildSceneModel("B015", wafer);
    const second = buildSceneModel("B015", wafer);

    expect(first).toEqual(second);
    expect(first?.nodes).toHaveLength(12);
    expect(first?.disclosure).toBe("示意结构");
    expect(first?.nodes.find((node) => node.id === "sensor_159")?.status).toBe(
      "unknown",
    );
  });

  it("uses a comparison grid for wind turbines", () => {
    const wind = projection("B016", "16-7-1", {
      turbine_id: "7",
      day: "1",
      underperformance_share: "1",
      mean_active_power: "579.36203",
    });

    const model = buildSceneModel("B016", wind);

    expect(model?.disclosure).toBe("比较视图");
    expect(model?.nodes).toHaveLength(9);
    expect(model?.nodes.some((node) => node.id === "16-7-1")).toBe(true);
  });

  it("keeps the four hydraulic components in the inspection vocabulary", () => {
    const hydraulic = projection("B019", "19-217", {
      cycle_id: "217",
      cooler_severity: "critical",
      valve_severity: "critical",
      pump_severity: "critical",
      accumulator_severity: "normal",
    });

    expect(
      buildSceneModel("B019", hydraulic)?.nodes.map((node) => node.label),
    ).toEqual(["冷却器", "阀", "泵", "蓄能器"]);
  });

  it("builds eight station positions while keeping unknown peers explicit", () => {
    const solar = projection("B020", "20-8-2020-05-19", {
      station_id: "8",
      date: "2020-05-19",
      mean_efficiency_ratio: "0.36193088",
      curtailment_suspected_share: "0.40625",
    });

    const model = buildSceneModel("B020", solar);

    expect(model?.nodes).toHaveLength(8);
    expect(model?.nodes.find((node) => node.id === solar.objectId)?.status).not.toBe(
      "unknown",
    );
    expect(model?.nodes.filter((node) => node.status === "unknown")).toHaveLength(7);
  });

  it("does not create a spatial model for ordinary cases", () => {
    expect(buildSceneModel("B014", projection("B014", "14-1", {}))).toBeUndefined();
  });
});
