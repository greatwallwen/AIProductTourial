import { afterEach, describe, expect, it } from "vitest";
import { createCaseStore, type CaseStore } from "../src/store";
import type { WorkflowDefinition } from "../src/contracts";

const workflow: WorkflowDefinition = {
  initialState: "待核验",
  commands: {
    request_evidence: { from: ["待核验"], to: "待补证", roles: ["analyst"] },
    approve: { from: ["待补证"], to: "已放行", roles: ["supervisor"] },
  },
};

let store: CaseStore | undefined;

afterEach(() => store?.close());

describe("SQLite command store", () => {
  it("persists a projection and returns the same receipt for a duplicate command", () => {
    store = createCaseStore({ filename: ":memory:", workflows: { "B001": workflow } });
    store.seed("B001", "INV-01", { amount: 81768.96 });
    const command = {
      caseId: "B001",
      objectId: "INV-01",
      command: "request_evidence",
      actor: { id: "u-01", role: "analyst" },
      expectedVersion: 0,
      idempotencyKey: "idem-01",
      evidenceIds: ["invoice-cancel"],
      reason: "缺少原始发票",
      data: {
        candidateId: "INV-00",
        requestedEvidence: ["原始订单"],
        assignee: "售后运营",
      },
    };
    const first = store.dispatch(command);
    const duplicate = store.dispatch(command);
    expect(duplicate.receiptId).toBe(first.receiptId);
    expect(store.project("B001", "INV-01")).toMatchObject({ state: "待补证", version: 1 });
    expect(store.project("B001", "INV-01").task).toEqual({
      candidateId: "INV-00",
      requestedEvidence: ["原始订单"],
      assignee: "售后运营",
    });
    expect(store.listEvents("B001", "INV-01")[0]?.data).toMatchObject({
      candidateId: "INV-00",
    });
    expect(store.listEvents("B001", "INV-01")).toHaveLength(1);
  });

  it("rejects version conflicts without changing state", () => {
    store = createCaseStore({ filename: ":memory:", workflows: { "B001": workflow } });
    store.seed("B001", "INV-01", {});
    store.dispatch({
      caseId: "B001",
      objectId: "INV-01",
      command: "request_evidence",
      actor: { id: "u-01", role: "analyst" },
      expectedVersion: 0,
      idempotencyKey: "idem-01",
      evidenceIds: ["invoice-cancel"],
    });
    expect(() =>
      store?.dispatch({
        caseId: "B001",
        objectId: "INV-01",
        command: "approve",
        actor: { id: "u-02", role: "supervisor" },
        expectedVersion: 0,
        idempotencyKey: "idem-02",
        evidenceIds: ["invoice-origin"],
      }),
    ).toThrow("version_conflict");
    expect(store.project("B001", "INV-01").version).toBe(1);
  });

  it("returns the receipt with the highest event version", () => {
    store = createCaseStore({ filename: ":memory:", workflows: { "B001": workflow } });
    store.seed("B001", "INV-01", {});
    store.dispatch({
      caseId: "B001",
      objectId: "INV-01",
      command: "request_evidence",
      actor: { id: "u-01", role: "analyst" },
      expectedVersion: 0,
      idempotencyKey: "idem-01",
      evidenceIds: ["invoice-cancel"],
    });
    const latest = store.dispatch({
      caseId: "B001",
      objectId: "INV-01",
      command: "approve",
      actor: { id: "u-02", role: "supervisor" },
      expectedVersion: 1,
      idempotencyKey: "idem-02",
      evidenceIds: ["invoice-origin"],
    });

    expect(store.latestReceipt("B001", "INV-01")?.receiptId).toBe(
      latest.receiptId,
    );
    expect(store.latestReceipt("B001", "missing")).toBeUndefined();
    });
  });

  it("rejects a reused idempotency key when the command payload changed", () => {
    store = createCaseStore({ filename: ":memory:", workflows: { "B001": workflow } });
    store.seed("B001", "INV-01", { amount: 81768.96 });
    const command = {
      caseId: "B001",
      objectId: "INV-01",
      command: "request_evidence",
      actor: { id: "u-01", role: "analyst" },
      expectedVersion: 0,
      idempotencyKey: "idem-collision",
      evidenceIds: ["invoice-cancel"],
      data: { requestedEvidence: ["原始订单"] },
    };
    store.dispatch(command);
    expect(() => store?.dispatch({
      ...command,
      data: { requestedEvidence: ["付款记录"] },
    })).toThrow("idempotency_conflict");
  });

it("resets one demonstration object without deleting its peers", () => {
  store = createCaseStore({ filename: ":memory:", workflows: { "B001": workflow } });
  store.seed("B001", "INV-DEMO", { amount: 81768.96 });
  store.seed("B001", "INV-KEEP", { amount: 128 });
  store.dispatch({
    caseId: "B001",
    objectId: "INV-DEMO",
    command: "request_evidence",
    actor: { id: "u-01", role: "analyst" },
    expectedVersion: 0,
    idempotencyKey: "idem-demo",
    evidenceIds: ["invoice-cancel"],
  });

  const receipt = store.resetObject("B001", "INV-DEMO", "RESET-B001-INV-DEMO");

  expect(receipt).toMatchObject({
    caseId: "B001",
    objectId: "INV-DEMO",
    removedObjects: 1,
  });
  expect(() => store?.project("B001", "INV-DEMO")).toThrow("object_not_found");
  expect(store.project("B001", "INV-KEEP")).toMatchObject({
    objectId: "INV-KEEP",
    state: "待核验",
    version: 0,
  });
  expect(store.listEvents("B001", "INV-DEMO")).toEqual([]);
  expect(store.latestReceipt("B001", "INV-DEMO")).toBeUndefined();
});
