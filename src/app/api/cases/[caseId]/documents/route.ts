import { NextResponse } from "next/server";
import { createDocumentForCase, listDocumentsForCase } from "@/lib/services/documents";
import { getCaseById } from "@/lib/services/cases";
import { DocumentValidationError, validateDocumentUploadFile } from "@/lib/validation/documents";

export const runtime = "nodejs";

type CaseDocumentsRouteContext = {
  params: Promise<{ caseId: string }>;
};

export async function GET(_request: Request, context: CaseDocumentsRouteContext) {
  const { caseId } = await context.params;
  const foundCase = await getCaseById(caseId);

  if (!foundCase) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  const documents = await listDocumentsForCase(caseId);

  return NextResponse.json({ documents });
}

export async function POST(request: Request, context: CaseDocumentsRouteContext) {
  const { caseId } = await context.params;
  const foundCase = await getCaseById(caseId);

  if (!foundCase) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const upload = validateDocumentUploadFile(formData.get("file"));
    const document = await createDocumentForCase(caseId, upload);

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
