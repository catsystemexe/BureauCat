import { prisma } from "@/lib/prisma";

export const documentPinSelect = {
  id: true,
  document_id: true,
  selected_text: true,
  start_offset: true,
  end_offset: true,
  color: true,
  note_text: true,
  created_at: true,
  updated_at: true
};

export type CreateDocumentPinInput = {
  selected_text: string;
  start_offset: number;
  end_offset: number;
  color: string;
  note_text?: string | null;
};

export function listDocumentPins(documentId: string) {
  return prisma.documentPin.findMany({
    where: { document_id: documentId },
    orderBy: { start_offset: "asc" },
    select: documentPinSelect
  });
}

export function createDocumentPin(documentId: string, input: CreateDocumentPinInput) {
  return prisma.documentPin.create({
    data: {
      document_id: documentId,
      selected_text: input.selected_text,
      start_offset: input.start_offset,
      end_offset: input.end_offset,
      color: input.color,
      note_text: input.note_text ?? null
    },
    select: documentPinSelect
  });
}

export function updateDocumentPin(
  pinId: string,
  input: {
    color?: string;
    note_text?: string | null;
    visual_offset?: number | null;
  }
) {
  return prisma.documentPin.update({
    where: { id: pinId },
    data: {
      ...(input.color ? { color: input.color } : {}),
      ...(input.note_text !== undefined
        ? { note_text: input.note_text }
        : {}),
      ...(input.visual_offset !== undefined
        ? { visual_offset: input.visual_offset }
        : {})
    },
    select: documentPinSelect
  });
}

export function deleteDocumentPin(pinId: string) {
  return prisma.documentPin.delete({
    where: { id: pinId },
    select: documentPinSelect
  });
}
