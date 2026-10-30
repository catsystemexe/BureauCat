"use client";

import type { JournalSource } from "@/lib/journal/overview";
import type { AnalysisReference } from "@/lib/analysis/references";
import { JournalPanel } from "@/components/journal/JournalPanel";
import type {
  CaseDocument,
  CaseSummary,
  DocumentInsight,
  JournalItem,
  WorkflowStepKey
} from "@/components/types";

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
  onOpenAnalysisSourceReference,
  targetAnalysisInsight,
  onOpenBookmark,
  onOpenJournalSource,
  onContextualPinsChange,
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
  onOpenAnalysisSourceReference: (reference: AnalysisReference) => Promise<boolean>;
  targetAnalysisInsight: { analysisDocumentId: string; insightId: string; token: number } | null;
  onOpenBookmark: (documentId: string, pinId: string) => void;
  onOpenJournalSource: (source: JournalSource) => Promise<boolean>;
  onContextualPinsChange: (situationId: string | null, pinIds: string[]) => void;
  onOpenDocument: (document: CaseDocument) => void;
  onSelectSituation: (situationId: string | null) => void;
  onStartBookmarkLink: (journalItemId: string) => void;
  pendingBookmarkTargetJournalItemId: string | null;
  selectedSituationId: string | null;
  selectedStepKey: WorkflowStepKey | null;
}) {
  return <section className="step-workspace step-workspace-analysis" aria-label="Zápisník situace">
    <div className="step-workspace-journal-shell">
      <JournalPanel caseItem={caseItem} documentListRefreshKey={documentListRefreshKey}
        onOpenDocument={onOpenDocument} onSelectSituation={onSelectSituation} onOpenBookmark={onOpenBookmark}
        onOpenSource={onOpenJournalSource} onContextualPinsChange={onContextualPinsChange}
        onStartBookmarkLink={onStartBookmarkLink} pendingBookmarkTargetJournalItemId={pendingBookmarkTargetJournalItemId}
        selectedSituationId={selectedSituationId} onBookmarkHover={onBookmarkHover} onBookmarkLeave={onBookmarkLeave} />
    </div>
  </section>;
}
