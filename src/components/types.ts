export type CaseStatus = "draft" | "active" | "closed";

export type CaseSummary = {
  id: string;
  title: string;
  area: string | null;
  status: CaseStatus;
  icon: string;
  icon_color: string;
  document_count: number;
  situation_count: number;
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

export type GoalStatus = "active" | "completed" | "archived";

export type Goal = {
  id: string;
  situation_id: string;
  title: string;
  status: GoalStatus;
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
  situation_id: string | null;
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

export type SituationDocument = {
  id: string;
  situation_id: string;
  document_id: string;
  created_at: string;
};

export type CaseDocument = {
  id: string;
  case_id: string;
  filename: string;
  display_name: string | null;
  filetype: string;
  original_file: string;
  document_type: "source" | "analysis" | "generated";
  analysis_type: string | null;
  parent_document_id: string | null;
  extracted_text: string | null;
  processed_text: string | null;
  processed_markdown: string | null;
  processing_status: string;
  processing_error: string | null;
  markdown_version: number;
  validation_status: "pending_validation" | "validated";
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

export type DocumentAnnotationType = "highlight" | "note" | "question" | "issue";

export type DocumentAnnotation = {
  id: string;
  document_id: string;
  selected_text: string;
  start_offset: number | null;
  end_offset: number | null;
  visual_offset: number | null;
  annotation_type: DocumentAnnotationType;
  highlight_color: string | null;
  note_text: string | null;
  created_at: string;
  updated_at: string;
};


export type DocumentPin = {
  id: string;
  document_id: string;
  selected_text: string;
  start_offset: number;
  end_offset: number;
  visual_offset: number | null;
  case_bookmark_number: number | null;
  color: string;
  note_text: string | null;
  created_at: string;
  updated_at: string;
};


export type DocumentInsightStatus = "pending" | "approved" | "rejected" | "journalized";

export type DocumentInsightType =
  | "fact"
  | "claim"
  | "risk"
  | "question"
  | "legal_reference"
  | "term"
  | "identifier"
  | "conflict";

export type DocumentInsight = {
  id: string;
  document_id: string;
  source_document_id: string | null;
  source_pin_id: string | null;
  insight_type: DocumentInsightType;
  target_section: JournalSectionKey;
  target_item_type: JournalItemType;
  title: string;
  content: string | null;
  evidence_state: EvidenceState;
  status: DocumentInsightStatus;
  source_text: string | null;
  source_start_offset: number | null;
  source_end_offset: number | null;
  analysis_start_offset: number | null;
  analysis_end_offset: number | null;
  journal_item_id: string | null;
  created_at: string;
  updated_at: string;
};
