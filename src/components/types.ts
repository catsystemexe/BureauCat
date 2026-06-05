export type CaseStatus = "draft" | "active" | "closed";

export type CaseSummary = {
  id: string;
  title: string;
  area: string | null;
  status: CaseStatus;
  created_at?: string;
  updated_at?: string;
};

export type SituationStatus = "active" | "archived";

export type Situation = {
  id: string;
  case_id: string;
  title: string;
  description: string | null;
  status: SituationStatus;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type JournalSectionKey =
  | "description"
  | "goals"
  | "risks"
  | "open_questions"
  | "strategy";

export type JournalItemType = "FACT" | "CLAIM" | "GOAL" | "QUESTION" | "ACTION" | "RISK";

export type EvidenceState = "verified" | "inferred" | "unverified" | "conflict";

export type JournalItemStatus = "active" | "resolved" | "obsolete";

export type JournalItem = {
  id: string;
  case_id: string;
  section: JournalSectionKey;
  item_type: JournalItemType;
  title: string;
  value: string | null;
  explanation: string | null;
  evidence_state: EvidenceState;
  status: JournalItemStatus;
  display_order: number;
  source_links_json: string;
  created_at: string;
  updated_at: string;
};

export type CaseDocument = {
  id: string;
  case_id: string;
  filename: string;
  filetype: string;
  original_file: string;
  extracted_text: string | null;
  ai_summary: string | null;
  created_at: string;
};

export type ChatMessageRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  case_id: string;
  role: ChatMessageRole;
  content: string;
  created_at: string;
};

export type SuggestionStatus = "pending" | "approved" | "rejected";

export type SuggestionJournalItem = {
  section: JournalSectionKey;
  item_type: JournalItemType;
  title: string;
  value?: string | null;
  explanation?: string | null;
  evidence_state: EvidenceState;
  status: JournalItemStatus;
  display_order?: number;
  source_links_json?: string;
};

export type AISuggestionRecord = {
  id: string;
  case_id: string;
  status: SuggestionStatus;
  suggested_item_json: string;
  assistant_reply: string | null;
  created_at: string;
  updated_at: string;
};

export type AISuggestionPreview = {
  id: string;
  status: SuggestionStatus;
  item: SuggestionJournalItem;
};

export type SuggestionAction = "approve" | "reject";

export type SuggestionActionState = {
  loadingAction: SuggestionAction | null;
  error: string | null;
};
export type MeetingPrepReport = {
  summary: string;
  goals: string[];
  risks: string[];
  documents_to_bring: string[];
  questions_to_ask: string[];
  strategy: string;
};
