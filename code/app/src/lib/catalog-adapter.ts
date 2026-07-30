import type { CaseDefinition } from "@cases/contracts";

type ManifestChapter = {
  id: string;
  title: string;
};

type ManifestCase = {
  id: string;
  chapter_ids: string[];
  runtime_mode: "deterministic_offline" | "offline_replay_and_optional_live_model";
  status: "verified_shared_runtime" | "data_contract_verified_ui_in_progress";
};

export type CourseManifest = {
  chapters: ManifestChapter[];
  cases: ManifestCase[];
  runtime: {
    provider: {
      live_case_ids: string[];
    };
  };
};

export type CatalogTag = {
  id: string;
  label: string;
};

export type CatalogCase = {
  kind: "case";
  id: string;
  runtimeId: string;
  shortTitle: string;
  title: string;
  family: CaseDefinition["family"];
  familyLabel: string;
  industry: string;
  scenario: string;
  objectLabel: string;
  defaultObject: string;
  theoryTags: CatalogTag[];
  capabilityTags: CatalogTag[];
  loopStepCount: number;
  journeySteps: string[];
  runtime: {
    offlineReady: boolean;
    optionalLiveModel: boolean;
    recoverable: boolean;
    verification: ManifestCase["status"];
  };
  href: string;
};

export type CatalogFilters = {
  query: string;
  family: "all" | CaseDefinition["family"];
  chapterId: "all" | string;
  runtime: "all" | "offline" | "optional-model";
  recovery: "all" | "recoverable" | "standard";
  sort: "id" | "family" | "optional-model";
};

export const familyLabels: Record<CaseDefinition["family"], string> = {
  commerce: "交易与服务",
  approval: "审批与协同",
  investigation: "调查与检索",
  industrial: "工业与能源",
};

const familyCapabilities: Record<CaseDefinition["family"], CatalogTag> = {
  commerce: { id: "service-decision", label: "服务决策" },
  approval: { id: "human-approval", label: "人工审批" },
  investigation: { id: "evidence-retrieval", label: "资料检索" },
  industrial: { id: "industrial-review", label: "工业复核" },
};

function assertSameCaseSet(definitions: CaseDefinition[], manifestCases: ManifestCase[]) {
  const definitionIds = new Set(definitions.map((definition) => definition.id));
  const manifestIds = new Set(manifestCases.map((item) => item.id));
  if (
    definitionIds.size !== definitions.length ||
    manifestIds.size !== manifestCases.length ||
    definitionIds.size !== manifestIds.size ||
    [...definitionIds].some((id) => !manifestIds.has(id))
  ) {
    throw new Error("catalog_case_set_mismatch");
  }
}

export function buildCatalogCases(
  definitions: CaseDefinition[],
  manifest: CourseManifest,
): CatalogCase[] {
  assertSameCaseSet(definitions, manifest.cases);
  const chapters = new Map(manifest.chapters.map((chapter) => [chapter.id, chapter]));
  const manifestCases = new Map(manifest.cases.map((item) => [item.id, item]));
  const liveCaseIds = new Set(manifest.runtime.provider.live_case_ids);

  return definitions.map((definition) => {
    const manifestCase = manifestCases.get(definition.id);
    if (!manifestCase) {
      throw new Error(`catalog_case_status_invalid:${definition.id}`);
    }
    const theoryTags = manifestCase.chapter_ids.map((chapterId) => {
      const chapter = chapters.get(chapterId);
      if (!chapter) {
        throw new Error(`catalog_chapter_missing:${definition.id}:${chapterId}`);
      }
      return { id: chapter.id, label: chapter.title };
    });
    const optionalLiveModel =
      manifestCase.runtime_mode === "offline_replay_and_optional_live_model" &&
      liveCaseIds.has(definition.id);

    return {
      kind: "case",
      id: definition.id,
      runtimeId: definition.id,
      shortTitle: definition.shortTitle,
      title: definition.title,
      family: definition.family,
      familyLabel: familyLabels[definition.family],
      industry: definition.industry,
      scenario: definition.scenario,
      objectLabel: definition.objectLabel,
      defaultObject: definition.featuredObjectId ?? "默认队列对象",
      theoryTags,
      capabilityTags: [familyCapabilities[definition.family]],
      loopStepCount: Object.keys(definition.workflow.commands).length,
      journeySteps: definition.workspace.processSteps.map((step) => step.label),
      runtime: {
        offlineReady: true,
        optionalLiveModel,
        recoverable: definition.views.some((view) => view.id === "recovery"),
        verification: manifestCase.status,
      },
      href: `/cases/${definition.id}`,
    };
  });
}

export function filterCatalogCases(
  cases: CatalogCase[],
  filters: CatalogFilters,
): CatalogCase[] {
  const needle = filters.query.trim().toLowerCase();
  return cases
    .filter((item) => {
      const searchable = [
        item.id,
        item.shortTitle,
        item.title,
        item.industry,
        item.scenario,
        item.familyLabel,
        ...item.theoryTags.map((tag) => tag.label),
        ...item.capabilityTags.map((tag) => tag.label),
      ]
        .join(" ")
        .toLowerCase();
      const matchesRuntime =
        filters.runtime === "all" ||
        (filters.runtime === "offline" && item.runtime.offlineReady) ||
        (filters.runtime === "optional-model" && item.runtime.optionalLiveModel);
      const matchesRecovery =
        filters.recovery === "all" ||
        (filters.recovery === "recoverable" && item.runtime.recoverable) ||
        (filters.recovery === "standard" && !item.runtime.recoverable);
      return (
        (filters.family === "all" || item.family === filters.family) &&
        (filters.chapterId === "all" ||
          item.theoryTags.some((tag) => tag.id === filters.chapterId)) &&
        matchesRuntime &&
        matchesRecovery &&
        (!needle || searchable.includes(needle))
      );
    })
    .sort((left, right) => {
      if (filters.sort === "family") {
        return left.familyLabel.localeCompare(right.familyLabel, "zh-CN") || left.id.localeCompare(right.id);
      }
      if (filters.sort === "optional-model") {
        return Number(right.runtime.optionalLiveModel) - Number(left.runtime.optionalLiveModel) || left.id.localeCompare(right.id);
      }
      return left.id.localeCompare(right.id);
    });
}
