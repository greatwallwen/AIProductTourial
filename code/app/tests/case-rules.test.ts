import { describe, expect, it } from "vitest";
import { loadDatasetProjection } from "../../cases/load-dataset";
import { CASES } from "../../cases/registry";

type ProductizedCase = (typeof CASES)[number] & {
  workspace: {
    queueEyebrow: string;
    queueTitle: string;
    decisionTitle: string;
    processSteps: Array<{ label: string; states: string[] }>;
  };
};

describe("case productization contract", () => {
  it.each(CASES.map((definition) => [definition.id, definition] as const))(
    "case %s derives metrics and an executable decision for every projected object",
    (_id, rawDefinition) => {
      const definition = rawDefinition as ProductizedCase;
      const dataset = loadDatasetProjection(definition);

      expect(dataset.metrics).toHaveLength(3);
      expect(
        dataset.metrics.every(
          (metric) => metric.label && metric.value && metric.note,
        ),
      ).toBe(true);

      const decisions = dataset.rows.map((row) => row.decision);
      expect(decisions.length).toBeGreaterThan(0);
      expect(
        decisions.every(
          (decision) =>
            decision.reason &&
            decision.recommendedCommand &&
            decision.sourceFields.length > 0 &&
            definition.workflow.commands[
              decision.recommendedCommand
            ]?.from.includes(definition.workflow.initialState),
        ),
      ).toBe(true);

      const availableFields = new Set(Object.keys(dataset.rows[0] ?? {}));
      for (const field of [
        ...definition.identityFields,
        ...definition.displayFields
          .filter((item) => item.key !== "state")
          .map((item) => item.key),
      ]) {
        expect(availableFields.has(field), `${definition.id}:${field}`).toBe(true);
      }

      expect(definition.workspace.queueEyebrow).not.toBe("");
      expect(definition.workspace.queueTitle).not.toBe("");
      expect(definition.workspace.decisionTitle).not.toBe("");
      const commands = Object.entries(definition.workflow.commands);
      expect(definition.workspace.processSteps).toHaveLength(commands.length);
      for (const step of definition.workspace.processSteps) {
        const matched = commands.find(
          ([commandName]) => definition.commandLabels[commandName] === step.label,
        );
        expect(matched, `${definition.id}:${step.label}`).toBeDefined();
        expect(step.states).toEqual([
          ...matched![1].from,
          matched![1].to,
        ]);
      }
    },
  );
});
