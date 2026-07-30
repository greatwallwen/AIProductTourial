import type {
  CaseEvent,
  CaseProjection,
  CommandResult,
} from "@course-ai-product/case-runtime";
import type { CaseDefinition, CaseMetric } from "@cases/contracts";

export type WorkbenchCommand = {
  id: string;
  label: string;
  tone?: "primary" | "secondary" | "danger";
};

export type WorkbenchCommandOptions = {
  actorId?: string;
  data?: Record<string, unknown>;
  evidenceIds?: string[];
  idempotencyKey?: string;
};

export type CaseWorkbenchProps = {
  definition: CaseDefinition;
  objects: CaseProjection[];
  selected: CaseProjection;
  events: CaseEvent[];
  metrics: CaseMetric[];
  datasetRowCount: number;
  sceneRows: Record<string, unknown>[];
  supportingArtifacts: Record<string, Record<string, unknown>[]>;
  actorRole: string;
  roles: string[];
  commands: WorkbenchCommand[];
  busy: boolean;
  error?: string;
  receipt?: CommandResult;
  onActorRoleChange: (role: string) => void;
  onCommand: (
    command: string,
    reason?: string,
    options?: WorkbenchCommandOptions,
  ) => void;
  onReset: () => void;
  onSelect: (objectId: string) => void;
};
