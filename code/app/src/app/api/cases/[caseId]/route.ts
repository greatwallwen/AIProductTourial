import { NextResponse } from "next/server";
import { getCaseDefinition } from "@cases/registry";
import { ensureCaseSeeded } from "@cases/runtime.server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  const definition = getCaseDefinition(caseId);
  if (!definition) {
    return NextResponse.json({ error: "case_not_found" }, { status: 404 });
  }
  return NextResponse.json(ensureCaseSeeded(definition));
}
