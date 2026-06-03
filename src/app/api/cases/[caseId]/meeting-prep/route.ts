import { NextResponse } from "next/server";
import { generateMeetingPrep } from "@/lib/services/meetingPrep";

type CaseMeetingPrepRouteContext = {
  params: Promise<{ caseId: string }>;
};

export async function POST(_request: Request, context: CaseMeetingPrepRouteContext) {
  const { caseId } = await context.params;
  const result = await generateMeetingPrep(caseId);

  if (!result.ok) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  return NextResponse.json(result.data);
}
