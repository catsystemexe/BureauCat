import { prisma } from "@/lib/prisma";

export const documentAnnotationSelect = {
  id: true,
  document_id: true,
  selected_text: true,
  start_offset: true,
  end_offset: true,
  annotation_type: true,
  highlight_color: true,
  note_text: true,
  created_at: true,
  updated_at: true
};

export type CreateDocumentAnnotationInput = {
  selected_text: string;
  start_offset?: number | null;
  end_offset?: number | null;
  annotation_type?: "highlight" | "note" | "question" | "issue";
  highlight_color?: string | null;
  note_text?: string | null;
};

export function listDocumentAnnotations(documentId: string) {
  return prisma.documentAnnotation.findMany({
    where: { document_id: documentId },
    orderBy: { created_at: "desc" },
    select: documentAnnotationSelect
  });
}

export function createDocumentAnnotation(documentId: string, input: CreateDocumentAnnotationInput) {
  return prisma.documentAnnotation.create({
    data: {
      document_id: documentId,
      selected_text: input.selected_text,
      start_offset: input.start_offset ?? null,
      end_offset: input.end_offset ?? null,
      annotation_type: input.annotation_type ?? "note",
      highlight_color: input.highlight_color ?? null,
      note_text: input.note_text ?? null
    },
    select: documentAnnotationSelect
  });
}

export function deleteDocumentAnnotation(annotationId: string) {
  return prisma.documentAnnotation.delete({
    where: { id: annotationId },
    select: documentAnnotationSelect
  });
}


export async function eraseHighlightRange(documentId: string, startOffset: number, endOffset: number) {
  const overlapping = await prisma.documentAnnotation.findMany({
    where: {
      document_id: documentId,
      annotation_type: "highlight",
      start_offset: { lt: endOffset },
      end_offset: { gt: startOffset }
    },
    select: documentAnnotationSelect
  });

  await prisma.$transaction(async (transaction) => {
    for (const annotation of overlapping) {
      if (annotation.start_offset === null || annotation.end_offset === null) {
        await transaction.documentAnnotation.delete({ where: { id: annotation.id } });
        continue;
      }

      const originalStart = annotation.start_offset;
      const originalEnd = annotation.end_offset;
      const eraseStart = Math.max(startOffset, originalStart);
      const eraseEnd = Math.min(endOffset, originalEnd);

      await transaction.documentAnnotation.delete({ where: { id: annotation.id } });

      if (originalStart < eraseStart) {
        await transaction.documentAnnotation.create({
          data: {
            document_id: documentId,
            selected_text: annotation.selected_text.slice(0, eraseStart - originalStart),
            start_offset: originalStart,
            end_offset: eraseStart,
            annotation_type: "highlight",
            highlight_color: annotation.highlight_color,
            note_text: annotation.note_text
          }
        });
      }

      if (eraseEnd < originalEnd) {
        await transaction.documentAnnotation.create({
          data: {
            document_id: documentId,
            selected_text: annotation.selected_text.slice(eraseEnd - originalStart),
            start_offset: eraseEnd,
            end_offset: originalEnd,
            annotation_type: "highlight",
            highlight_color: annotation.highlight_color,
            note_text: annotation.note_text
          }
        });
      }
    }
  });

  return listDocumentAnnotations(documentId);
}


export async function deleteHighlightRangeHard(documentId: string, startOffset: number, endOffset: number) {
  await prisma.documentAnnotation.deleteMany({
    where: {
      document_id: documentId,
      annotation_type: "highlight",
      start_offset: { lt: endOffset },
      end_offset: { gt: startOffset }
    }
  });

  return listDocumentAnnotations(documentId);
}


export async function applyHighlightRange(
  documentId: string,
  selectedText: string,
  startOffset: number | null,
  endOffset: number | null,
  highlightColor: string
) {
  if (startOffset === null || endOffset === null) {
    return createDocumentAnnotation(documentId, {
      selected_text: selectedText,
      annotation_type: "highlight",
      highlight_color: highlightColor
    });
  }

  await eraseHighlightRange(documentId, startOffset, endOffset);

  return createDocumentAnnotation(documentId, {
    selected_text: selectedText,
    start_offset: startOffset,
    end_offset: endOffset,
    annotation_type: "highlight",
    highlight_color: highlightColor
  });
}


export function updateDocumentAnnotationNote(annotationId: string, noteText: string, highlightColor?: string) {
  return prisma.documentAnnotation.update({
    where: { id: annotationId },
    data: {
      note_text: noteText,
      ...(highlightColor ? { highlight_color: highlightColor } : {})
    },
    select: documentAnnotationSelect
  });
}
