import { describe, expect, it } from "vitest";
import type { CaseProjection } from "@course-ai-product/case-runtime";
import {
  bindRuntimeRevision,
  projectionsMatchRuntimeRevision,
} from "../../cases/runtime-revision";

const projection = (payload: Record<string, unknown>): CaseProjection => ({
  caseId: "04",
  objectId: "04-CR20260000001",
  state: "待复核",
  version: 0,
  payload,
  updatedAt: "2026-07-24T00:00:00.000Z",
});

describe("runtime revision", () => {
  const revision = {
    datasetHash: "dataset-v2",
    workflowHash: "workflow-v2",
  };

  it("binds dataset and workflow revisions to seeded payloads", () => {
    expect(bindRuntimeRevision({ application_id: "CR20260000001" }, revision))
      .toMatchObject({
        application_id: "CR20260000001",
        _runtimeRevision: revision,
      });
  });

  it("requires a safe reseed when either revision changes or is absent", () => {
    const current = projection(bindRuntimeRevision({}, revision));
    expect(projectionsMatchRuntimeRevision([current], revision)).toBe(true);
    expect(
      projectionsMatchRuntimeRevision([current], {
        ...revision,
        datasetHash: "dataset-v3",
      }),
    ).toBe(false);
    expect(projectionsMatchRuntimeRevision([projection({})], revision)).toBe(
      false,
    );
  });
});
