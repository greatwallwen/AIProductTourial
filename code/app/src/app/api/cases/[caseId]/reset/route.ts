import { NextResponse } from "next/server";
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
  let body: { confirmation?: string } = {};
  try {
    body = (await request.json()) as { confirmation?: string };
  } catch {
    // An empty or malformed body is handled as a missing confirmation below.
  }
  try {
    const receipt = getCaseStore(definition).resetCase(
      definition.id,
      body.confirmation ?? "",
    );
    const seeded = ensureCaseSeeded(definition);
    return NextResponse.json({ receipt, objects: seeded.objects });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "reset_failed" },
      { status: 400 },
    );
  }
}
