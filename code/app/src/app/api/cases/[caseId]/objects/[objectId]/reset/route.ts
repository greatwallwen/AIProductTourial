import { NextResponse } from "next/server";
import { getCaseDefinition } from "@cases/registry";
import {
  ensureCaseObject,
  ensureCaseSeeded,
  getCaseStore,
} from "@cases/runtime.server";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string; objectId: string }> },
) {
  const { caseId, objectId } = await context.params;
  const definition = getCaseDefinition(caseId);
  if (!definition) {
    return NextResponse.json({ error: "case_not_found" }, { status: 404 });
  }
  if (objectId !== definition.featuredObjectId) {
    return NextResponse.json({ error: "tour_object_required" }, { status: 422 });
  }
  let body: { confirmation?: string } = {};
  try {
    body = (await request.json()) as { confirmation?: string };
  } catch {
    // Missing confirmation is rejected by the store below.
  }
  try {
    ensureCaseSeeded(definition);
    ensureCaseObject(definition, objectId);
    const receipt = getCaseStore(definition).resetObject(
      definition.id,
      objectId,
      body.confirmation ?? "",
    );
    const projection = ensureCaseObject(definition, objectId);
    return NextResponse.json({ receipt, projection, events: [], commandReceipt: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "reset_failed";
    const status = message === "object_not_found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
