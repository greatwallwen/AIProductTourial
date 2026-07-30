import { getCaseDefinition } from "../registry";

export const definition = getCaseDefinition("B012")!;
export const workflow = definition.workflow;
export const datasetFolder = definition.datasetFolder;
