import type { CaseFamily } from "@course-ai-product/design-system";
import type { WorkflowDefinition } from "@course-ai-product/case-runtime";

export type CaseMetric = {
  id: string;
  label: string;
  value: string;
  note: string;
};

export type PredicateOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "empty"
  | "not-empty"
  | "truthy"
  | "falsy";

export type CasePredicate = {
  field: string;
  op: PredicateOperator;
  value?: string | number | boolean | string[];
};

export type CaseMetricSpec = {
  id: string;
  label: string;
  note: string;
  field?: string;
  aggregation:
    | "count"
    | "count-where"
    | "count-distinct"
    | "sum"
    | "mean"
    | "max"
    | "min";
  where?: CasePredicate[];
  match?: "all" | "any";
  format: "integer" | "decimal" | "percent" | "currency-cny";
  ratioDenominatorField?: string;
  absolute?: boolean;
  shareOfRows?: boolean;
};

export type CaseDecision = {
  level: "normal" | "attention" | "urgent";
  label: string;
  reason: string;
  recommendedCommand: string;
  sourceFields: string[];
};

export type CaseDecisionRule = Omit<CaseDecision, "sourceFields"> & {
  when: CasePredicate[];
  match?: "all" | "any";
};

export type CaseRuleSet = {
  metrics: CaseMetricSpec[];
  decisions: CaseDecisionRule[];
  defaultDecision: CaseDecision;
};

export type CaseWorkspace = {
  queueEyebrow: string;
  queueTitle: string;
  decisionTitle: string;
  sortHint: string;
  processSteps: Array<{
    label: string;
    states: string[];
  }>;
};

export type CaseDefinition = {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  family: CaseFamily;
  tier: "flagship" | "complete";
  industry: string;
  scenario: string;
  datasetFolder: string;
  datasetTarget: string;
  objectLabel: string;
  featuredObjectId?: string;
  identityFields: string[];
  displayFields: { key: string; label: string }[];
  views: { id: string; label: string }[];
  workflow: WorkflowDefinition;
  commandLabels: Record<string, string>;
  primaryRole: string;
  rules: CaseRuleSet;
  workspace: CaseWorkspace;
  aiEnabled: boolean;
};
