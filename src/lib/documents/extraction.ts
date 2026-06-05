const TXT_CONTEXT_LIMIT = 10000;
const NOT_IMPLEMENTED_SUMMARY = "Extrahování textu pro tento typ souboru zatím není implementováno.";
const TXT_PLACEHOLDER_SUMMARY = "Dokument TXT byl nahrán. Automatické shrnutí zatím není implementováno.";
const TXT_LIMIT_SUMMARY = "Dokument TXT překročil limit kontextu MVP. Do extrahovaného textu bylo uloženo pouze prvních 10 000 znaků.";

export type DocumentTextExtractionResult = {
  extracted_text: string | null;
  ai_summary: string;
};

export async function extractDocumentText(file: File, filetype: string): Promise<DocumentTextExtractionResult> {
  if (filetype !== "txt") {
    return {
      extracted_text: null,
      ai_summary: NOT_IMPLEMENTED_SUMMARY
    };
  }

  const text = await file.text();

  if (text.length > TXT_CONTEXT_LIMIT) {
    return {
      extracted_text: text.slice(0, TXT_CONTEXT_LIMIT),
      ai_summary: TXT_LIMIT_SUMMARY
    };
  }

  return {
    extracted_text: text,
    ai_summary: TXT_PLACEHOLDER_SUMMARY
  };
}
