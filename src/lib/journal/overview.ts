import type { DocumentInsight, DocumentPin, JournalItem } from "@/components/types";
import { getSourceLinkDocumentId } from "@/lib/documents/sourceLinks";

export type JournalEvidence = {
  documents: { id: string; filename: string; display_name: string | null }[];
  insights: Pick<DocumentInsight, "id" | "document_id" | "source_document_id" | "source_pin_id" | "journal_item_id" | "title" | "content" | "source_text" | "source_start_offset" | "source_end_offset" | "insight_type">[];
  pins: Pick<DocumentPin, "id" | "document_id" | "selected_text" | "start_offset" | "end_offset">[];
};

export type JournalSource = {
  documentId: string;
  documentName: string;
  pinId: string | null;
  insightId: string | null;
  startOffset: number | null;
  endOffset: number | null;
  quote: string;
};
export type SourceTarget = Pick<JournalSource, "documentId" | "startOffset" | "endOffset" | "quote"> & { token: number };
export const EMPTY_EVIDENCE: JournalEvidence = { documents: [], insights: [], pins: [] };

export function resolveSourceRange(text: string, target: Pick<JournalSource, "startOffset" | "endOffset" | "quote">) {
  const quote = target.quote;
  const hasQuote = quote.trim().length > 0;
  if (target.startOffset !== null && target.endOffset !== null &&
      Number.isInteger(target.startOffset) && Number.isInteger(target.endOffset) &&
      target.startOffset >= 0 && target.endOffset > target.startOffset && target.endOffset <= text.length &&
      (!hasQuote || text.slice(target.startOffset, target.endOffset) === quote)) {
    return { start: target.startOffset, end: target.endOffset };
  }
  // A valid numeric range can still point at different text after an edit.
  // Resolve only the exact saved quote, without rewriting the stored offsets.
  const start = hasQuote ? text.indexOf(quote) : -1;
  return start >= 0 && text.lastIndexOf(quote) === start ? { start, end: start + quote.length } : null;
}

export function parseJournalLinks(json: string): Record<string, unknown>[] {
  try {
    const links: unknown = JSON.parse(json);
    return Array.isArray(links) ? links.filter((link): link is Record<string, unknown> =>
      link !== null && typeof link === "object" && !Array.isArray(link)) : [];
  } catch { return []; }
}

const normalized = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("cs");
const folded = (value: string) => normalized(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const JOURNAL_CATEGORIES = [
  { key: "matter", title: "Co se řeší a požaduje", collapsed: false },
  { key: "time", title: "Termíny a události", collapsed: false },
  { key: "questions", title: "Nejasnosti a rozpory", collapsed: false },
  { key: "risks", title: "Rizika uvedená v podkladech", collapsed: false },
  { key: "identity", title: "Identifikace", collapsed: true },
  { key: "parameters", title: "Doplňující údaje", collapsed: true },
  { key: "notes", title: "Ruční poznámky", collapsed: false }
] as const;
export type JournalCategory = typeof JOURNAL_CATEGORIES[number]["key"];
export type TimeKind = "document" | "delivery" | "response" | "event" | "unspecified";
export const TIME_LABELS: Record<TimeKind, string> = {
  document: "Datum dokumentu", delivery: "Doručení", response: "Termín reakce",
  event: "Plánovaná událost", unspecified: "Datum – typ neurčen"
};

function timeKind(title: string, body: string): TimeKind | null {
  const label = folded(title);
  const text = folded(`${title} ${body}`);
  const date = String.raw`(?:\d{4}-\d{2}-\d{2}\b|\d{1,2}\.\s*\d{1,2}\.(?:\s*\d{4}\b)?|\d{1,2}\.?\s+(?:ledna|unora|brezna|dubna|kvetna|cervna|cervence|srpna|zari|rijna|listopadu|prosince)\b)`;
  const request = /\b(?:doloz\w*|dopln\w*|predloz\w*|dodat|dodani|dodej\w*|poskyt\w*|pozadavek|pozaduj\w*|vyzyvame|musite|povinnost)\b/.test(text);
  // A deadline for materials "k jednání" is not the hearing's date. A bare
  // quantity such as "do 10 osob" supplies no temporal evidence.
  if (/\blhut(?:a|y|u|e|ou)\b|\btermin (?:reakce|odpovedi|doplneni|dodani|predlozeni)\b|\bnejpozdeji\b/.test(text) ||
      new RegExp(String.raw`\bdo\s+${date}`).test(text) ||
      (request && /\bdo\s+\d+\s+(?:pracovnich\s+)?(?:dnu|dne|dni|tydnu|tydne|tydny|mesicu|mesice|hodin|hodiny)\b/.test(text))) return "response";
  // Keep a notice's actual request visible even under a dated heading. Only
  // a dedicated date field without a request belongs in collapsed parameters.
  if (request) return null;
  if (/^(?:datum (?:vyhotoveni|vydani|vystaveni)(?: (?:dokumentu|vyzvy))?|datum (?:dokumentu|vyzvy)|vyhotoveno|vydano|vystaveno|(?:vyhotoveni|vydani) (?:dokumentu|vyzvy))\s*:?$/.test(label)) return "document";
  if (/^(?:(?:datum|termin) )?(?:doruceni|doruceno|prijeti)\b/.test(label)) return "delivery";
  if (/^(?:(?:datum|termin) )?(?:jednani|mistni setreni|setreni|schuzka|planovana udalost)\b/.test(label)) return "event";
  // Dates without a reliably recognized role remain visible and neutral.
  if (new RegExp(String.raw`\b${date}`).test(text)) return "unspecified";
  return null;
}

function category(item: JournalItem, type: string, body: string, manual: boolean): { category: JournalCategory; time: TimeKind | null } {
  if (type === "conflict" || item.evidence_state === "conflict" || type === "question" || item.item_type === "QUESTION") {
    return { category: "questions", time: null };
  }
  if (manual) return { category: "notes", time: null };
  const time = timeKind(item.title, body);
  if (time) return { category: time === "document" ? "parameters" : "time", time };
  if (type === "term") return { category: "matter", time: null };
  if (type === "identifier") return { category: "identity", time: null };
  if (type === "legal_reference" || /sirka|vyska|delka|rozmer|parametr/.test(folded(item.title))) return { category: "parameters", time: null };
  // No plan/Goal is consulted and no new risk is inferred from dates.
  if (type === "risk" || item.item_type === "RISK") return { category: "risks", time: null };
  return { category: "matter", time: null };
}

export function sourceKey(source: JournalSource) {
  return JSON.stringify([source.documentId, source.pinId, source.startOffset, source.endOffset, source.quote]);
}
function uniqueSources(sources: JournalSource[]) {
  return [...new Map(sources.map((source) => [sourceKey(source), source])).values()];
}

export type JournalVariant = { text: string; sources: JournalSource[]; items: JournalItem[] };
export type JournalGroup = {
  id: string; label: string; category: JournalCategory; time: TimeKind | null;
  variants: JournalVariant[]; sources: JournalSource[]; items: JournalItem[];
};

/** Pure view: never mutates rows, sources, offsets, statuses or application context. */
export function buildJournalOverview(items: JournalItem[], evidence: JournalEvidence, situationId: string, documentFilter: string | null = null): JournalGroup[] {
  const documents = new Map(evidence.documents.map((doc) => [doc.id, doc]));
  const insights = new Map(evidence.insights.map((insight) => [insight.id, insight]));
  const pins = new Map(evidence.pins.map((pin) => [pin.id, pin]));
  const groups = new Map<string, JournalGroup>();
  for (const item of items) {
    if (item.situation_id !== situationId || item.status === "obsolete") continue;
    const links = parseJournalLinks(item.source_links_json);
    const related = evidence.insights.filter((insight) => insight.journal_item_id === item.id || links.some((link) => link.insightId === insight.id));
    const insight = related.length === 1 ? related[0] : undefined;
    const sources: JournalSource[] = [];
    const addSource = (documentId: string | null, pinId: string | null, insightId: string | null, quote?: string | null) => {
      const doc = documentId ? documents.get(documentId) : null;
      if (!doc) return;
      const pin = pinId ? pins.get(pinId) : undefined;
      const validPin = pin?.document_id === doc.id ? pin : undefined;
      const sourceInsight = insightId ? insights.get(insightId) : undefined;
      const validInsight = sourceInsight?.source_document_id === doc.id ? sourceInsight : undefined;
      sources.push({
        documentId: doc.id, documentName: doc.display_name || doc.filename,
        pinId: validPin?.id ?? null, insightId: validInsight?.id ?? null,
        startOffset: validPin?.start_offset ?? validInsight?.source_start_offset ?? null,
        endOffset: validPin?.end_offset ?? validInsight?.source_end_offset ?? null,
        quote: quote?.trim() || validInsight?.source_text?.trim() || validPin?.selected_text || item.explanation || ""
      });
    };
    for (const link of links) {
      const pin = typeof link.pinId === "string" ? pins.get(link.pinId) : undefined;
      const linkedInsight = typeof link.insightId === "string" ? insights.get(link.insightId) : undefined;
      addSource(getSourceLinkDocumentId(link) ?? pin?.document_id ?? linkedInsight?.source_document_id ?? null,
        typeof link.pinId === "string" ? link.pinId : null, typeof link.insightId === "string" ? link.insightId : null,
        typeof link.sourceText === "string" ? link.sourceText : null);
    }
    for (const linkedInsight of related) addSource(linkedInsight.source_document_id, linkedInsight.source_pin_id, linkedInsight.id);
    const allSources = uniqueSources(sources);
    const manual = related.length === 0;
    const edited = Boolean(insight && (
      item.title !== insight.title || (item.value !== null && item.value !== insight.content)
    ));
    // Stored values, including an intentionally empty value, take precedence.
    // Recovery is display-only and is suppressed for recognizably edited rows.
    const body = item.value !== null ? item.value : edited ? "" :
      insight?.content?.trim() || item.explanation?.trim() || allSources.find((source) => source.quote)?.quote || "";
    const display = body && normalized(body) !== normalized(item.title) ? `${item.title}: ${body}` : item.title;
    const placement = category(item, insight?.insight_type ?? "", body, manual);
    const visibleSources = documentFilter ? allSources.filter((source) => source.documentId === documentFilter) : allSources;
    if (documentFilter && !manual && !visibleSources.length) continue;

    // Identity grouping is deliberately narrow: stable IČO/DS/file identifiers,
    // explicit subject — attribute — context with a common file context, or the exact same
    // source range. Generic titles or similar text alone never establish identity.
    let identity: string | null = null;
    const explicit = item.title.split(/\s+[—–|]\s+/);
    const references = allSources.map((source) => source.quote.match(/(?:č\.?\s*j\.?|sp\.?\s*zn\.?)\s*[:：]?\s*([\p{L}\d][\p{L}\d/_.-]*)(?=\s*[:;,\n]|$)/iu)?.[1]);
    const reference = references.length && references.every((value) => value && normalized(value) === normalized(references[0]!)) ? references[0] : null;
    const subjectIds = [...body.matchAll(/(?:IČO\s*:?\s*(\d{8})|datová schránka\s*:?\s*([a-z\d]{7})\b)/giu)];
    const subjectId = subjectIds.length === 1 ? subjectIds[0] : undefined;
    const attribute = normalized(item.title);
    if (insight && !edited) {
      if (insight?.insight_type === "identifier" && subjectId) identity = JSON.stringify(["entity", subjectId[1] ?? subjectId[2], attribute]);
      else if (insight?.insight_type === "identifier" && /^(číslo jednací|č\.?\s*j\.?|spisová značka)$/iu.test(item.title) && body.trim()) {
        identity = JSON.stringify(["file", attribute, normalized(body)]);
      } else if (explicit.length === 3 && explicit.every((part) => part.trim()) && allSources.length) {
        const context = reference ? `file:${normalized(reference)}` : `documents:${[...new Set(allSources.map((source) => source.documentId))].sort().join("|")}`;
        identity = JSON.stringify(["explicit", normalized(explicit[0]), normalized(explicit[1]), normalized(explicit[2]), context]);
      } else if (allSources.length && allSources.every((source) => source.startOffset !== null && source.endOffset !== null)) {
        identity = JSON.stringify(["passage", attribute, allSources.map((source) => [source.documentId, source.startOffset, source.endOffset]).sort()]);
      }
    }
    const key = JSON.stringify([situationId, placement.category, placement.time, item.status, identity ?? item.id]);
    let group = groups.get(key);
    if (!group) {
      group = { id: item.id, label: item.title, ...placement, variants: [], sources: [], items: [] };
      groups.set(key, group);
    }
    const variant = group.variants.find((entry) => normalized(entry.text) === normalized(display));
    if (variant) { variant.items.push(item); variant.sources = uniqueSources([...variant.sources, ...visibleSources]); }
    else group.variants.push({ text: display, sources: visibleSources, items: [item] });
    group.items.push(item);
    group.sources = uniqueSources([...group.sources, ...visibleSources]);
  }
  // Make differing values visible before opening supplementary parameters.
  // This signals unresolved variants, without deciding which value is valid.
  return [...groups.values()].map((group) => group.variants.length > 1 ? { ...group, category: "questions" as const } : group);
}

export function contextualJournalPinIds(items: JournalItem[], evidence: JournalEvidence, situationId: string) {
  return [...new Set(buildJournalOverview(items, evidence, situationId).flatMap((group) => group.sources.flatMap((source) => source.pinId ? [source.pinId] : [])))];
}
