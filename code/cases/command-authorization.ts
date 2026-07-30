import type { CaseDefinition } from "./contracts";

export function authorizeCommandActor(
  definition: CaseDefinition,
  commandName: string,
  actorRole: string,
): "command_unknown" | "role_forbidden" | undefined {
  const command = definition.workflow.commands[commandName];
  if (!command) {
    return "command_unknown";
  }
  if (!command.roles.includes(actorRole)) {
    return "role_forbidden";
  }
  return undefined;
}
