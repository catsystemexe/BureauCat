import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { executePlanningCommand, getSituationPlanning, PlanningError } from "@/lib/services/situationPlanning";
import { planningCommandSchema } from "@/lib/workflow/planning";
export const runtime = "nodejs";
type Context = { params: Promise<{ situationId: string }> };
function errorResponse(error: unknown) {
  if (error instanceof PlanningError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: "Neplatná struktura požadavku nebo AI návrhu." }, { status: 400 });
  if (error && typeof error === "object" && "code" in error && ["P1008", "P2028", "P2034", "P2002"].includes(String(error.code))) {
    return NextResponse.json({ error: "Proběhla souběžná změna. Načtěte aktuální stav a opakujte akci." }, { status: 409 });
  }
  return NextResponse.json({ error: "Návrh se nepodařilo připravit. Ruční zadání je dostupné; načtěte stav před opakováním." }, { status: 503 });
}
export async function GET(request: Request, context: Context) {
  try {
    const { situationId } = await context.params;
    const caseId = new URL(request.url).searchParams.get("caseId");
    if (!caseId) throw new PlanningError("Chybí případ.", 400);
    return NextResponse.json({ planning: await getSituationPlanning(situationId, caseId) });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, context: Context) {
  try {
    const { situationId } = await context.params;
    const command = planningCommandSchema.parse(await request.json());
    return NextResponse.json({ planning: await executePlanningCommand(situationId, command) });
  } catch (error) { return errorResponse(error); }
}
