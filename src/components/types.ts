export type CaseSummary = {
  id: string;
  title: string;
  area: string | null;
  status: "draft" | "active" | "closed";
  created_at?: string;
  updated_at?: string;
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
