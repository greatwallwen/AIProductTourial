import { createHash } from "node:crypto";
import type {
  CaseProjection,
  WorkflowDefinition,
} from "@course-ai-product/case-runtime";

export type RuntimeRevision = {
  datasetHash: string;
  workflowHash: string;
};

export function workflowHashFor(workflow: WorkflowDefinition): string {
  return createHash("sha256")
    .update(JSON.stringify(workflow))
    .digest("hex");
}

export function bindRuntimeRevision(
  payload: Record<string, unknown>,
  revision: RuntimeRevision,
): Record<string, unknown> {
  return {
    ...payload,
    _runtimeRevision: revision,
  };
}

export function projectionsMatchRuntimeRevision(
  projections: CaseProjection[],
  revision: RuntimeRevision,
): boolean {
  return projections.every((projection) => {
    const stored = projection.payload._runtimeRevision as
      | Partial<RuntimeRevision>
      | undefined;
    return (
      stored?.datasetHash === revision.datasetHash &&
      stored.workflowHash === revision.workflowHash
    );
  });
}
