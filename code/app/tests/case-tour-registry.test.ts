import { describe, expect, it } from "vitest";
import {
  getAllCaseTourDefinitions,
  getCaseTourDefinition,
  isTourGateSatisfied,
} from "../src/components/tours/case-tour-registry";
import { CASES } from "../../cases/registry";

describe("case task-tour registry", () => {
  it("defines one business-specific route for every case", () => {
    const tours = getAllCaseTourDefinitions();

    expect(tours).toHaveLength(20);
    expect(tours.map((tour) => tour.caseId)).toEqual(
      Array.from({ length: 20 }, (_, index) => `B${String(index + 1).padStart(3, "0")}`),
    );
    for (const tour of tours) {
      const definition = CASES.find((item) => item.id === tour.caseId);
      expect(definition).toBeDefined();
      expect(tour.featuredObjectId).toBe(definition?.featuredObjectId);
      expect(tour.steps.length).toBeGreaterThanOrEqual(6);
      expect(new Set(tour.steps.map((step) => step.id)).size).toBe(tour.steps.length);
      expect(tour.steps.every((step) => step.element.length > 0)).toBe(true);
      expect(tour.steps.some((step) => step.gate?.kind === "state")).toBe(true);
      expect(tour.steps.some((step) => step.gate?.kind === "role")).toBe(true);
      const workflowStates = new Set([
        definition!.workflow.initialState,
        ...Object.values(definition!.workflow.commands).flatMap((command) => [
          ...command.from,
          command.to,
        ]),
      ]);
      const workflowRoles = new Set(
        Object.values(definition!.workflow.commands).flatMap((command) => command.roles),
      );
      for (const step of tour.steps) {
        if (step.gate?.kind === "state") {
          expect(step.gate.anyOf.every((state) => workflowStates.has(state))).toBe(true);
        }
        if (step.gate?.kind === "role") {
          expect(workflowRoles.has(step.gate.equals)).toBe(true);
        }
        if (step.gate?.kind === "command") {
          expect(step.gate.anyOf.every((command) => command in definition!.workflow.commands)).toBe(true);
        }
      }
    }

    expect(getCaseTourDefinition("B018")).toMatchObject({
      featuredObjectId: "B018-BT-0044",
      title: "主汽低温事件核查",
    });
  });

  it("unlocks gated steps only after the required runtime fact changes", () => {
    expect(isTourGateSatisfied({ kind: "state", anyOf: ["当班排查中"] }, {
      state: "待定位",
      actorRole: "process_engineer",
    })).toBe(false);
    expect(isTourGateSatisfied({ kind: "state", anyOf: ["当班排查中"] }, {
      state: "当班排查中",
      actorRole: "process_engineer",
    })).toBe(true);
    expect(isTourGateSatisfied({ kind: "role", equals: "supervisor" }, {
      state: "当班排查中",
      actorRole: "process_engineer",
    })).toBe(false);
    expect(isTourGateSatisfied({ kind: "role", equals: "supervisor" }, {
      state: "当班排查中",
      actorRole: "supervisor",
    })).toBe(true);
    expect(isTourGateSatisfied({ kind: "command", anyOf: ["record_material_return"] }, {
      state: "待补正",
      actorRole: "reviewer",
      completedCommands: ["request_material"],
    })).toBe(false);
    expect(isTourGateSatisfied({ kind: "command", anyOf: ["record_material_return"] }, {
      state: "待补正",
      actorRole: "reviewer",
      completedCommands: ["request_material", "record_material_return"],
    })).toBe(true);
  });
});
