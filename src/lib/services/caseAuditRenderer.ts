import type { buildCaseContext } from "@/lib/services/caseContext";

type CaseContextResult = NonNullable<Awaited<ReturnType<typeof buildCaseContext>>>;
type CaseContext = Extract<CaseContextResult, { journal_items: unknown[] }>;
type JournalItem = CaseContext["journal_items"][number];

function line(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "—";
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toISOString();
}

function renderBookmarkLinks(item: {
  bookmark_links?: Array<{
    caseBookmarkNumber?: number | null;
    documentName?: string | null;
    quotedText?: string | null;
    pinNote?: string | null;
  }>;
}) {
  const links = item.bookmark_links ?? [];

  if (links.length === 0) {
    return "";
  }

  return links
    .map((link) => {
      const bookmarkNumber = link.caseBookmarkNumber ?? "?";
      const documentName = line(link.documentName);
      const quote = line(link.quotedText);

      return [
        `  - Zdroj: bookmark #${bookmarkNumber}, dokument: ${documentName}`,
        `  - Citace: ${quote}`
      ].join("\n");
    })
    .join("\n");
}

function renderJournalSection(
  title: string,
  items: JournalItem[],
  predicate: (item: JournalItem) => boolean
) {
  const sectionItems = items.filter((item) => item.status === "active" && predicate(item));

  if (sectionItems.length === 0) {
    return `## ${title}\n\nNenalezeno.\n`;
  }

  return [
    `## ${title}`,
    "",
    ...sectionItems.flatMap((item, index) => {
      const bookmarkText = renderBookmarkLinks(item);

      return [
        `${index + 1}. ${item.title}`,
        `   - Typ: ${item.item_type}`,
        `   - Stav důkazu: ${item.evidence_state}`,
        item.value ? `   - Hodnota: ${item.value}` : null,
        item.explanation ? `   - Poznámka / vysvětlení: ${item.explanation}` : null,
        bookmarkText || null,
        ""
      ].filter((value): value is string => Boolean(value));
    })
  ].join("\n");
}

export function renderCaseAuditMarkdown(context: CaseContext) {
  if ("error" in context) {
    return "# Case audit\n\nSituace nebyla nalezena.\n";
  }

  const journalItems = context.journal_items;

  return [
    `# Case / Situation Audit`,
    "",
    `## Identifikace`,
    "",
    `- Případ: ${context.case.title}`,
    `- Oblast: ${line(context.case.area)}`,
    `- Stav případu: ${context.case.status}`,
    `- Situace: ${context.situation ? context.situation.title : "Celý případ"}`,
    `- Popis situace: ${context.situation ? line(context.situation.description) : "—"}`,
    `- Vygenerováno: ${context.generated_at}`,
    "",
    renderJournalSection(
      "Extrahované poznatky",
      journalItems,
      (item) => item.item_type === "FACT" || item.item_type === "CLAIM"
    ),
    renderJournalSection(
      "Rizika a lhůty",
      journalItems,
      (item) => item.item_type === "RISK"
    ),
    renderJournalSection(
      "Otevřené otázky",
      journalItems,
      (item) => item.item_type === "QUESTION"
    ),
    renderJournalSection(
      "Cíle a strategie",
      journalItems,
      (item) => item.item_type === "GOAL" || item.item_type === "ACTION" || item.section === "strategy"
    ),
    "## Schválené / zapsané AI insighty",
    "",
    context.approved_insights.length === 0
      ? "Nenalezeno."
      : context.approved_insights
          .map((insight, index) =>
            [
              `${index + 1}. ${insight.title}`,
              `   - Typ: ${insight.insight_type}`,
              `   - Stav: ${insight.status}`,
              `   - Stav důkazu: ${insight.evidence_state}`,
              insight.source_text ? `   - Zdrojový text: ${insight.source_text}` : null,
              ""
            ].filter((value): value is string => Boolean(value)).join("\n")
          )
          .join("\n"),
    "",
    "## Připojené dokumenty",
    "",
    context.documents.length === 0
      ? "Nenalezeno."
      : context.documents
          .map((document, index) =>
            [
              `${index + 1}. ${document.name}`,
              `   - Typ souboru: ${document.filetype}`,
              `   - Typ dokumentu: ${document.document_type}`,
              `   - Validace: ${document.validation_status}`,
              document.ai_summary ? `   - Shrnutí: ${document.ai_summary}` : null,
              ""
            ].filter((value): value is string => Boolean(value)).join("\n")
          )
          .join("\n"),
    "",
    "## AI komentář",
    "",
    "Zatím nevygenerováno. Tato část bude doplněna samostatným AI krokem nad potvrzeným kontextem případu.",
    "",
    "## Doporučené další kroky",
    "",
    "Zatím nevygenerováno. Tato část bude doplněna samostatným AI krokem po schválení cíle uživatelem.",
    ""
  ].join("\n");
}
