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

  it("keeps the 24 registry cases aligned with their manifest chapters", () => {
    expect(catalogCases).toHaveLength(24);
    expect(catalogCases[0]).toMatchObject({
      id: "B001",
      runtimeId: "B001",
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
    expect(catalogCases.find((item) => item.id === "B002")?.runtime.optionalLiveModel).toBe(
      false,
    );
    expect(catalogCases.find((item) => item.id === "B006")?.runtime.recoverable).toBe(false);
    expect(catalogCases.every((item) => item.loopStepCount > 0)).toBe(true);
  });

  it("uses AND semantics across search, chapter, runtime and recovery filters", () => {
    const extended = [
      ...catalogCases,
      { ...catalogCases[0], id: "B021", runtimeId: "B021", shortTitle: "扩展样例", href: "/cases/B021" },
    ];

    const matched = filterCatalogCases(extended, {
      query: "跨境",
      family: "commerce",
      chapterId: "C01",
      runtime: "optional-model",
      recovery: "recoverable",
      sort: "id",
    });

    expect(matched.map((item) => item.id)).toEqual(["B001", "B021"]);
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
