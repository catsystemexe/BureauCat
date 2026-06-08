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
  processed_text: true,
  validation_status: true,
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
      processed_text: extracted_text,
      validation_status: "pending_validation",
      ai_summary
    },
    select: documentSelect
  });

  await evidenceStateRecheckForCase(caseId);

  return document;
}

export function listDocumentsForCase(caseId: string) {
  return prisma.document.findMany({
    where: { case_id: caseId },
    orderBy: { created_at: "desc" },
    select: documentSelect
  });
}

export function getDocumentById(id: string) {
  return prisma.document.findUnique({
    where: { id },
    select: documentSelect
  });
}

const situationDocumentLinkSelect = {
  id: true,
  situation_id: true,
  document_id: true,
  created_at: true
};

export class SituationDocumentLinkError extends Error {
  constructor(
    public readonly code: "SITUATION_NOT_FOUND" | "DOCUMENT_NOT_FOUND" | "CASE_MISMATCH"
  ) {
    super(code);
    this.name = "SituationDocumentLinkError";
  }
}

export function listDocumentsForSituation(situationId: string) {
  return prisma.document.findMany({
    where: {
      situation_documents: {
        some: { situation_id: situationId }
      }
    },
    orderBy: { created_at: "desc" },
    select: documentSelect
  });
}

export function linkDocumentToSituation(situationId: string, documentId: string) {
  return prisma.$transaction(async (transaction) => {
    const [situation, document] = await Promise.all([
      transaction.situation.findUnique({
        where: { id: situationId },
        select: { case_id: true }
      }),
      transaction.document.findUnique({
        where: { id: documentId },
        select: documentSelect
      })
    ]);

    if (!situation) {
      throw new SituationDocumentLinkError("SITUATION_NOT_FOUND");
    }

    if (!document) {
      throw new SituationDocumentLinkError("DOCUMENT_NOT_FOUND");
    }

    if (document.case_id !== situation.case_id) {
      throw new SituationDocumentLinkError("CASE_MISMATCH");
    }

    const link = await transaction.situationDocument.upsert({
      where: {
        situation_id_document_id: {
          situation_id: situationId,
          document_id: documentId
        }
      },
      create: {
        situation_id: situationId,
        document_id: documentId
      },
      update: {},
      select: situationDocumentLinkSelect
    });

    return { link, document };
  });
}

export async function unlinkDocumentFromSituation(situationId: string, documentId: string) {
  await prisma.situationDocument.deleteMany({
    where: {
      situation_id: situationId,
      document_id: documentId
    }
  });
}
