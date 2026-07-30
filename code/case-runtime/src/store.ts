import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type {
  CaseCommand,
  CaseEvent,
  CaseProjection,
  CommandResult,
  ResetReceipt,
  WorkflowDefinition,
} from "./contracts";
import { digest } from "./receipt";
import { applyTransition } from "./workflow";

type StoreOptions = {
  filename: string;
  workflows: Record<string, WorkflowDefinition>;
};

type ProjectionRow = {
  case_id: string;
  object_id: string;
  state: string;
  version: number;
  payload_json: string;
  task_json: string;
  updated_at: string;
};

type ReceiptRow = {
  result_json: string;
};

type EventRow = {
  event_json: string;
};

export type CaseStore = ReturnType<typeof createCaseStore>;

export function createCaseStore(options: StoreOptions) {
  const database = new DatabaseSync(options.filename);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS projections (
      case_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      state TEXT NOT NULL,
      version INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      task_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (case_id, object_id)
    );
    CREATE TABLE IF NOT EXISTS events (
      event_id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      event_json TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS receipts (
      receipt_id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (case_id, object_id, idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS resets (
      receipt_id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      removed_objects INTEGER NOT NULL,
      reset_at TEXT NOT NULL
    );
  `);

  const projectionColumns = database
    .prepare("PRAGMA table_info(projections)")
    .all() as unknown as Array<{ name: string }>;
  if (!projectionColumns.some((column) => column.name === "task_json")) {
    database.exec(
      "ALTER TABLE projections ADD COLUMN task_json TEXT NOT NULL DEFAULT '{}'",
    );
  }

  const readProjection = database.prepare(
    "SELECT * FROM projections WHERE case_id = ? AND object_id = ?",
  );
  const readReceipt = database.prepare(
    "SELECT result_json FROM receipts WHERE case_id = ? AND object_id = ? AND idempotency_key = ?",
  );

  function rowToProjection(row: ProjectionRow): CaseProjection {
    return {
      caseId: row.case_id,
      objectId: row.object_id,
      state: row.state,
      version: row.version,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
      task: JSON.parse(row.task_json || "{}") as Record<string, unknown>,
      updatedAt: row.updated_at,
    };
  }

  function project(caseId: string, objectId: string): CaseProjection {
    const row = readProjection.get(caseId, objectId) as ProjectionRow | undefined;
    if (!row) {
      throw new Error("object_not_found");
    }
    return rowToProjection(row);
  }

  function seed(
    caseId: string,
    objectId: string,
    payload: Record<string, unknown>,
  ): CaseProjection {
    const workflow = options.workflows[caseId];
    if (!workflow) {
      throw new Error("workflow_not_found");
    }
    const now = new Date().toISOString();
    database
      .prepare(
        `INSERT OR IGNORE INTO projections
          (case_id, object_id, state, version, payload_json, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)`,
      )
      .run(caseId, objectId, workflow.initialState, JSON.stringify(payload), now);
    return project(caseId, objectId);
  }

  function list(caseId: string): CaseProjection[] {
    const rows = database
      .prepare("SELECT * FROM projections WHERE case_id = ? ORDER BY object_id LIMIT 100")
      .all(caseId) as unknown as ProjectionRow[];
    return rows.map(rowToProjection);
  }

  function listEvents(caseId: string, objectId: string): CaseEvent[] {
    const rows = database
      .prepare(
        "SELECT event_json FROM events WHERE case_id = ? AND object_id = ? ORDER BY version, occurred_at",
      )
      .all(caseId, objectId) as unknown as EventRow[];
    return rows.map((row) => JSON.parse(row.event_json) as CaseEvent);
  }

  function latestReceipt(
    caseId: string,
    objectId: string,
  ): CommandResult | undefined {
    const rows = database
      .prepare(
        "SELECT result_json FROM receipts WHERE case_id = ? AND object_id = ?",
      )
      .all(caseId, objectId) as unknown as ReceiptRow[];
    return rows
      .map((row) => JSON.parse(row.result_json) as CommandResult)
      .sort((left, right) => right.event.version - left.event.version)[0];
  }

  function dispatch(command: CaseCommand): CommandResult {
    const previous = readReceipt.get(
      command.caseId,
      command.objectId,
      command.idempotencyKey,
    ) as ReceiptRow | undefined;
    if (previous) {
      const previousResult = JSON.parse(previous.result_json) as CommandResult;
      if (previousResult.inputHash !== digest(command)) {
        throw new Error("idempotency_conflict");
      }
      return {
        ...previousResult,
        duplicate: true,
      };
    }

    const workflow = options.workflows[command.caseId];
    if (!workflow) {
      throw new Error("workflow_not_found");
    }

    database.exec("BEGIN IMMEDIATE");
    try {
      const current = project(command.caseId, command.objectId);
      if (current.version !== command.expectedVersion) {
        throw new Error("version_conflict");
      }
      const toState = applyTransition(
        workflow,
        current.state,
        command.command,
        command.actor.role,
      );
      const occurredAt = new Date().toISOString();
      const event: CaseEvent = {
        eventId: randomUUID(),
        caseId: command.caseId,
        objectId: command.objectId,
        command: command.command,
        actor: command.actor,
        fromState: current.state,
        toState,
        version: current.version + 1,
        reason: command.reason,
        evidenceIds: command.evidenceIds,
        data: command.data,
        occurredAt,
      };
      const projection: CaseProjection = {
        ...current,
        state: toState,
        version: event.version,
        task: {
          ...(current.task ?? {}),
          ...(command.data ?? {}),
        },
        updatedAt: occurredAt,
      };
      database
        .prepare(
          `UPDATE projections
           SET state = ?, version = ?, task_json = ?, updated_at = ?
           WHERE case_id = ? AND object_id = ? AND version = ?`,
        )
        .run(
          projection.state,
          projection.version,
          JSON.stringify(projection.task ?? {}),
          projection.updatedAt,
          command.caseId,
          command.objectId,
          current.version,
        );
      database
        .prepare(
          `INSERT INTO events
            (event_id, case_id, object_id, version, event_json, occurred_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.eventId,
          event.caseId,
          event.objectId,
          event.version,
          JSON.stringify(event),
          event.occurredAt,
        );
      const inputHash = digest(command);
      const eventHash = digest(event);
      const result: CommandResult = {
        receiptId: digest({ inputHash, eventHash, version: projection.version }),
        inputHash,
        eventHash,
        projection,
        event,
        duplicate: false,
      };
      database
        .prepare(
          `INSERT INTO receipts
            (receipt_id, case_id, object_id, idempotency_key, result_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          result.receiptId,
          command.caseId,
          command.objectId,
          command.idempotencyKey,
          JSON.stringify(result),
          occurredAt,
        );
      database.exec("COMMIT");
      return result;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  function resetCase(caseId: string, confirmation: string): ResetReceipt {
    if (confirmation !== `RESET-${caseId}`) {
      throw new Error("reset_confirmation_required");
    }
    database.exec("BEGIN IMMEDIATE");
    try {
      const count = database
        .prepare("SELECT COUNT(*) AS count FROM projections WHERE case_id = ?")
        .get(caseId) as { count: number };
      database.prepare("DELETE FROM receipts WHERE case_id = ?").run(caseId);
      database.prepare("DELETE FROM events WHERE case_id = ?").run(caseId);
      database.prepare("DELETE FROM projections WHERE case_id = ?").run(caseId);
      const resetAt = new Date().toISOString();
      const receipt: ResetReceipt = {
        caseId,
        resetAt,
        removedObjects: Number(count.count),
        receiptId: digest({ caseId, resetAt, removedObjects: Number(count.count) }),
      };
      database
        .prepare(
          "INSERT INTO resets (receipt_id, case_id, removed_objects, reset_at) VALUES (?, ?, ?, ?)",
        )
        .run(receipt.receiptId, caseId, receipt.removedObjects, resetAt);
      database.exec("COMMIT");
      return receipt;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  function resetObject(
    caseId: string,
    objectId: string,
    confirmation: string,
  ): ResetReceipt {
    if (confirmation !== `RESET-${caseId}-${objectId}`) {
      throw new Error("reset_confirmation_required");
    }
    database.exec("BEGIN IMMEDIATE");
    try {
      const existing = database
        .prepare(
          "SELECT COUNT(*) AS count FROM projections WHERE case_id = ? AND object_id = ?",
        )
        .get(caseId, objectId) as { count: number };
      if (Number(existing.count) !== 1) {
        throw new Error("object_not_found");
      }
      database
        .prepare("DELETE FROM receipts WHERE case_id = ? AND object_id = ?")
        .run(caseId, objectId);
      database
        .prepare("DELETE FROM events WHERE case_id = ? AND object_id = ?")
        .run(caseId, objectId);
      database
        .prepare("DELETE FROM projections WHERE case_id = ? AND object_id = ?")
        .run(caseId, objectId);
      const resetAt = new Date().toISOString();
      const receipt: ResetReceipt = {
        caseId,
        objectId,
        resetAt,
        removedObjects: 1,
        receiptId: digest({ caseId, objectId, resetAt, removedObjects: 1 }),
      };
      database
        .prepare(
          "INSERT INTO resets (receipt_id, case_id, removed_objects, reset_at) VALUES (?, ?, ?, ?)",
        )
        .run(receipt.receiptId, caseId, receipt.removedObjects, resetAt);
      database.exec("COMMIT");
      return receipt;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  return {
    seed,
    list,
    project,
    listEvents,
    latestReceipt,
    dispatch,
    resetCase,
    resetObject,
    close: () => database.close(),
  };
}
