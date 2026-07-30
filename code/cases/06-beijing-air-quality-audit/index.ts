import { getCaseDefinition } from "../registry";

export const definition = getCaseDefinition("06")!;
export const workflow = definition.workflow;
export const datasetFolder = definition.datasetFolder;
