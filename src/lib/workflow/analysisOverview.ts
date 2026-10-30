import type { JournalSource } from "@/lib/journal/overview";
import { getSourceLinkDocumentId } from "@/lib/documents/sourceLinks";
import type { PlanningEvidence, PlanningState } from "./planning";

type Criterion = PlanningState["inputs"][number]["criteria"][number];
export type QuestionSource = { key: string; label: string; quote: string; documentId: string | null; passage: JournalSource | null };
export type AnalysisQuestion = { key: string; title: string; value: string; conflict: boolean; sources: QuestionSource[] };
export function evidenceSource(e: PlanningEvidence): QuestionSource {
  return { key: `insight:${e.id}`, label: e.documentName, quote: e.quote, documentId: e.documentId,
    passage: e.usable ? { documentId: e.documentId, documentName: e.documentName, insightId: e.id,
      pinId: e.pinId, quote: e.quote, startOffset: e.startOffset, endOffset: e.endOffset } : null };
}
const uniqueSources = (sources: QuestionSource[]) => [...new Map(sources.map((source) => [source.key, source])).values()];
/** Pure presentation only. No lexical inference of absence, relevance or sufficiency. */
export function analysisOverview(state: PlanningState) {
  const questions = new Map<string, AnalysisQuestion>();
  const add = (title: string, value: string, type: string, evidenceState: string, identity: string, sources: QuestionSource[]) => {
    const conflict = type.toLowerCase() === "conflict" || evidenceState === "conflict";
    // Full exact content and meaning only. Similar titles and different values stay separate.
    const key = JSON.stringify([title, value, conflict, evidenceState, title || value ? null : identity]);
    const previous = questions.get(key);
    questions.set(key, { key, title, value, conflict, sources: uniqueSources([...(previous?.sources ?? []), ...sources]) });
  };
  for (const e of state.evidence) if (["question", "conflict"].includes(e.type) || e.evidenceState === "conflict") {
    add(e.title, e.value, e.type, e.evidenceState, e.id, [evidenceSource(e)]);
  }
  for (const item of state.preliminary ?? []) if (item.type === "QUESTION" || item.evidenceState === "conflict") {
    const related = state.evidence.filter((e) => e.journalItemId === item.id || item.sourceLinks?.some((link) => link.insightId === e.id));
    const links: QuestionSource[] = (item.sourceLinks ?? []).flatMap((link) => {
      const insight = typeof link.insightId === "string" ? state.evidence.find((e) => e.id === link.insightId) : undefined;
      const documentId = getSourceLinkDocumentId(link) ?? insight?.documentId;
      const doc = state.documents?.find((d) => d.id === documentId);
      const quote = typeof link.sourceText === "string" ? link.sourceText : insight?.quote ?? "";
      if (insight && documentId === insight.documentId && quote === insight.quote) return [evidenceSource(insight)];
      const pinId = typeof link.pinId === "string" ? link.pinId : null;
      return [{ key: JSON.stringify([documentId, link.insightId, pinId, quote]), label: doc?.name ?? "Zdroj již není v aktuální situaci", quote,
        documentId: doc?.id ?? null, passage: doc && quote && (!link.insightId || insight?.documentId === doc.id) ? { documentId: doc.id, documentName: doc.name,
          insightId: typeof link.insightId === "string" ? link.insightId : null, pinId, quote, startOffset: null, endOffset: null } : null }];
    });
    add(item.title, item.value, item.type, item.evidenceState, item.id, [...related.map(evidenceSource), ...links]);
  }
  const preliminary = [...questions.values()];
  const criteria = state.plan?.status === "ACCEPTED" ? state.inputs.flatMap((input) => input.criteria) : [];
  // A shared source or similar title is not identity of a requirement. Only a
  // complete exact statement can be covered here; conflicting values stay visible.
  const sameStatement = (q: AnalysisQuestion, c: Criterion) => !q.conflict && Boolean(c.requirement_text) &&
    [...new Set([q.title, q.value].filter(Boolean))].length === 1 && (q.title || q.value) === c.requirement_text;
  const matchedCriterion = (q: AnalysisQuestion) => {
    const matches = criteria.filter((c) => sameStatement(q, c));
    return matches.length === 1 ? matches[0].id : null;
  };
  const criterionSources = criteria.map((criterion) => ({
    criterion, sources: uniqueSources([...criterion.sources.map(evidenceSource),
      ...preliminary.filter((q) => matchedCriterion(q) === criterion.id).flatMap((q) => q.sources)])
  }));
  return { criterionSources, openCriteria: criterionSources.filter(({ criterion }) => criterion.status !== "SATISFIED"), questions: preliminary.filter((q) => matchedCriterion(q) === null) };
}
