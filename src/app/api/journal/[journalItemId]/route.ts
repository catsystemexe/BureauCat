import { NextResponse } from "next/server";
import { ZodError } from "zod";
import {
  getJournalItemById,
  markJournalItemObsolete,
  updateJournalItem
} from "@/lib/services/journal";
import { updateJournalItemSchema } from "@/lib/validation/journal";

type JournalItemRouteContext = {
  params: Promise<{ journalItemId: string }>;
};

function validationErrorResponse(error: ZodError) {
  return NextResponse.json(
    { error: "Invalid request body.", issues: error.issues },
    { status: 400 }
  );
}

function notFoundResponse() {
  return NextResponse.json({ error: "Journal item not found." }, { status: 404 });
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function PATCH(request: Request, context: JournalItemRouteContext) {
  const { journalItemId } = await context.params;
  const body = await readJson(request);
  const result = updateJournalItemSchema.safeParse(body);

  if (!result.success) {
    return validationErrorResponse(result.error);
  }

  const existingJournalItem = await getJournalItemById(journalItemId);

  if (!existingJournalItem) {
    return notFoundResponse();
  }

  const journalItem = await updateJournalItem(journalItemId, result.data);

  return NextResponse.json({ journalItem });
}

export async function DELETE(_request: Request, context: JournalItemRouteContext) {
  const { journalItemId } = await context.params;
  const existingJournalItem = await getJournalItemById(journalItemId);

  if (!existingJournalItem) {
    return notFoundResponse();
  }

  const journalItem = await markJournalItemObsolete(journalItemId);

  return NextResponse.json({ journalItem });
}
