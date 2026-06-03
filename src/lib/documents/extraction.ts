const TXT_CONTEXT_LIMIT = 10000;
const NOT_IMPLEMENTED_SUMMARY = "Text extraction not implemented for this file type yet.";
const TXT_PLACEHOLDER_SUMMARY = "TXT document uploaded. AI summary not implemented yet.";
const TXT_LIMIT_SUMMARY = "TXT document exceeded the MVP context limit. Only the first 10000 characters were stored for extracted text.";

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
