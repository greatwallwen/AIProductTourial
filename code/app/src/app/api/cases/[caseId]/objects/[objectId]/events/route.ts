import { NextResponse } from "next/server";
import { getCaseDefinition } from "@cases/registry";
import {
  ensureCaseSeeded,
  ensureCaseObject,
  eventsFor,
  receiptFor,
} from "@cases/runtime.server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string; objectId: string }> },
) {
  const { caseId, objectId } = await context.params;
  const definition = getCaseDefinition(caseId);
  if (!definition) {
    return NextResponse.json({ error: "case_not_found" }, { status: 404 });
  }
  ensureCaseSeeded(definition);
  try {
    ensureCaseObject(definition, objectId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "object_not_found";
    return NextResponse.json(
      { error: message },
      { status: message === "object_not_found" ? 404 : 500 },
    );
  }
  return NextResponse.json({
    events: eventsFor(definition, objectId),
    receipt: receiptFor(definition, objectId) ?? null,
  });
}
