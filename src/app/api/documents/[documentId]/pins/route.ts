import { NextResponse } from "next/server";
import { getDocumentById } from "@/lib/services/documents";
import { createDocumentPin, listDocumentPins } from "@/lib/services/documentPins";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ documentId: string }>;
};

const allowedPinColors = ["red", "orange", "green", "yellow", "blue"] as const;

export async function GET(_request: Request, context: Context) {
  const { documentId } = await context.params;
  const document = await getDocumentById(documentId);

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const pins = await listDocumentPins(documentId);
  return NextResponse.json({ pins });
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
    color?: unknown;
    note_text?: unknown;
  } | null;

  if (
    !body ||
    typeof body.selected_text !== "string" ||
    typeof body.start_offset !== "number" ||
    typeof body.end_offset !== "number"
  ) {
    return NextResponse.json({ error: "Invalid pin payload." }, { status: 400 });
  }

  const color =
    typeof body.color === "string" && allowedPinColors.includes(body.color as typeof allowedPinColors[number])
      ? body.color
      : "red";

  const pin = await createDocumentPin(documentId, {
    selected_text: body.selected_text,
    start_offset: body.start_offset,
    end_offset: body.end_offset,
    color,
    note_text: typeof body.note_text === "string" ? body.note_text : null
  });

  const pins = await listDocumentPins(documentId);
  return NextResponse.json({ pin, pins }, { status: 201 });
}
