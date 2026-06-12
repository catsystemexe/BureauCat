import { NextResponse } from "next/server";
import { deleteDocumentPin, updateDocumentPin } from "@/lib/services/documentPins";
import { removeBookmarkLinksForPin } from "@/lib/services/journal";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ pinId: string }>;
};

const allowedPinColors = ["red", "orange", "green", "yellow", "blue"] as const;

export async function PATCH(request: Request, context: Context) {
  const { pinId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    color?: unknown;
    note_text?: unknown;
    visual_offset?: unknown;
  } | null;

  const color =
    typeof body?.color === "string" && allowedPinColors.includes(body.color as typeof allowedPinColors[number])
      ? body.color
      : undefined;

  try {
    const pin = await updateDocumentPin(pinId, {
    color,
    note_text: typeof body?.note_text === "string" ? body.note_text : undefined,
    visual_offset: typeof body?.visual_offset === "number" ? body.visual_offset : undefined
    });

    return NextResponse.json({ pin });
  } catch {
    return NextResponse.json({ error: "Pin not found." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { pinId } = await context.params;

  try {
    const pin = await deleteDocumentPin(pinId);
    const updatedJournalItems = await removeBookmarkLinksForPin(pinId);
    return NextResponse.json({ deleted: true, pin, updatedJournalItems });
  } catch {
    return NextResponse.json({ error: "Pin not found." }, { status: 404 });
  }
}
