import type { DocumentInsight } from "@/components/types";

type Insight = Pick<DocumentInsight, "title" | "content" | "source_text" | "insight_type">;
export const ANALYSIS_CATEGORIES = ["Identifikace", "Klíčové skutečnosti", "Podklady a přílohy", "Data, lhůty a události", "Rizika a rozpory", "Otázky"] as const;
export const IDENTIFICATION_ROLES = ["Odesílatel", "Adresát", "Kontakty", "Spisová značka", "Další identifikační údaje"] as const;
const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Bounded presentation rules over saved text; no role/entity/Goal synthesis. */
export function classifyAnalysisInsight(insight: Insight): { category: typeof ANALYSIS_CATEGORIES[number]; role: typeof IDENTIFICATION_ROLES[number] | null; time: string | null } {
  const title = fold(insight.title), body = fold(insight.content ?? insight.source_text ?? ""), text = `${title} ${body}`;
  const placement = (category: typeof ANALYSIS_CATEGORIES[number], role: typeof IDENTIFICATION_ROLES[number] | null = null, time: string | null = null) => ({ category, role, time });
  if (insight.insight_type === "question") return placement("Otázky");
  const attachment = /nacrt|nakres|vykres|priloh|podklad|souhlas/.test(title) ||
    (insight.insight_type !== "identifier" && !/odesilatel|adresat|prijemce|kontakt|telefon|e-?mail|spisova|jednaci/.test(title) &&
      /\b(?:v priloze|prilozen\w*)\b[^.!?]*(?:nacrt|nakres|vykres|souhlas|podklad)/.test(body));
  const consequence = /pokut|sankc|zastaven|zamítn|zamitn|nasledek|hrozi|rozpor|vzajemne si odpor/.test(text);
  const hasDate = /\b\d{1,2}\.\s*(?:\d{1,2}\.|ledna|unora|brezna|dubna|kvetna|cervna|cervence|srpna|zari|rijna|listopadu|prosince)|\b\d{4}-\d{2}-\d{2}/.test(text);
  const dateOnly = hasDate && !body.replace(/\d|[\s.,:/–—-]|ledna|unora|brezna|dubna|kvetna|cervna|cervence|srpna|zari|rijna|listopadu|prosince|dne/g, "").trim();
  if ((insight.insight_type === "risk" || insight.insight_type === "conflict") && consequence && !dateOnly) return placement("Rizika a rozpory");
  let time: string | null = null;
  if (/lhut|termin (reakce|odpovedi|doplneni|dodani)|nejpozdeji/.test(text) || /\bdo\s+\d{1,2}\.\s*(?:\d{1,2}\.|zari|rijna|srpna|listopadu|prosince)/.test(text)) time = "Termín reakce";
  else if (/datum (vyhotoveni|vydani)|vyhotoveno|vydano/.test(title)) time = "Vyhotovení";
  else if (/podani|podano/.test(title)) time = "Podání";
  else if (/doruceni|doruceno|datum prijeti/.test(title)) time = "Doručení";
  else if (/^(?:(?:datum|termin) )?(?:jednani|mistni setreni|schuzka|planovana udalost)\b/.test(title)) time = "Plánovaná událost";
  if (time === "Termín reakce") return placement("Data, lhůty a události", null, time);
  if (attachment) return placement("Podklady a přílohy");
  if (time) return placement("Data, lhůty a události", null, time);
  if (dateOnly) return placement("Data, lhůty a události", null, "Datum – význam neurčen");
  if (insight.insight_type === "risk" || insight.insight_type === "conflict") return placement("Rizika a rozpory");
  const sender = /odesilatel/.test(title), recipient = /adresat|prijemce/.test(title);
  if (sender || recipient) return placement("Identifikace", sender && recipient ? "Další identifikační údaje" : sender ? "Odesílatel" : "Adresát");
  if (/kontakt|telefon|e-?mail/.test(title)) return placement("Identifikace", "Kontakty");
  if (/spisova znacka|cislo jednaci|\bc\.?\s*j\.?|\bsp\.?\s*zn\.?/.test(title)) return placement("Identifikace", "Spisová značka");
  if (insight.insight_type === "identifier") return placement("Identifikace", "Další identifikační údaje");
  return placement("Klíčové skutečnosti");
}
