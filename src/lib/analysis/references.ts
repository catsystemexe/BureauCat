import { resolveSourceRange } from "@/lib/journal/overview";

export type ReferenceInsight = {
  id: string; document_id: string; source_document_id: string | null; source_pin_id: string | null;
  title: string; source_text: string | null; source_start_offset: number | null; source_end_offset: number | null;
};
export type ReferencePin = {
  id: string; document_id: string; case_bookmark_number: number | null; color: string;
  selected_text: string; start_offset: number; end_offset: number;
};
export type ReferenceDocument = { id: string; text: string };
export type AnalysisReference = {
  insightId: string; insightTitle: string; analysisDocumentId: string; sourceDocumentId: string;
  pinId: string; number: number; color: string; startOffset: number; endOffset: number; quote: string;
};
export type ReferenceIssue = { insightId: string; pinId: string | null; code: string; message: string };
export type ReferenceResult = { references: AnalysisReference[]; issues: ReferenceIssue[] };

/** Pure validation of stored links, not a pin repair or numbering allocator. */
export function resolveAnalysisReferences(insights: ReferenceInsight[], pins: ReferencePin[], documents: ReferenceDocument[]): ReferenceResult {
  const pinById = new Map(pins.map((pin) => [pin.id, pin]));
  const textById = new Map(documents.map((doc) => [doc.id, doc.text]));
  const numbers = new Map<number, Set<string>>();
  for (const pin of pins) if (pin.case_bookmark_number !== null) {
    const ids = numbers.get(pin.case_bookmark_number) ?? new Set<string>();
    ids.add(pin.id); numbers.set(pin.case_bookmark_number, ids);
  }
  const references: AnalysisReference[] = [], issues: ReferenceIssue[] = [];
  for (const insight of insights) {
    const issue = (code: string, message: string) => issues.push({ insightId: insight.id, pinId: insight.source_pin_id, code, message });
    const pin = insight.source_pin_id ? pinById.get(insight.source_pin_id) : undefined;
    if (!pin) { issue("missing-pin", "Poznatek nemá dostupný připojený pin."); continue; }
    if (!insight.source_document_id || pin.document_id !== insight.source_document_id) {
      issue("document-mismatch", "Pin a poznatek odkazují na různé dokumenty."); continue;
    }
    const text = textById.get(insight.source_document_id);
    if (text === undefined) { issue("missing-document", "Zdrojový dokument není dostupný v tomto případu."); continue; }
    const number = pin.case_bookmark_number;
    if (number === null || !Number.isSafeInteger(number) || number <= 0) {
      issue("missing-number", "Připojený pin nemá platné uložené číslo."); continue;
    }
    if (numbers.get(number)!.size > 1) { issue("duplicate-number", "Stejné číslo je uložené u více různých pinů."); continue; }
    const quote = insight.source_text?.trim() ? insight.source_text : pin.selected_text;
    if (!quote.trim() || !pin.selected_text.trim()) { issue("missing-quote", "Chybí citace potřebná k ověření pasáže."); continue; }
    const range = resolveSourceRange(text, { startOffset: insight.source_start_offset, endOffset: insight.source_end_offset, quote });
    const pinRange = resolveSourceRange(text, { startOffset: pin.start_offset, endOffset: pin.end_offset, quote: pin.selected_text });
    if (!range || !pinRange) { issue("unresolved-range", "Uloženou pasáž nelze jednoznačně ověřit."); continue; }
    if (range.start !== pinRange.start || range.end !== pinRange.end) {
      issue("passage-mismatch", "Poznatek a jeho pin označují různé pasáže."); continue;
    }
    references.push({ insightId: insight.id, insightTitle: insight.title, analysisDocumentId: insight.document_id,
      sourceDocumentId: insight.source_document_id, pinId: pin.id, number, color: pin.color,
      startOffset: range.start, endOffset: range.end, quote });
  }
  return { references, issues };
}

export function groupAnalysisReferences(references: AnalysisReference[]) {
  const groups = new Map<string, { pinId: string; number: number; color: string; startOffset: number; references: AnalysisReference[] }>();
  for (const reference of references) {
    const group = groups.get(reference.pinId) ?? { pinId: reference.pinId, number: reference.number, color: reference.color,
      startOffset: reference.startOffset, references: [] };
    group.references.push(reference); groups.set(reference.pinId, group);
  }
  return [...groups.values()].sort((a, b) => a.startOffset - b.startOffset || a.number - b.number || a.pinId.localeCompare(b.pinId));
}

export function analysisReferenceColor(color: string) {
  return ({ red: "#dc2626", orange: "#ea580c", yellow: "#a16207", green: "#15803d", blue: "#2563eb", purple: "#7c3aed", gray: "#4b5563" } as Record<string, string>)[color] ?? "#2563eb";
}
