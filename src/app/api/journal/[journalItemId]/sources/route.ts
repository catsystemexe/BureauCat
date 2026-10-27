import { NextResponse } from "next/server";
import { z } from "zod";
import { appendJournalBookmark, JournalSourceLinkError } from "@/lib/services/journal";

export async function POST(request: Request, context: { params: Promise<{ journalItemId: string }> }) {
  const body = z.object({ pin_id: z.string().min(1) }).strict().safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid bookmark." }, { status: 400 });
  const { journalItemId } = await context.params;
  try { return NextResponse.json({ journalItem: await appendJournalBookmark(journalItemId, body.data.pin_id) }); }
  catch (error) {
    if (error instanceof JournalSourceLinkError) return NextResponse.json({ error: error.code }, { status: error.code === "NOT_FOUND" ? 404 : 409 });
    throw error;
  }
}
