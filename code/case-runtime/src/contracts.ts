export type CaseActor = {
  id: string;
  role: string;
};

export type CaseCommand = {
  caseId: string;
  objectId: string;
  command: string;
  actor: CaseActor;
  expectedVersion: number;
  idempotencyKey: string;
  reason?: string;
  evidenceIds: string[];
  data?: Record<string, unknown>;
};

export type WorkflowCommand = {
  from: string[];
  to: string;
  roles: string[];
};

export type WorkflowDefinition = {
  initialState: string;
  commands: Record<string, WorkflowCommand>;
};

export type CaseProjection = {
  caseId: string;
  objectId: string;
  state: string;
  version: number;
  payload: Record<string, unknown>;
  task?: Record<string, unknown>;
  updatedAt: string;
};

export type CaseEvent = {
  eventId: string;
  caseId: string;
  objectId: string;
  command: string;
  actor: CaseActor;
  fromState: string;
  toState: string;
  version: number;
  reason?: string;
  evidenceIds: string[];
  data?: Record<string, unknown>;
  occurredAt: string;
};

export type CommandResult = {
  receiptId: string;
  inputHash: string;
  eventHash: string;
  projection: CaseProjection;
  event: CaseEvent;
  duplicate: boolean;
};

export type ResetReceipt = {
  caseId: string;
  objectId?: string;
  resetAt: string;
  removedObjects: number;
  receiptId: string;
};
