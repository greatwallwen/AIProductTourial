import { NextResponse } from "next/server";
import { createAssistProvider } from "@course-ai-product/case-runtime";
import { getCaseDefinition } from "@cases/registry";
import { ensureCaseSeeded, getCaseStore } from "@cases/runtime.server";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const definition = getCaseDefinition(caseId);
  if (!definition) {
    return NextResponse.json({ error: "case_not_found" }, { status: 404 });
  }
  if (!definition.aiEnabled) {
    return NextResponse.json({ error: "case_live_mode_disabled" }, { status: 422 });
  }
  const body = (await request.json()) as {
    objectId?: string;
    mode?: "offline" | "live";
    question?: string;
  };
  ensureCaseSeeded(definition);
  if (!body.objectId || !body.mode || !body.question) {
    return NextResponse.json({ error: "invalid_assist_request" }, { status: 400 });
  }
  try {
    const projection = getCaseStore(definition).project(definition.id, body.objectId);
    const receipt = await createAssistProvider().assist({
      caseId: definition.id,
      objectId: projection.objectId,
      question: body.question,
      facts: {
        state: projection.state,
        version: projection.version,
        ...Object.fromEntries(Object.entries(projection.payload).slice(0, 8)),
      },
      mode: body.mode,
    });
    return NextResponse.json(receipt);
  } catch (error) {
    const message = error instanceof Error ? error.message : "assist_failed";
    return NextResponse.json(
      { error: message },
      { status: message === "missing_api_key" ? 503 : 500 },
    );
  }
}
