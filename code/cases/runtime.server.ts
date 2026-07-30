import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  createCaseStore,
  type CommandResult,
  type CaseEvent,
  type CaseProjection,
  type CaseStore,
} from "@course-ai-product/case-runtime";
import type { CaseDefinition } from "./contracts";
import type { CaseMetric } from "./contracts";
import {
  featuredObjectToSeed,
  orderFeaturedFirst,
} from "./featured-object";
import { loadDatasetProjection } from "./load-dataset";
import type { DatasetProjection } from "./load-dataset";
import {
  bindRuntimeRevision,
  projectionsMatchRuntimeRevision,
  workflowHashFor,
} from "./runtime-revision";

const runtimeRoot = resolve(process.cwd(), "../runtime");
mkdirSync(runtimeRoot, { recursive: true });

const runtimeGlobal = globalThis as typeof globalThis & {
  __courseCaseStores?: Map<string, CaseStore>;
  __courseFullDatasets?: Map<string, DatasetProjection>;
};

const stores = runtimeGlobal.__courseCaseStores ?? new Map<string, CaseStore>();
runtimeGlobal.__courseCaseStores = stores;
const fullDatasets =
  runtimeGlobal.__courseFullDatasets ?? new Map<string, DatasetProjection>();
runtimeGlobal.__courseFullDatasets = fullDatasets;

function sortByDecisionPriority(objects: CaseProjection[]): CaseProjection[] {
  const rank = { urgent: 0, attention: 1, normal: 2 };
  return [...objects].sort((left, right) => {
    const leftLevel = String(
      (left.payload.decision as { level?: string } | undefined)?.level ?? "normal",
    ) as keyof typeof rank;
    const rightLevel = String(
      (right.payload.decision as { level?: string } | undefined)?.level ?? "normal",
    ) as keyof typeof rank;
    return (rank[leftLevel] ?? 2) - (rank[rightLevel] ?? 2);
  });
}

export function getCaseStore(definition: CaseDefinition): CaseStore {
  const existing = stores.get(definition.id);
  if (existing) {
    return existing;
  }
  const store = createCaseStore({
    filename: resolve(runtimeRoot, `${definition.id}.sqlite`),
    workflows: { [definition.id]: definition.workflow },
  });
  stores.set(definition.id, store);
  return store;
}

export function ensureCaseSeeded(definition: CaseDefinition): {
  objects: CaseProjection[];
  rowCount: number;
  datasetHash: string;
  metrics: CaseMetric[];
  sceneRows: Record<string, unknown>[];
  supportingArtifacts: Record<string, Record<string, unknown>[]>;
} {
  const store = getCaseStore(definition);
  const dataset = loadDatasetProjection(definition);
  const runtimeRevision = {
    datasetHash: dataset.sha256,
    workflowHash: workflowHashFor(definition.workflow),
  };
  const existing = store.list(definition.id);
  if (
    existing.length > 0 &&
    (!existing.every((item) => item.payload.decision) ||
      !projectionsMatchRuntimeRevision(existing, runtimeRevision))
  ) {
    store.resetCase(definition.id, `RESET-${definition.id}`);
  }
  if (store.list(definition.id).length === 0) {
    for (const row of dataset.rows) {
      store.seed(
        definition.id,
        row.objectId,
        bindRuntimeRevision(row, runtimeRevision),
      );
    }
  } else {
    const featured = featuredObjectToSeed(
      store.list(definition.id),
      dataset.rows,
      definition.featuredObjectId,
    );
    if (featured) {
      store.seed(
        definition.id,
        featured.objectId,
        bindRuntimeRevision(featured, runtimeRevision),
      );
    }
  }
  const objects = orderFeaturedFirst(
    sortByDecisionPriority(store.list(definition.id)),
    definition.featuredObjectId,
  );
  return {
    objects,
    rowCount: dataset.rowCount,
    datasetHash: dataset.sha256,
    metrics: dataset.metrics,
    sceneRows: dataset.sceneRows,
    supportingArtifacts: dataset.supportingArtifacts,
  };
}

export function ensureCaseObject(
  definition: CaseDefinition,
  objectId: string,
): CaseProjection {
  ensureCaseSeeded(definition);
  const store = getCaseStore(definition);
  try {
    return store.project(definition.id, objectId);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "object_not_found") {
      throw error;
    }
  }

  let dataset = fullDatasets.get(definition.id);
  if (!dataset) {
    dataset = loadDatasetProjection(definition, Number.MAX_SAFE_INTEGER);
    fullDatasets.set(definition.id, dataset);
  }
  const row = dataset.rows.find((item) => item.objectId === objectId);
  if (!row) {
    throw new Error("object_not_found");
  }
  return store.seed(
    definition.id,
    objectId,
    bindRuntimeRevision(row, {
      datasetHash: dataset.sha256,
      workflowHash: workflowHashFor(definition.workflow),
    }),
  );
}

export function eventsFor(
  definition: CaseDefinition,
  objectId: string | undefined,
): CaseEvent[] {
  if (!objectId) {
    return [];
  }
  return getCaseStore(definition).listEvents(definition.id, objectId);
}

export function receiptFor(
  definition: CaseDefinition,
  objectId: string | undefined,
): CommandResult | undefined {
  if (!objectId) {
    return undefined;
  }
  return getCaseStore(definition).latestReceipt(definition.id, objectId);
}
