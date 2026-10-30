import { z } from "zod";
import { requestAIJson } from "@/lib/ai/jsonResponse";

const insightTypeSchema = z.enum([
  "fact",
  "claim",
  "risk",
  "question",
  "legal_reference",
  "term",
  "identifier",
  "conflict"
]);

const aiInsightSchema = z.object({
  insight_type: insightTypeSchema,
  title: z.string().min(1),
  content: z.union([z.string(), z.null()]).optional(),
  source_text: z.string().min(1)
});

export const aiDocumentAnalysisSchema = z.object({
  summary: z.string().min(1),
  insights: z.array(aiInsightSchema).max(40)
});

export type AIDocumentAnalysis = z.infer<typeof aiDocumentAnalysisSchema>;

function buildPrompt(documentTitle: string, documentText: string) {
  return `
Analyzuj úřední nebo administrativní dokument.

Úkol:
- extrahuj a kategorizuj klíčové informace
- neinterpretuj mimo obsah dokumentu
- nedomýšlej kontext
- nevysvětluj právo nad rámec explicitního textu dokumentu
- otázky smíš formulovat pouze tam, kde dokument zjevně ponechává nejasnost

Kategorie:
- identifier: osoby, instituce, adresy, čísla jednací, spisové značky, data narození, IČO, kontakty
- legal_reference: paragrafy, zákony, vyhlášky, právní ustanovení, citace předpisů
- fact: explicitní klíčová skutečnost uvedená v dokumentu
- claim: tvrzení jedné strany, stanovisko, námitka, popis události bez ověření
- risk: lhůta, pokuta, sankce, povinnost, hrozící následek, procesní riziko
- conflict: vnitřní rozpor, nesoulad nebo zjevně konfliktní tvrzení přímo uvnitř dokumentu
- question: otázka pro uživatele kvůli chybějící nebo nejasné informaci
- term: důležitý termín, datum, lhůta nebo časový údaj

Vrátíš pouze JSON podle schématu:
{
  "summary": "stručné shrnutí bez interpretace",
  "insights": [
    {
      "insight_type": "fact | claim | risk | question | legal_reference | term | identifier | conflict",
      "title": "krátký název",
      "content": "volitelný detail nebo null",
      "source_text": "přesná citace z dokumentu"
    }
  ]
}

Dokument: ${documentTitle}

Text dokumentu:
"""${documentText.slice(0, 18000)}"""
`;
}

export async function analyzeDocumentWithAI(input: {
  documentTitle: string;
  documentText: string;
}): Promise<AIDocumentAnalysis> {
  return requestAIJson(buildPrompt(input.documentTitle, input.documentText), aiDocumentAnalysisSchema);
}
