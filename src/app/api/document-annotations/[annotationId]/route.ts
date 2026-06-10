import { NextResponse } from "next/server";
import {
  deleteDocumentAnnotation,
  updateDocumentAnnotationNote
} from "@/lib/services/documentAnnotations";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ annotationId: string }>;
};

const allowedHighlightColors = ["yellow", "green", "blue", "pink", "orange", "transparent"] as const;

export async function PATCH(request: Request, context: Context) {
  const { annotationId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    note_text?: unknown;
    highlight_color?: unknown;
  } | null;

  const highlightColor =
    typeof body?.highlight_color === "string" &&
    allowedHighlightColors.includes(body.highlight_color as typeof allowedHighlightColors[number])
      ? body.highlight_color
      : undefined;

  try {
    const annotation = await updateDocumentAnnotationNote(
      annotationId,
      typeof body?.note_text === "string" ? body.note_text : "",
      highlightColor
    );

    return NextResponse.json({ annotation });
  } catch {
    return NextResponse.json({ error: "Annotation not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { annotationId } = await context.params;

  try {
    const annotation = await deleteDocumentAnnotation(annotationId);
    return NextResponse.json({ deleted: true, annotation });
  } catch {
    return NextResponse.json({ error: "Annotation not found." }, { status: 404 });
  }
}
