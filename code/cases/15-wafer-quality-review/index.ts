import { getCaseDefinition } from "../registry";

export const definition = getCaseDefinition("15")!;
export const workflow = definition.workflow;
export const datasetFolder = definition.datasetFolder;
