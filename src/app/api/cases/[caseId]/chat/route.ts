import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { sendChatMessage } from "@/lib/services/chat";
import { createChatMessageSchema } from "@/lib/validation/chat";

type CaseChatRouteContext = {
  params: Promise<{ caseId: string }>;
};

function validationErrorResponse(error: ZodError) {
  return NextResponse.json(
    { error: "Invalid request body.", issues: error.issues },
    { status: 400 }
  );
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function POST(request: Request, context: CaseChatRouteContext) {
  const { caseId } = await context.params;
  const body = await readJson(request);
  const result = createChatMessageSchema.safeParse(body);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  const serviceResult = await sendChatMessage(caseId, result.data);

  if (!serviceResult.ok) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  return NextResponse.json(serviceResult.data, { status: 201 });
}
