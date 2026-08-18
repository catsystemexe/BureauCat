import { NextResponse } from "next/server";
import { renderCaseAuditMarkdown } from "@/lib/services/caseAuditRenderer";
import { buildCaseContext } from "@/lib/services/caseContext";

export const runtime = "nodejs";

type CaseContextAuditRouteContext = {
  params: Promise<{ caseId: string }>;
};

export async function GET(request: Request, context: CaseContextAuditRouteContext) {
  const { caseId } = await context.params;
  const situationId = new URL(request.url).searchParams.get("situationId");

  const caseContext = await buildCaseContext(caseId, situationId);

  if (!caseContext) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  if ("error" in caseContext && caseContext.error === "SITUATION_NOT_FOUND") {
    return NextResponse.json({ error: "Situation not found." }, { status: 404 });
  }

  return NextResponse.json({
    markdown: renderCaseAuditMarkdown(caseContext)
  });
}
