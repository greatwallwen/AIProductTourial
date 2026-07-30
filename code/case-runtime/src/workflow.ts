import type { WorkflowDefinition } from "./contracts";

export function applyTransition(
  definition: WorkflowDefinition,
  currentState: string,
  commandName: string,
  actorRole: string,
): string {
  const command = definition.commands[commandName];
  if (!command) {
    throw new Error("command_unknown");
  }
  if (!command.roles.includes(actorRole)) {
    throw new Error("role_forbidden");
  }
  if (!command.from.includes(currentState)) {
    throw new Error("transition_forbidden");
  }
  return command.to;
}
