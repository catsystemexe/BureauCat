import { NextResponse } from "next/server";
import { getDocumentById } from "@/lib/services/documents";
import {
  applyHighlightRange,
  createDocumentAnnotation,
  deleteHighlightRangeHard,
  eraseHighlightRange,
  listDocumentAnnotations
} from "@/lib/services/documentAnnotations";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ documentId: string }>;
};

const allowedTypes = ["highlight", "note", "question", "issue"] as const;
const allowedHighlightColors = ["yellow", "green", "blue", "pink", "orange", "transparent"] as const;

export async function GET(_request: Request, context: Context) {
  const { documentId } = await context.params;
  const document = await getDocumentById(documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const annotations = await listDocumentAnnotations(documentId);
  return NextResponse.json({ annotations });
}

export async function POST(request: Request, context: Context) {
  const { documentId } = await context.params;
  const document = await getDocumentById(documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    selected_text?: unknown;
    start_offset?: unknown;
    end_offset?: unknown;
    annotation_type?: unknown;
    highlight_color?: unknown;
    note_text?: unknown;
    erase_all?: unknown;
  } | null;

  if (!body || typeof body.selected_text !== "string" || body.selected_text.trim().length === 0) {
    return NextResponse.json({ error: "Selected text is required." }, { status: 400 });
  }

  const annotationType =
    typeof body.annotation_type === "string" && allowedTypes.includes(body.annotation_type as typeof allowedTypes[number])
      ? body.annotation_type as typeof allowedTypes[number]
      : "note";

  const highlightColor =
    annotationType === "highlight" &&
    typeof body.highlight_color === "string" &&
    allowedHighlightColors.includes(body.highlight_color as typeof allowedHighlightColors[number])
      ? body.highlight_color
      : annotationType === "highlight"
        ? "yellow"
        : null;

  if (
    annotationType === "highlight" &&
    highlightColor === "transparent" &&
    typeof body.start_offset === "number" &&
    typeof body.end_offset === "number"
  ) {
    const annotations = await eraseHighlightRange(documentId, body.start_offset, body.end_offset);
    return NextResponse.json({ annotations }, { status: 200 });
  }

  if (
    annotationType === "highlight" &&
    highlightColor !== "transparent" &&
    typeof body.start_offset === "number" &&
    typeof body.end_offset === "number"
  ) {
    const annotation = await applyHighlightRange(
      documentId,
      body.selected_text.trim(),
      body.start_offset,
      body.end_offset,
      highlightColor ?? "yellow"
    );

    const annotations = await listDocumentAnnotations(documentId);
    return NextResponse.json({ annotation, annotations }, { status: 201 });
  }

  try {
    const annotation = await createDocumentAnnotation(documentId, {
      selected_text: body.selected_text.trim(),
      start_offset: typeof body.start_offset === "number" ? body.start_offset : null,
      end_offset: typeof body.end_offset === "number" ? body.end_offset : null,
      annotation_type: annotationType,
      highlight_color: highlightColor,
      note_text: typeof body.note_text === "string" && body.note_text.trim().length > 0 ? body.note_text.trim() : null
    });

    return NextResponse.json({ annotation }, { status: 201 });
  } catch (error) {
    console.error("DOCUMENT_ANNOTATION_CREATE_ERROR", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Annotation could not be created." },
      { status: 500 }
    );
  }
}
