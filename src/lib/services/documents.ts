import { prisma } from "@/lib/prisma";
import { extractDocumentText } from "@/lib/documents/extraction";
import { evidenceStateRecheckForCase } from "@/lib/services/evidenceStateService";
import { storeOriginalDocument } from "@/lib/documents/storage";
import type { ValidatedDocumentFile } from "@/lib/validation/documents";
import { convertDocumentWithMarkItDown } from "@/lib/documents/markitdown";


const documentSelect = {
  id: true,
  case_id: true,
  filename: true,
  display_name: true,
  filetype: true,
  original_file: true,
  document_type: true,
  analysis_type: true,
  parent_document_id: true,
  extracted_text: true,
  processed_text: true,
  validation_status: true,
  ai_summary: true,
  created_at: true,
  processed_markdown: true,
  processing_status: true,
  processing_error: true,
  markdown_version: true,
};

export async function createDocumentForCase(caseId: string, upload: ValidatedDocumentFile) {
  const storedFile = await storeOriginalDocument(upload.file, upload.originalFilename);
  const markitdownResult = await convertDocumentWithMarkItDown(storedFile.absolutePath);
  const extractionResult = await extractDocumentText(upload.file, upload.filetype);

  const normalizedMarkdown = markitdownResult.markdown?.trim() ? markitdownResult.markdown : null;
  const fallbackText = extractionResult.extracted_text;
  const processedText = normalizedMarkdown ?? fallbackText;

  const document = await prisma.document.create({
    data: {
      case_id: caseId,
      filename: upload.originalFilename,
      display_name: upload.originalFilename,
      filetype: upload.filetype,
      original_file: storedFile.relativePath,
      extracted_text: fallbackText,
      processed_text: processedText,
      processed_markdown: normalizedMarkdown,
      processing_status: normalizedMarkdown ? "processed" : "fallback",
      processing_error: markitdownResult.ok ? null : markitdownResult.error,
      markdown_version: 1,
      validation_status: "pending_validation",
      ai_summary: normalizedMarkdown
        ? "Dokument byl normalizován pomocí MarkItDown."
        : extractionResult.ai_summary
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


export function updateDocumentValidationStatus(id: string, validationStatus: "pending_validation" | "validated") {
  return prisma.document.update({
    where: { id },
    data: { validation_status: validationStatus },
    select: documentSelect
  });
}

export function updateDocumentDisplayName(id: string, displayName: string) {
  return prisma.document.update({
    where: { id },
    data: { display_name: displayName },
    select: documentSelect
  });
}

export function updateDocumentProcessedText(id: string, processedText: string) {
  return prisma.document.update({
    where: { id },
    data: {
      processed_text: processedText,
      processed_markdown: processedText,
      validation_status: "pending_validation"
    },
    select: documentSelect
  });
}

export async function deleteDocumentById(id: string) {
  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, original_file: true }
  });

  if (!document) {
    return null;
  }

  await prisma.document.delete({
    where: { id }
  });

  return document;
}


function getDocumentTitle(document: { filename: string; display_name: string | null }) {
  return document.display_name?.trim() || document.filename;
}

function clampRange(text: string, start: number, end: number) {
  const safeStart = Math.max(0, Math.min(start, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end, text.length));
  return { start: safeStart, end: safeEnd, sourceText: text.slice(safeStart, safeEnd) };
}

export async function createMockAnalysisDocument(sourceDocumentId: string) {
  const sourceDocument = await prisma.document.findUnique({
    where: { id: sourceDocumentId },
    select: documentSelect
  });

  if (!sourceDocument) {
    return null;
  }

  const existingAnalysis = await prisma.document.findFirst({
    where: {
      parent_document_id: sourceDocument.id,
      document_type: "analysis"
    },
    orderBy: {
      created_at: "desc"
    },
    select: documentSelect
  });

  if (existingAnalysis) {
    return existingAnalysis;
  }

  const sourceText =
    sourceDocument.processed_markdown ??
    sourceDocument.processed_text ??
    sourceDocument.extracted_text ??
    "";

  const sourceTitle = getDocumentTitle(sourceDocument);
  const analysisTitle = `Analýza: ${sourceTitle}`;

  const ranges = [
    clampRange(sourceText, 0, Math.min(160, sourceText.length)),
    clampRange(sourceText, Math.min(160, sourceText.length), Math.min(340, sourceText.length)),
    clampRange(sourceText, Math.min(340, sourceText.length), Math.min(520, sourceText.length))
  ].filter((range) => range.end > range.start);

  const factLine = "- Testovací skutečnost navázaná na začátek dokumentu.";
  const riskLine = "- Testovací riziko pro ověření AI evidence vrstvy.";
  const questionLine = "- Jaké informace v dokumentu chybí?";

  const markdown = `# ${analysisTitle}

## 1. Identifikace dokumentu

Mock analýza vytvořená nad dokumentem: **${sourceTitle}**.

## 2. Klíčové osoby a instituce

Zatím mock položka. Skutečná AI extrakce bude doplněna později.

## 3. Stručné shrnutí

Toto je testovací analýza pro ověření workflow: vytvoření meta dokumentu, otevření floating panelu a vytvoření insightů navázaných na range v původním dokumentu.

## 4. Klíčové skutečnosti

${factLine}
- Testovací tvrzení navázané na další část dokumentu.

## 5. Paragrafy a právní odkazy

- Zatím bez skutečné právní extrakce.

## 6. Rizika a důležité termíny

${riskLine}

## 7. Otázky

${questionLine}
- Jaká lhůta nebo povinnost z dokumentu plyne?
`;

  function findAnalysisRange(needle: string) {
    const start = markdown.indexOf(needle);

    if (start < 0) {
      return null;
    }

    return {
      start,
      end: start + needle.length
    };
  }

  return prisma.$transaction(async (transaction) => {
    const analysisDocument = await transaction.document.create({
      data: {
        case_id: sourceDocument.case_id,
        filename: analysisTitle,
        display_name: analysisTitle,
        filetype: "md",
        original_file: sourceDocument.original_file,
        document_type: "analysis",
        analysis_type: "document_analysis_mock_v1",
        parent_document_id: sourceDocument.id,
        extracted_text: markdown,
        processed_text: markdown,
        processed_markdown: markdown,
        processing_status: "processed",
        processing_error: null,
        markdown_version: 1,
        validation_status: "pending_validation",
        ai_summary: "Mock analýza dokumentu."
      },
      select: documentSelect
    });

    const insightSeeds = [
      {
        insight_type: "fact",
        target_section: "description",
        target_item_type: "FACT",
        title: "Testovací klíčová skutečnost",
        content: "Mock poznatek vytvořený z analyzovaného dokumentu.",
        range: ranges[0],
        analysisRange: findAnalysisRange(factLine)
      },
      {
        insight_type: "risk",
        target_section: "risks",
        target_item_type: "RISK",
        title: "Testovací riziko",
        content: "Mock riziko vytvořené pro ověření workflow.",
        range: ranges[1] ?? ranges[0],
        analysisRange: findAnalysisRange(riskLine)
      },
      {
        insight_type: "question",
        target_section: "open_questions",
        target_item_type: "QUESTION",
        title: "Testovací otázka",
        content: "Mock otázka vytvořená pro pozdější zápis do zápisníku.",
        range: ranges[2] ?? ranges[0],
        analysisRange: findAnalysisRange(questionLine)
      }
    ].filter((seed) => seed.range);

    for (const seed of insightSeeds) {
      await transaction.documentInsight.create({
        data: {
          document_id: analysisDocument.id,
          source_document_id: sourceDocument.id,
          insight_type: seed.insight_type,
          target_section: seed.target_section,
          target_item_type: seed.target_item_type,
          title: seed.title,
          content: seed.content,
          evidence_state: "inferred",
          status: "pending",
          source_text: seed.range.sourceText,
          source_start_offset: seed.range.start,
          source_end_offset: seed.range.end,
          analysis_start_offset: seed.analysisRange?.start ?? null,
          analysis_end_offset: seed.analysisRange?.end ?? null
        }
      });
    }

    return analysisDocument;
  });
}
