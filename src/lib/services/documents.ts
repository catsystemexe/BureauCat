import { prisma } from "@/lib/prisma";
import { extractDocumentText } from "@/lib/documents/extraction";
import { evidenceStateRecheckForCase } from "@/lib/services/evidenceStateService";
import { storeOriginalDocument } from "@/lib/documents/storage";
import type { ValidatedDocumentFile } from "@/lib/validation/documents";

const documentSelect = {
  id: true,
  case_id: true,
  filename: true,
  filetype: true,
  original_file: true,
  extracted_text: true,
  ai_summary: true,
  created_at: true
};

export async function createDocumentForCase(caseId: string, upload: ValidatedDocumentFile) {
  const [{ extracted_text, ai_summary }, storedFile] = await Promise.all([
    extractDocumentText(upload.file, upload.filetype),
    storeOriginalDocument(upload.file, upload.originalFilename)
  ]);

  const document = await prisma.document.create({
    data: {
      case_id: caseId,
      filename: upload.originalFilename,
      filetype: upload.filetype,
      original_file: storedFile.relativePath,
      extracted_text,
      ai_summary
    },
    select: documentSelect
  });

  await evidenceStateRecheckForCase(caseId);

  return document;
}

export function getDocumentById(id: string) {
  return prisma.document.findUnique({
    where: { id },
    select: documentSelect
  });
}
