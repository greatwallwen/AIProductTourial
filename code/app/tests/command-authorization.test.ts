import { describe, expect, it } from "vitest";
import { authorizeCommandActor } from "../../cases/command-authorization";
import { getCaseDefinition } from "../../cases/registry";

describe("command actor authorization", () => {
  const definition = getCaseDefinition("04")!;

  it("allows the case role to request material", () => {
    expect(
      authorizeCommandActor(definition, "request_material", "reviewer"),
    ).toBeUndefined();
  });

  it("requires the supervisor role for the human-review transition", () => {
    expect(
      authorizeCommandActor(definition, "start_human_review", "reviewer"),
    ).toBe("role_forbidden");
    expect(
      authorizeCommandActor(definition, "start_human_review", "supervisor"),
    ).toBeUndefined();
  });

  it("rejects an unknown command before dispatch", () => {
    expect(
      authorizeCommandActor(definition, "approve_application", "supervisor"),
    ).toBe("command_unknown");
  });
});
