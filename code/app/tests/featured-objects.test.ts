import { describe, expect, it } from "vitest";
import { loadDatasetProjection } from "../../cases/load-dataset";
import {
  featuredObjectToSeed,
  orderFeaturedFirst,
} from "../../cases/featured-object";
import { getCaseDefinition } from "../../cases/registry";

const expectedFeaturedObjects = {
  "B001": "B001-C496116-M",
  "B004": "B004-CR20260000001",
  "B010": "B010-CN-TEL-2025Q2-0008",
  "B011": "B011-MODEL-ADMISSION-001-MODEL-GATE-2026-1",
  "B012": "B012-CCI-2026-001-CN-SC-PZ-01",
  "B014": "B014-FQ-0016",
  "B015": "B015-SECOM-0003",
  "B016": "B016-7-1",
  "B017": "B017-BD-0003",
  "B018": "B018-BT-0044",
  "B019": "B019-217",
  "B020": "B020-8-2020-05-19",
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
    const definition = getCaseDefinition("B004")!;
    const projection = loadDatasetProjection(definition, 24);

    expect(projection.sourcePath.replaceAll("\\", "/")).toMatch(
      /04-credit-human-review\/applications\.csv$/,
    );
    expect(projection.rowCount).toBe(1200);
    expect(projection.rows[0]).toMatchObject({
      objectId: "B004-CR20260000001",
      application_id: "CR20260000001",
      income_evidence_status: "missing",
    });
  });

  it("repairs a persisted runtime that predates the featured object contract", () => {
    const existing = [{ objectId: "B019-1005" }, { objectId: "B019-1006" }];
    const dataset = [{ objectId: "B019-217" }, { objectId: "B019-1005" }];

    expect(featuredObjectToSeed(existing, dataset, "B019-217")).toEqual({
      objectId: "B019-217",
    });
    expect(
      orderFeaturedFirst([...existing, dataset[0]!], "B019-217").map(
        (row) => row.objectId,
      ),
    ).toEqual(["B019-217", "B019-1005", "B019-1006"]);
  });
});
