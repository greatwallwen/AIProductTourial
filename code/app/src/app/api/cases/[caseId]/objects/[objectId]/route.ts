import { NextResponse } from "next/server";
import { getCaseDefinition } from "@cases/registry";
import {
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
  try {
    const projection = ensureCaseObject(definition, objectId);
    return NextResponse.json({
      projection,
      events: eventsFor(definition, objectId),
      receipt: receiptFor(definition, objectId) ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "object_not_found";
    return NextResponse.json(
      { error: message },
      { status: message === "object_not_found" ? 404 : 500 },
    );
  }
}
