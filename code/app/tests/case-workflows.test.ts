import { afterAll, describe, expect, it } from "vitest";
import { createCaseStore } from "@course-ai-product/case-runtime";
import { loadDatasetProjection } from "../../cases/load-dataset";
import { CASES } from "../../cases/registry";

const workflows = Object.fromEntries(CASES.map((item) => [item.id, item.workflow]));
const store = createCaseStore({ filename: ":memory:", workflows });

type CaseDefinition = (typeof CASES)[number];
type CommandEntry = [
  string,
  CaseDefinition["workflow"]["commands"][string],
];

function pathFromPrimaryRoleToSupervisor(definition: CaseDefinition): CommandEntry[] {
  const commands = Object.entries(definition.workflow.commands) as CommandEntry[];
  const firstSteps = commands.filter(([, command]) =>
    command.from.includes(definition.workflow.initialState) &&
    command.roles.includes(definition.primaryRole),
  );
  const queue = firstSteps.map((step) => ({ state: step[1].to, path: [step] }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    const supervisorStep = commands.find(([, command]) =>
      command.from.includes(current.state) && command.roles.includes("supervisor"),
    );
    if (supervisorStep) return [...current.path, supervisorStep];
    if (visited.has(current.state)) continue;
    visited.add(current.state);
    for (const step of commands.filter(([, command]) =>
      command.from.includes(current.state) && !command.roles.includes("supervisor"),
    )) {
      queue.push({ state: step[1].to, path: [...current.path, step] });
    }
  }

  throw new Error(`${definition.id}:supervisor_path_missing`);
}

afterAll(() => store.close());

describe("all 20 case command loops", () => {
  it.each(CASES.map((item) => [item.id, item] as const))(
    "case %s persists one allowed command, rejects a forbidden role and resets",
    (_id, definition) => {
      const dataset = loadDatasetProjection(definition, 1);
      expect(dataset.rowCount).toBeGreaterThan(0);
      const row = dataset.rows[0];
      expect(row).toBeDefined();
      const objectId = row!.objectId;
      store.seed(definition.id, objectId, row!);
      const [commandName, command] = Object.entries(definition.workflow.commands).find(
        ([, candidate]) =>
          candidate.from.includes(definition.workflow.initialState) &&
          candidate.roles.includes(definition.primaryRole),
      )!;
      expect(() =>
        store.dispatch({
          caseId: definition.id,
          objectId,
          command: commandName,
          actor: { id: "outsider", role: "unauthorized" },
          expectedVersion: 0,
          idempotencyKey: `${definition.id}-forbidden`,
          evidenceIds: ["dataset-row"],
        }),
      ).toThrow("role_forbidden");
      const result = store.dispatch({
        caseId: definition.id,
        objectId,
        command: commandName,
        actor: { id: "owner", role: definition.primaryRole },
        expectedVersion: 0,
        idempotencyKey: `${definition.id}-allowed`,
        evidenceIds: ["dataset-row"],
      });
      expect(result.projection.version).toBe(1);
      expect(result.projection.state).toBe(command.to);
      expect(store.listEvents(definition.id, objectId)).toHaveLength(1);
      const reset = store.resetCase(definition.id, `RESET-${definition.id}`);
      expect(reset.removedObjects).toBe(1);
      expect(store.list(definition.id)).toHaveLength(0);
    },
  );

  it.each(CASES.map((item) => [item.id, item] as const))(
    "case %s reaches a supervisor transition through its declared roles",
    (_id, definition) => {
      const row = loadDatasetProjection(definition, 1).rows[0]!;
      store.seed(definition.id, row.objectId, row);
      const path = pathFromPrimaryRoleToSupervisor(definition);
      const supervisorStep = path[path.length - 1]!;
      const preparation = path.slice(0, -1);
      let version = 0;
      let state = definition.workflow.initialState;

      preparation.forEach(([commandName, command], index) => {
        expect(command.from).toContain(state);
        const role = command.roles[0]!;
        const current = store.dispatch({
          caseId: definition.id,
          objectId: row.objectId,
          command: commandName,
          actor: { id: `${definition.id}-${role}-${index}`, role },
          expectedVersion: version,
          idempotencyKey: `${definition.id}-prepare-${index}`,
          evidenceIds: ["dataset-row"],
        });
        expect(current.projection.state).toBe(command.to);
        version = current.projection.version;
        state = current.projection.state;
      });

      expect(supervisorStep[1].from).toContain(state);
      expect(supervisorStep[1].roles).toContain("supervisor");
      expect(supervisorStep[1].roles).not.toContain(definition.primaryRole);
      expect(() =>
        store.dispatch({
          caseId: definition.id,
          objectId: row.objectId,
          command: supervisorStep[0],
          actor: { id: "owner", role: definition.primaryRole },
          expectedVersion: version,
          idempotencyKey: `${definition.id}-wrong-role`,
          evidenceIds: ["dataset-row"],
        }),
      ).toThrow("role_forbidden");
      const completed = store.dispatch({
        caseId: definition.id,
        objectId: row.objectId,
        command: supervisorStep[0],
        actor: { id: "supervisor", role: "supervisor" },
        expectedVersion: version,
        idempotencyKey: `${definition.id}-supervisor`,
        evidenceIds: ["dataset-row"],
      });
      expect(completed.projection.version).toBe(version + 1);
      expect(completed.projection.state).toBe(supervisorStep[1].to);
      store.resetCase(definition.id, `RESET-${definition.id}`);
    },
  );

  it("preserves the specialized case 04, 07, 08 and 09 role contracts", () => {
    const byId = Object.fromEntries(CASES.map((item) => [item.id, item]));

    expect(byId["B004"]!.workflow.commands.record_material_return).toMatchObject({
      from: ["待补正"], to: "待补正", roles: ["reviewer"],
    });
    expect(byId["B004"]!.workflow.commands.start_human_review.roles).toEqual(["supervisor"]);

    expect(byId["B007"]!.workflow.commands.verify_evidence).toMatchObject({
      from: ["待评审", "待补观测"], roles: ["architect"],
    });
    expect(byId["B007"]!.workflow.commands.start_event_contract_pilot.roles).toEqual(["supervisor"]);

    expect(byId["B008"]!.workflow.commands.dispatch_field_check.roles).toEqual(["dispatcher"]);
    expect(byId["B008"]!.workflow.commands.submit_field_return.roles).toEqual(["field_operator"]);
    expect(byId["B008"]!.workflow.commands.confirm_event.roles).toEqual(["supervisor"]);

    expect(byId["B009"]!.workflow.commands.run_retrieval).toMatchObject({
      from: ["待核对", "等待设备记录"], roles: ["engineer"],
    });
    expect(byId["B009"]!.workflow.commands.hold_investigation.roles).toEqual(["engineer"]);
    expect(byId["B009"]!.workflow.commands.create_inspection_order.roles).toEqual(["supervisor"]);
  });

  it("case 01 stops at independent human review rather than approving a refund", () => {
    const definition = CASES.find((item) => item.id === "B001")!;
    const row = loadDatasetProjection(definition, 1).rows[0]!;
    store.seed(definition.id, row.objectId, row);
    const evidence = store.dispatch({
      caseId: definition.id,
      objectId: row.objectId,
      command: "create_evidence_request",
      actor: { id: "analyst", role: "analyst" },
      expectedVersion: 0,
      idempotencyKey: "01-evidence",
      evidenceIds: ["cancel-invoice"],
    });
    const review = store.dispatch({
      caseId: definition.id,
      objectId: row.objectId,
      command: "submit_manual_review",
      actor: { id: "analyst", role: "analyst" },
      expectedVersion: evidence.projection.version,
      idempotencyKey: "01-review",
      evidenceIds: ["cancel-invoice"],
    });

    expect(review.projection.state).toBe("人工复核待处理");
    expect(
      Object.values(definition.workflow.commands).map((command) => command.to),
    ).not.toContain("退款已放行");
    store.resetCase(definition.id, "RESET-B001");
  });
});
