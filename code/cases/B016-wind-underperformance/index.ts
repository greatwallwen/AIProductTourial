import { getCaseDefinition } from "../registry";

export const definition = getCaseDefinition("B016")!;
export const workflow = definition.workflow;
export const datasetFolder = definition.datasetFolder;
