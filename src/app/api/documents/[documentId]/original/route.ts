import { createReadStream } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getDocumentById } from "@/lib/services/documents";

export const runtime = "nodejs";

type DocumentOriginalRouteContext = {
  params: Promise<{ documentId: string }>;
};

const contentTypes: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  rtf: "application/rtf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png"
};

export async function GET(_request: Request, context: DocumentOriginalRouteContext) {
  const { documentId } = await context.params;
  const document = await getDocumentById(documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const absolutePath = path.join(process.cwd(), document.original_file);
  const stream = createReadStream(absolutePath);

  return new Response(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": contentTypes[document.filetype] ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(document.filename)}"`
    }
  });
}
