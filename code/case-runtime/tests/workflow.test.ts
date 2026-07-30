import { describe, expect, it } from "vitest";
import { applyTransition } from "../src/workflow";

describe("workflow transition", () => {
  it("enforces source state and role", () => {
    const definition = {
      initialState: "待核验",
      commands: {
        approve: { from: ["待核验"], to: "已放行", roles: ["supervisor"] },
      },
    };
    expect(applyTransition(definition, "待核验", "approve", "supervisor")).toBe("已放行");
    expect(() => applyTransition(definition, "待核验", "approve", "analyst")).toThrow("role_forbidden");
    expect(() => applyTransition(definition, "已放行", "approve", "supervisor")).toThrow(
      "transition_forbidden",
    );
  });
});
