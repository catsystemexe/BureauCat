import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createCase, listCases } from "@/lib/services/cases";
import { createCaseSchema } from "@/lib/validation/cases";

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

export async function GET() {
  const cases = await listCases();

  return NextResponse.json({ cases });
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const result = createCaseSchema.safeParse(body);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  const createdCase = await createCase(result.data);

  return NextResponse.json({ case: createdCase }, { status: 201 });
}
