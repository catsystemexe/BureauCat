"use client";

import { ChatPanel } from "@/components/chat/ChatPanel";
import { JournalPanel } from "@/components/journal/JournalPanel";
import type {
  CaseDocument,
  CaseSummary,
  DocumentInsight,
  JournalItem,
  WorkflowStepKey
} from "@/components/types";

const STEP_LABELS: Record<WorkflowStepKey, string> = {
  ANALYSIS: "Analýza",
  PLAN: "Plán",
  COLLECTION: "Podklady",
  INPUT_VALIDATION: "Validace",
  PRODUCTION: "Produkce",
  OUTPUT_REVIEW: "Kontrola výstupu",
  EXECUTION: "Dokončení"
};

const STEP_NOTES: Record<Exclude<WorkflowStepKey, "ANALYSIS">, string> = {
  PLAN: "Tento prostor bude obsahovat potvrzený cíl, pracovní route a Required Inputs.",
  COLLECTION: "Tento prostor bude obsahovat Required Inputs, jejich kritéria a stav získávání podkladů.",
  INPUT_VALIDATION: "Tento prostor bude obsahovat readiness kontrolu a případné explicitní override.",
  PRODUCTION: "Produkční pracovní plocha bude doplněna až v příslušném workflow slice.",
  OUTPUT_REVIEW: "Kontrola výstupu bude doplněna až po Production contract slice.",
  EXECUTION: "Dokončení bude evidovat potvrzenou reálnou akci nebo uzavření Situation."
};

export function StepWorkspace({
  activeAnalysisDocument,
  caseItem,
  documentListRefreshKey,
  hoveredBookmarkPinId,
  onActiveAnalysisInsightsChange,
  onBookmarkHover,
  onBookmarkLeave,
  onCloseAnalysisDocument,
  onJournalRefreshRequested,
  onOpenAnalysisSourceDocument,
  onOpenBookmark,
  onOpenDocument,
  onSelectSituation,
  onStartBookmarkLink,
  pendingBookmarkTargetJournalItemId,
  selectedSituationId,
  selectedStepKey
}: {
  activeAnalysisDocument: CaseDocument | null;
  caseItem: CaseSummary;
  documentListRefreshKey: number;
  hoveredBookmarkPinId: string | null;
  onActiveAnalysisInsightsChange: (insights: DocumentInsight[]) => void;
  onBookmarkHover: (pinId: string) => void;
  onBookmarkLeave: () => void;
  onCloseAnalysisDocument: () => void;
  onJournalRefreshRequested: () => void;
  onOpenAnalysisSourceDocument: (documentId: string) => Promise<boolean>;
  onOpenBookmark: (documentId: string, pinId: string) => void;
  onOpenDocument: (document: CaseDocument) => void;
  onSelectSituation: (situationId: string | null) => void;
  onStartBookmarkLink: (journalItemId: string) => void;
  pendingBookmarkTargetJournalItemId: string | null;
  selectedSituationId: string | null;
  selectedStepKey: WorkflowStepKey | null;
}) {
  const stepKey = selectedStepKey ?? "ANALYSIS";

  if (stepKey === "ANALYSIS" && activeAnalysisDocument) {
    return (
      <section className="step-workspace step-workspace-analysis" aria-label="Analýza dokumentu">
        <ChatPanel
          activeAnalysisDocument={activeAnalysisDocument}
          caseItem={caseItem}
          onActiveAnalysisInsightsChange={onActiveAnalysisInsightsChange}
          onCloseAnalysisDocument={onCloseAnalysisDocument}
          onOpenAnalysisSourceDocument={(documentId) => {
            void onOpenAnalysisSourceDocument(documentId);
          }}
          onJournalRefreshRequested={onJournalRefreshRequested}
          selectedSituationId={selectedSituationId}
          hoveredBookmarkPinId={hoveredBookmarkPinId}
        />
      </section>
    );
  }

  if (stepKey === "ANALYSIS") {
    return (
      <section className="step-workspace step-workspace-analysis" aria-labelledby="step-workspace-title">
        <div className="step-workspace-header">
          <p className="panel-kicker">Aktivní krok</p>
          <h2 id="step-workspace-title">{STEP_LABELS[stepKey]}</h2>
          <p className="panel-note">Pracovní model situace a source-grounded poznatky.</p>
        </div>
        <div className="step-workspace-journal-shell">
          <JournalPanel
            caseItem={caseItem}
            documentListRefreshKey={documentListRefreshKey}
            onOpenDocument={onOpenDocument}
            onSelectSituation={onSelectSituation}
            onOpenBookmark={onOpenBookmark}
            onStartBookmarkLink={onStartBookmarkLink}
            pendingBookmarkTargetJournalItemId={pendingBookmarkTargetJournalItemId}
            selectedSituationId={selectedSituationId}
            onBookmarkHover={onBookmarkHover}
            onBookmarkLeave={onBookmarkLeave}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-panel step-workspace step-workspace-placeholder" aria-labelledby="step-workspace-title">
      <div className="step-workspace-header">
        <p className="panel-kicker">Vybraný krok</p>
        <h2 id="step-workspace-title">{STEP_LABELS[stepKey]}</h2>
        <p className="panel-note">{STEP_NOTES[stepKey]}</p>
      </div>
      <div className="step-workspace-empty-state">
        <p>Workflow shell je připravený. Funkční obsah tohoto kroku bude připojen v navazujícím vertical slice.</p>
      </div>
    </section>
  );
}