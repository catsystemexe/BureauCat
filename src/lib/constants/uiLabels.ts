import type {
  CaseStatus,
  ChatMessageRole,
  EvidenceState,
  JournalItemStatus,
  JournalItemType,
  JournalSectionKey,
  SuggestionStatus
} from "@/components/types";

export const JOURNAL_SECTION_LABELS: Record<JournalSectionKey, string> = {
  description: "Situace",
  goals: "Cíle",
  risks: "Rizika",
  open_questions: "Otázky",
  strategy: "Postup"
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  draft: "Rozpracováno",
  active: "Aktivní",
  closed: "Uzavřeno"
};

export const JOURNAL_ITEM_TYPE_LABELS: Record<JournalItemType, string> = {
  FACT: "Fakt",
  CLAIM: "Tvrzení",
  GOAL: "Cíl",
  QUESTION: "Otázka",
  ACTION: "Krok",
  RISK: "Riziko"
};

export const EVIDENCE_STATE_LABELS: Record<EvidenceState, string> = {
  verified: "Ověřeno",
  inferred: "Odvozeno",
  unverified: "Neověřeno",
  conflict: "Rozpor"
};

export const JOURNAL_ITEM_STATUS_LABELS: Record<JournalItemStatus, string> = {
  active: "Aktivní",
  resolved: "Vyřešeno",
  obsolete: "Neaktuální"
};

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  pending: "Čeká na kontrolu",
  approved: "Přidáno do zápisníku",
  rejected: "Zamítnuto"
};

export const CHAT_MESSAGE_ROLE_LABELS: Record<ChatMessageRole, string> = {
  user: "Vy",
  assistant: "Asistent",
  system: "Systém"
};
