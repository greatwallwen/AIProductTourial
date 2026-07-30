import { describe, expect, it } from "vitest";
import { loadDatasetProjection } from "../../cases/load-dataset";
import {
  featuredObjectToSeed,
  orderFeaturedFirst,
} from "../../cases/featured-object";
import { getCaseDefinition } from "../../cases/registry";

const expectedFeaturedObjects = {
  "01": "01-C496116-M",
  "04": "04-CR20260000001",
  "10": "10-CN-TEL-2025Q2-0008",
  "11": "11-MODEL-ADMISSION-001-MODEL-GATE-2026-1",
  "12": "12-CCI-2026-001-CN-SC-PZ-01",
  "14": "14-FQ-0016",
  "15": "15-SECOM-0003",
  "16": "16-7-1",
  "17": "17-BD-0003",
  "18": "18-BT-0044",
  "19": "19-217",
  "20": "20-8-2020-05-19",
} as const;

describe("featured objects", () => {
  it.each(Object.entries(expectedFeaturedObjects))(
    "case %s loads %s first",
    (caseId, objectId) => {
      const definition = getCaseDefinition(caseId);
      expect(definition).toBeDefined();

      const projection = loadDatasetProjection(definition!, 24);

      expect(definition!.featuredObjectId).toBe(objectId);
      expect(projection.rows[0]?.objectId).toBe(objectId);
    },
  );

  it("loads case 04 from the authoritative applications file", () => {
    const definition = getCaseDefinition("04")!;
    const projection = loadDatasetProjection(definition, 24);

    expect(projection.sourcePath.replaceAll("\\", "/")).toMatch(
      /04-credit-human-review\/applications\.csv$/,
    );
    expect(projection.rowCount).toBe(1200);
    expect(projection.rows[0]).toMatchObject({
      objectId: "04-CR20260000001",
      application_id: "CR20260000001",
      income_evidence_status: "missing",
    });
  });

  it("repairs a persisted runtime that predates the featured object contract", () => {
    const existing = [{ objectId: "19-1005" }, { objectId: "19-1006" }];
    const dataset = [{ objectId: "19-217" }, { objectId: "19-1005" }];

    expect(featuredObjectToSeed(existing, dataset, "19-217")).toEqual({
      objectId: "19-217",
    });
    expect(
      orderFeaturedFirst([...existing, dataset[0]!], "19-217").map(
        (row) => row.objectId,
      ),
    ).toEqual(["19-217", "19-1005", "19-1006"]);
  });
});
