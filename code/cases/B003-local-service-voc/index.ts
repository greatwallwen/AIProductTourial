import { getCaseDefinition } from "../registry";

export const definition = getCaseDefinition("B003")!;
export const workflow = definition.workflow;
export const datasetFolder = definition.datasetFolder;
