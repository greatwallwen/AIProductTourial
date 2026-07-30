import { describe, expect, it } from "vitest";
import manifest from "../../../course-manifest.json";
import { CASES } from "../../cases/registry";
import {
  buildCatalogCases,
  type CourseManifest,
  filterCatalogCases,
} from "../src/lib/catalog-adapter";

describe("catalog adapter", () => {
  const catalogCases = buildCatalogCases(CASES, manifest as CourseManifest);

  it("keeps the 20 registry cases aligned with their manifest chapters", () => {
    expect(catalogCases).toHaveLength(20);
    expect(catalogCases[0]).toMatchObject({
      id: "B01",
      runtimeId: "01",
      industry: "跨境零售",
      theoryTags: expect.arrayContaining([
        expect.objectContaining({ id: "C01", label: "逻辑、证据与 AI 基础" }),
      ]),
      runtime: {
        offlineReady: true,
        optionalLiveModel: true,
        recoverable: true,
        verification: "verified_shared_runtime",
      },
    });
    expect(catalogCases.find((item) => item.id === "B02")?.runtime.optionalLiveModel).toBe(
      false,
    );
    expect(catalogCases.find((item) => item.id === "B06")?.runtime.recoverable).toBe(false);
    expect(catalogCases.every((item) => item.loopStepCount > 0)).toBe(true);
  });

  it("uses AND semantics across search, chapter, runtime and recovery filters", () => {
    const extended = [
      ...catalogCases,
      { ...catalogCases[0], id: "B21", runtimeId: "21", shortTitle: "扩展样例", href: "/cases/B21" },
    ];

    const matched = filterCatalogCases(extended, {
      query: "跨境",
      family: "commerce",
      chapterId: "C01",
      runtime: "optional-model",
      recovery: "recoverable",
      sort: "id",
    });

    expect(matched.map((item) => item.id)).toEqual(["B01", "B21"]);
    expect(
      filterCatalogCases(extended, {
        query: "跨境",
        family: "industrial",
        chapterId: "all",
        runtime: "all",
        recovery: "all",
        sort: "id",
      }),
    ).toEqual([]);
  });
});
