"use client";

import type { JournalSource, SourceTarget } from "@/lib/journal/overview";
import type { AnalysisReference } from "@/lib/analysis/references";
import { getRecordValue, getSourceLinkDocumentId } from "@/lib/documents/sourceLinks";
import { type ReactNode, type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { DocumentList } from "@/components/documents/DocumentList";
import { DocumentUpload, type DocumentUploadHandle } from "@/components/documents/DocumentUpload";
import { DocumentViewPanel } from "@/components/documents/DocumentViewPanel";
import { JournalPanel } from "@/components/journal/JournalPanel";
import { StepWorkspace } from "@/components/workflow/StepWorkspace";
import { SituationPlanningPanel } from "@/components/workflow/SituationPlanningPanel";
import { WorkflowRail } from "@/components/workflow/WorkflowRail";
import {
  CASE_STATUS_LABELS,
  EVIDENCE_STATE_LABELS,
  JOURNAL_ITEM_STATUS_LABELS,
  JOURNAL_ITEM_TYPE_LABELS,
  JOURNAL_SECTION_LABELS
} from "@/lib/constants/uiLabels";
import {
  ArrowUpTrayIcon,
  FolderIcon
} from "@heroicons/react/24/outline";
import {
  AlarmClock,
  Briefcase,
  Building2,
  Car,
  Cat,
  FileText,
  Folder,
  HandCoins,
  Handshake,
  Landmark,
  Mail,
  PenTool,
  Puzzle,
  Scale,
  Section,
  Shield,
  Swords,
  UsersRound,
  House,
  MessageSquareWarning
} from "lucide-react";
import type {
  CaseDocument,
  CaseSummary,
  DocumentInsight,
  DocumentPin,
  JournalItem,
  WorkflowStepKey
} from "./types";

type RightPanelMode = "help" | "evidence" | "document";
type RightPanelTab = "documents" | "analysis" | "plan";

type ParsedSourceLinks =
  | { kind: "empty" }
  | { kind: "parsed"; links: unknown[] }
  | { kind: "raw"; rawValue: string };

const CASE_ICON_OPTIONS = [
  { key: "folder", label: "Složka", Icon: Folder },
  { key: "file-text", label: "Dokument", Icon: FileText },
  { key: "landmark", label: "Úřad", Icon: Landmark },
  { key: "users", label: "Lidé", Icon: UsersRound },
  { key: "car", label: "Auto", Icon: Car },
  { key: "scale", label: "Právo", Icon: Scale },
  { key: "shield", label: "Ochrana", Icon: Shield },
  { key: "briefcase", label: "Spis", Icon: Briefcase },
  { key: "building", label: "Instituce", Icon: Building2 },
  { key: "section", label: "Sekce", Icon: Section },
  { key: "swords", label: "Spor", Icon: Swords },
  { key: "alarm-clock", label: "Termín", Icon: AlarmClock },
  { key: "cat", label: "Kočka", Icon: Cat },
  { key: "handshake", label: "Dohoda", Icon: Handshake },
  { key: "pen-tool", label: "Podpis", Icon: PenTool },
  { key: "puzzle", label: "Souvislosti", Icon: Puzzle },
  { key: "hand-coins", label: "Finance", Icon: HandCoins },
  { key: "mail", label: "Pošta", Icon: Mail },
  { key: "house", label: "Domov", Icon: House },
  { key: "message-square-warning", label: "Varování", Icon: MessageSquareWarning }
] as const;

const CASE_COLOR_OPTIONS = [
  "#3b82f6",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#8b5cf6",
  "#22c55e"
] as const;

function getCaseIcon(iconKey: string) {
  return CASE_ICON_OPTIONS.find((option) => option.key === iconKey)?.Icon ?? Folder;
}

type DocumentResponse = {
  document?: CaseDocument;
  error?: string;
};

type DocumentSourceReference = {
  documentId: string;
  label: string;
};

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Neuvedeno";
  }

  return String(value);
}

function parseSourceLinks(sourceLinksJson: string | null | undefined): ParsedSourceLinks {
  if (!sourceLinksJson) {
    return { kind: "empty" };
  }

  try {
    const parsedSourceLinks = JSON.parse(sourceLinksJson) as unknown;

    if (Array.isArray(parsedSourceLinks)) {
      return { kind: "parsed", links: parsedSourceLinks };
    }

    return { kind: "parsed", links: [parsedSourceLinks] };
  } catch {
    return { kind: "raw", rawValue: sourceLinksJson };
  }
}

function findDocumentSourceReference(sourceLink: unknown): DocumentSourceReference | null {
  const documentId = getSourceLinkDocumentId(sourceLink);
  if (!documentId) return null;
  const sourceRecord = sourceLink as Record<string, unknown>;

  const documentName =
    getRecordValue(sourceRecord, ["filename", "file_name", "document_name", "name", "title"]) ??
    (sourceRecord.document &&
    typeof sourceRecord.document === "object" &&
    !Array.isArray(sourceRecord.document)
      ? getRecordValue(sourceRecord.document as Record<string, unknown>, [
          "filename",
          "file_name",
          "document_name",
          "name",
          "title"
        ])
      : null);

  return {
    documentId,
    label: documentName ? `Otevřít dokument: ${documentName}` : "Otevřít dokument"
  };
}

function formatSourceLink(sourceLink: unknown) {
  if (sourceLink === null || sourceLink === undefined || sourceLink === "") {
    return "Neuvedeno";
  }

  if (
    typeof sourceLink === "string" ||
    typeof sourceLink === "number" ||
    typeof sourceLink === "boolean"
  ) {
    return String(sourceLink);
  }

  if (typeof sourceLink === "object" && !Array.isArray(sourceLink)) {
    const sourceRecord = sourceLink as Record<string, unknown>;
    const documentName = getRecordValue(sourceRecord, [
      "filename",
      "file_name",
      "document_name",
      "name",
      "title"
    ]);
    const quotedText = getRecordValue(sourceRecord, [
      "quoted_text",
      "quotedText",
      "quote",
      "citation"
    ]);
    const sourceDescription = getRecordValue(sourceRecord, ["source", "description"]);
    const details = [
      documentName ? `Dokument: ${documentName}` : null,
      quotedText ? `Citace: ${quotedText}` : null,
      sourceDescription ? `Zdroj: ${sourceDescription}` : null
    ].filter((value): value is string => value !== null);

    return details.length > 0 ? details.join("\n") : "Podklad bez dalšího popisu.";
  }

  return "Podklad bez dalšího popisu.";
}

function MiddleChatPanel({
  activeAnalysisDocument,
  caseItem,
  onActiveAnalysisInsightsChange,
  onCloseAnalysisDocument,
  onOpenAnalysisSourceDocument,
  onJournalRefreshRequested,
  selectedSituationId,
  hoveredBookmarkPinId
}: {
  activeAnalysisDocument: CaseDocument | null;
  caseItem: CaseSummary;
  onActiveAnalysisInsightsChange: (insights: DocumentInsight[]) => void;
  onCloseAnalysisDocument: () => void;
  onOpenAnalysisSourceDocument: (documentId: string) => Promise<boolean>;
  onJournalRefreshRequested: () => void;
  selectedSituationId: string | null;
  hoveredBookmarkPinId: string | null;
}) {
  return (
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
  );
}

function EvidencePanel({
  journalItem,
  onOpenDocument
}: {
  journalItem: JournalItem;
  onOpenDocument: (documentId: string) => Promise<boolean>;
}) {
  const parsedSourceLinks = parseSourceLinks(journalItem.source_links_json);
  const [documentLoadError, setDocumentLoadError] = useState<string | null>(null);
  const [loadingDocumentId, setLoadingDocumentId] = useState<string | null>(null);

  async function handleOpenDocument(documentId: string) {
    setDocumentLoadError(null);
    setLoadingDocumentId(documentId);

    try {
      const didOpenDocument = await onOpenDocument(documentId);

      if (!didOpenDocument) {
        setDocumentLoadError("Dokument se nepodařilo načíst.");
      }
    } catch {
      setDocumentLoadError("Dokument se nepodařilo načíst.");
    } finally {
      setLoadingDocumentId(null);
    }
  }

  return (
    <section className="evidence-panel" aria-labelledby="evidence-panel-title">
      <p className="panel-kicker">Zápisník</p>
      <h2 id="evidence-panel-title">Důkazy / Podklady</h2>
      <h3 className="evidence-item-title">{displayValue(journalItem.title)}</h3>
      <dl className="evidence-detail-list">
        <div className="evidence-detail-row">
          <dt>Sekce</dt>
          <dd>{JOURNAL_SECTION_LABELS[journalItem.section]}</dd>
        </div>
        <div className="evidence-detail-row">
          <dt>Typ položky</dt>
          <dd>{JOURNAL_ITEM_TYPE_LABELS[journalItem.item_type]}</dd>
        </div>
        <div className="evidence-detail-row">
          <dt>Obsah</dt>
          <dd>{displayValue(journalItem.value)}</dd>
        </div>
        <div className="evidence-detail-row">
          <dt>Vysvětlení</dt>
          <dd>{displayValue(journalItem.explanation)}</dd>
        </div>
        <div className="evidence-detail-row">
          <dt>Stav podkladů</dt>
          <dd>
            <span className={`evidence-badge evidence-${journalItem.evidence_state}`}>
              {EVIDENCE_STATE_LABELS[journalItem.evidence_state]}
            </span>
          </dd>
        </div>
        <div className="evidence-detail-row">
          <dt>Stav položky</dt>
          <dd>{JOURNAL_ITEM_STATUS_LABELS[journalItem.status]}</dd>
        </div>
      </dl>

      <section className="source-links-panel" aria-labelledby="source-links-title">
        <h3 id="source-links-title">Podklady a zdroje</h3>
        {parsedSourceLinks.kind === "empty" ? (
          <p className="source-link-empty">Podklady nejsou uvedeny.</p>
        ) : null}
        {parsedSourceLinks.kind === "raw" ? (
          <pre className="source-link-raw">{parsedSourceLinks.rawValue}</pre>
        ) : null}
        {parsedSourceLinks.kind === "parsed" ? (
          <div className="source-link-list">
            {parsedSourceLinks.links.length > 0 ? (
              parsedSourceLinks.links.map((sourceLink, index) => {
                const documentReference = findDocumentSourceReference(sourceLink);

                if (documentReference) {
                  return (
                    <button
                      className="source-link-document-button"
                      disabled={loadingDocumentId === documentReference.documentId}
                      key={index}
                      onClick={() => handleOpenDocument(documentReference.documentId)}
                      type="button"
                    >
                      {loadingDocumentId === documentReference.documentId
                        ? "Načítám dokument…"
                        : documentReference.label}
                    </button>
                  );
                }

                return (
                  <pre className="source-link-row" key={index}>
                    {formatSourceLink(sourceLink)}
                  </pre>
                );
              })
            ) : (
              <p className="source-link-empty">Podklady nejsou uvedeny.</p>
            )}
          </div>
        ) : null}
        {documentLoadError ? (
          <p className="status-message error-message source-link-error">{documentLoadError}</p>
        ) : null}
      </section>
    </section>
  );
}

export function RightContextPanel({
  planningPanel,
  documentAnalysis,
  showDocumentAnalysis,
  onShowDocumentAnalysis,
  caseId,
  mode,
  activeTab,
  activeAnalysisInsights,
  hoveredBookmarkPinId,
  onActiveTabChange,
  selectedDocument,
  selectedJournalItem,
  documentListRefreshKey,
  isBookmarkLinkMode,
  onAnalysisCreated,
  onBookmarkSelectedForLink,
  onDocumentUploaded,
  onDocumentRemoved,
  onOpenDocument,
  onOpenSourceDocument,
  onSituationDocumentLinked,
  selectedSituationId,
  targetPinId,
  targetSourceRange,
  contextualPinIds
}: {
  planningPanel: ReactNode;
  documentAnalysis: ReactNode;
  showDocumentAnalysis: boolean;
  onShowDocumentAnalysis: (show: boolean) => void;
  caseId: string;
  mode: RightPanelMode;
  activeTab: RightPanelTab;
  activeAnalysisInsights: DocumentInsight[];
  hoveredBookmarkPinId: string | null;
  onActiveTabChange: (tab: RightPanelTab) => void;
  selectedDocument: CaseDocument | null;
  selectedJournalItem: JournalItem | null;
  documentListRefreshKey: number;
  isBookmarkLinkMode: boolean;
  onAnalysisCreated: (document: CaseDocument) => void;
  onBookmarkSelectedForLink: (pin: DocumentPin) => void;
  onDocumentUploaded: (document: CaseDocument) => void;
  onDocumentRemoved: (documentId: string, situationId: string) => void;
  onOpenDocument: (document: CaseDocument) => void;
  onOpenSourceDocument: (documentId: string) => Promise<boolean>;
  onSituationDocumentLinked: () => void;
  selectedSituationId: string | null;
  targetPinId: string | null;
  targetSourceRange: SourceTarget | null;
  contextualPinIds: string[];
}) {
  const [isCaseDocumentListVisible, setIsCaseDocumentListVisible] = useState(false);
  const documentUploadRef = useRef<DocumentUploadHandle | null>(null);
  const documentListOverlayRef = useRef<HTMLDivElement | null>(null);
  const documentListToggleRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isCaseDocumentListVisible) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (documentListOverlayRef.current?.contains(target)) {
        return;
      }

      if (documentListToggleRef.current?.contains(target)) {
        return;
      }

      setIsCaseDocumentListVisible(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isCaseDocumentListVisible]);

  return (
    <aside className="workspace-panel context-panel" aria-labelledby="context-title">
      <h2 className="sr-only" id="context-title">Dokumenty a podklady</h2>

      <div className="right-panel-tabs" role="tablist" aria-label="Pravý panel">
        <button
          aria-selected={activeTab === "documents"}
          className={`right-panel-tab${activeTab === "documents" ? " selected-right-panel-tab" : ""}`}
          onClick={() => onActiveTabChange("documents")}
          role="tab"
          type="button"
        >
          Dokument
        </button>
        <button
          aria-selected={activeTab === "analysis"}
          className={`right-panel-tab${activeTab === "analysis" ? " selected-right-panel-tab" : ""}`}
          onClick={() => onActiveTabChange("analysis")}
          role="tab"
          type="button"
        >
          Analýza
        </button>
        <button
          aria-selected={activeTab === "plan"}
          className={`right-panel-tab${activeTab === "plan" ? " selected-right-panel-tab" : ""}`}
          onClick={() => onActiveTabChange("plan")}
          role="tab"
          type="button"
        >
          Plán
        </button>

        <div className="right-panel-tab-actions" aria-label="Akce dokumentů">
          <button
            className="right-panel-icon-action"
            onClick={() => documentUploadRef.current?.openFilePicker()}
            title="Nahrát dokument"
            type="button"
          >
            <ArrowUpTrayIcon aria-hidden="true" className="right-panel-action-icon" />
          </button>
          <button
            aria-pressed={isCaseDocumentListVisible}
            className="right-panel-icon-action"
            onClick={() => setIsCaseDocumentListVisible((current) => !current)}
            ref={documentListToggleRef}
            title="Zobrazit / skrýt seznam dokumentů"
            type="button"
          >
            <FolderIcon aria-hidden="true" className="right-panel-action-icon" />
          </button>
        </div>
      </div>

      <div className="right-panel-tab-content" hidden={activeTab !== "documents"}>
          {documentAnalysis ? <div className="document-analysis-navigation"><button type="button" onClick={() => onShowDocumentAnalysis(false)}>Dokument</button><button type="button" onClick={() => onShowDocumentAnalysis(true)}>Podrobná analýza</button></div> : null}
          <div className="document-source-shell" hidden={showDocumentAnalysis}>
        <DocumentUpload
          caseId={caseId}
          onSituationDocumentLinked={onSituationDocumentLinked}
          onUploaded={onDocumentUploaded}
          ref={documentUploadRef}
          selectedSituationId={selectedSituationId}
        />


          {isCaseDocumentListVisible ? (
            <div ref={documentListOverlayRef}>
              <DocumentList
                caseId={caseId}
                onOpenDocument={onOpenDocument}
                refreshKey={documentListRefreshKey}
              />
            </div>
          ) : null}

          {selectedDocument ? (
            <DocumentViewPanel
              document={selectedDocument}
              activeAnalysisInsights={activeAnalysisInsights}
              hoveredBookmarkPinId={hoveredBookmarkPinId}
              isBookmarkLinkMode={isBookmarkLinkMode}
              onAnalysisCreated={onAnalysisCreated}
              onBookmarkSelectedForLink={onBookmarkSelectedForLink}
              onDocumentRemoved={onDocumentRemoved}
              selectedSituationId={selectedSituationId}
              targetPinId={targetPinId}
              targetSourceRange={targetSourceRange}
              contextualPinIds={contextualPinIds}
            />
          ) : (
            <div className="right-panel-placeholder compact-right-placeholder">
              <h2>Dokument</h2>
              <p className="panel-note">
                Vyberte dokument v zápisníku nebo nahrajte nový dokument.
              </p>
            </div>
          )}
          </div>
          <div className="document-analysis-shell" hidden={!showDocumentAnalysis}>{documentAnalysis}</div>
        </div>

      <div hidden={activeTab === "documents"} className="right-panel-tab-content situation-panel-shell">{planningPanel}</div>
    </aside>
  );
}

export function ThreePanelWorkspace({ caseItem }: { caseItem: CaseSummary }) {
  const [currentCaseTitle, setCurrentCaseTitle] = useState(caseItem.title);
  const [currentCaseIcon, setCurrentCaseIcon] = useState(caseItem.icon);
  const [currentCaseIconColor, setCurrentCaseIconColor] = useState(caseItem.icon_color);
  const [isSavingCaseMeta, setIsSavingCaseMeta] = useState(false);
  const [isEditingCaseTitle, setIsEditingCaseTitle] = useState(false);
  const [caseTitleDraft, setCaseTitleDraft] = useState(caseItem.title);
  const [isSavingCaseTitle, setIsSavingCaseTitle] = useState(false);
  const [caseTitleError, setCaseTitleError] = useState<string | null>(null);
  const [isDeletingCase, setIsDeletingCase] = useState(false);
  const [caseDeleteError, setCaseDeleteError] = useState<string | null>(null);
  const [isCaseMenuOpen, setIsCaseMenuOpen] = useState(false);
  const [isCaseMetaEditorOpen, setIsCaseMetaEditorOpen] = useState(false);
  const [, setJournalRefreshKey] = useState(0);
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>("help");
  const [showDocumentAnalysis, setShowDocumentAnalysis] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("documents");
  const [selectedDocument, setSelectedDocument] = useState<CaseDocument | null>(null);
  const [activeAnalysisDocument, setActiveAnalysisDocument] = useState<CaseDocument | null>(null);
  const [activeAnalysisInsights, setActiveAnalysisInsights] = useState<DocumentInsight[]>([]);
  const [hoveredBookmarkPinId, setHoveredBookmarkPinId] = useState<string | null>(null);
  const [selectedJournalItem, setSelectedJournalItem] = useState<JournalItem | null>(null);
  const [documentListRefreshKey, setDocumentListRefreshKey] = useState(0);
  const [situationDocumentListRefreshKey, setSituationDocumentListRefreshKey] = useState(0);
  const [selectedSituationId, setSelectedSituationId] = useState<string | null>(null);
  const selectedSituationIdRef = useRef(selectedSituationId);
  const [selectedStepKey, setSelectedStepKey] = useState<WorkflowStepKey | null>(null);
  const [pendingBookmarkTargetJournalItemId, setPendingBookmarkTargetJournalItemId] = useState<string | null>(null);
  const [targetDocumentPinId, setTargetDocumentPinId] = useState<string | null>(null);
  const [targetSourceRange, setTargetSourceRange] = useState<SourceTarget | null>(null);
  const sourceNavigationRef = useRef(0);
  const referenceNavigationRef = useRef(0);
  const [targetAnalysisInsight, setTargetAnalysisInsight] = useState<{ analysisDocumentId: string; insightId: string; token: number } | null>(null);
  const [journalPinContext, setJournalPinContext] = useState<{ situationId: string | null; pinIds: string[] }>({ situationId: null, pinIds: [] });
  const handleContextualPinsChange = useCallback((situationId: string | null, pinIds: string[]) => {
    setJournalPinContext((current) => current.situationId === situationId && current.pinIds.join("|") === pinIds.join("|") ? current : { situationId, pinIds });
  }, []);

  useEffect(() => {
    selectedSituationIdRef.current = selectedSituationId;
  }, [selectedSituationId]);

  useEffect(() => {
    setSelectedSituationId(null);
    setSelectedStepKey(null);
  }, [caseItem.id]);

  useEffect(() => {
    const transitioned = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.situationId === selectedSituationIdRef.current && (detail.stepKey === "PLAN" || detail.stepKey === "COLLECTION")) {
        setSelectedStepKey(detail.stepKey);
        setRightPanelTab(detail.stepKey === "PLAN" ? "plan" : "analysis");
      }
    };
    window.addEventListener("bureaucat:workflow-refresh", transitioned);
    return () => window.removeEventListener("bureaucat:workflow-refresh", transitioned);
  }, []);

  const selectSituation = useCallback((situationId: string | null) => {
    referenceNavigationRef.current += 1;
    setTargetAnalysisInsight(null);
    sourceNavigationRef.current += 1;
    setTargetSourceRange(null);
    setPendingBookmarkTargetJournalItemId(null);
    setSelectedSituationId(situationId);
    setSelectedStepKey(null);
  }, []);

  const selectStep = useCallback((stepKey: WorkflowStepKey) => {
    setSelectedStepKey(stepKey);
    if (stepKey === "PLAN") setRightPanelTab("plan");
    else if (stepKey === "ANALYSIS" || stepKey === "COLLECTION") setRightPanelTab("analysis");
  }, []);

  function requestJournalRefresh() {
    setJournalRefreshKey((currentKey) => currentKey + 1);
  }

  useEffect(() => {
    setCurrentCaseTitle(caseItem.title);
    setCaseTitleDraft(caseItem.title);
    setCurrentCaseIcon(caseItem.icon);
    setCurrentCaseIconColor(caseItem.icon_color);
  }, [caseItem.title, caseItem.icon, caseItem.icon_color]);

  function openTitleScreen() {
    window.location.href = "/cases";
  }

  function startCaseTitleEdit() {
    setCaseTitleError(null);
    setCaseTitleDraft(currentCaseTitle);
    setIsCaseMenuOpen(false);
    setIsEditingCaseTitle(true);
  }

  function cancelCaseTitleEdit() {
    setCaseTitleError(null);
    setCaseTitleDraft(currentCaseTitle);
    setIsEditingCaseTitle(false);
  }

  async function saveCaseTitle() {
    const nextTitle = caseTitleDraft.trim();

    if (!nextTitle) {
      setCaseTitleError("Název případu nesmí být prázdný.");
      return;
    }

    if (nextTitle === currentCaseTitle) {
      setIsEditingCaseTitle(false);
      setCaseTitleError(null);
      return;
    }

    setIsSavingCaseTitle(true);
    setCaseTitleError(null);

    try {
      const response = await fetch(`/api/cases/${caseItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: nextTitle })
      });

      const data = (await response.json().catch(() => null)) as { case?: CaseSummary; error?: string } | null;

      if (!response.ok || !data?.case) {
        throw new Error(data?.error ?? "Název případu se nepodařilo uložit.");
      }

      setCurrentCaseTitle(data.case.title);
      setCaseTitleDraft(data.case.title);
      setIsEditingCaseTitle(false);
    } catch (error) {
      setCaseTitleError(error instanceof Error ? error.message : "Název případu se nepodařilo uložit.");
    } finally {
      setIsSavingCaseTitle(false);
    }
  }

  function handleCaseTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveCaseTitle();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelCaseTitleEdit();
    }
  }

  async function saveCaseMetadata(nextIcon: string, nextIconColor: string) {
    setIsSavingCaseMeta(true);
    setCaseTitleError(null);

    try {
      const response = await fetch(`/api/cases/${caseItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          icon: nextIcon,
          icon_color: nextIconColor
        })
      });

      const data = (await response.json().catch(() => null)) as { case?: CaseSummary; error?: string } | null;

      if (!response.ok || !data?.case) {
        throw new Error(data?.error ?? "Metadata případu se nepodařilo uložit.");
      }

      setCurrentCaseIcon(data.case.icon);
      setCurrentCaseIconColor(data.case.icon_color);
    } catch (error) {
      setCaseTitleError(error instanceof Error ? error.message : "Metadata případu se nepodařilo uložit.");
    } finally {
      setIsSavingCaseMeta(false);
    }
  }

  async function deleteCurrentCase() {
    const confirmed = window.confirm(
      `Smazat případ "${currentCaseTitle}"?\n\nTato operace je nevratná. Budou smazány všechny sešity, poznatky, dokumenty, analýzy, bookmarky, anotace, chat i originální soubory.`
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingCase(true);
    setCaseDeleteError(null);

    try {
      const response = await fetch(`/api/cases/${caseItem.id}?deleteUploadedFiles=true`, {
        method: "DELETE"
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Případ se nepodařilo smazat.");
      }

      window.location.href = "/cases";
    } catch (error) {
      setCaseDeleteError(error instanceof Error ? error.message : "Případ se nepodařilo smazat.");
      setIsDeletingCase(false);
    }
  }

  function openDocument(document: CaseDocument, pinId: string | null = null) {
    referenceNavigationRef.current += 1;
    sourceNavigationRef.current += 1;
    setTargetSourceRange(null);
    setSelectedDocument(document);
    if (activeAnalysisDocument && activeAnalysisDocument.parent_document_id !== document.id) {
      setActiveAnalysisDocument(null);
      setActiveAnalysisInsights([]);
      setTargetAnalysisInsight(null);
    }
    setTargetDocumentPinId(pinId);
    window.setTimeout(() => {
      setTargetDocumentPinId((currentPinId) => currentPinId === pinId ? null : currentPinId);
    }, 1600);
    setRightPanelMode("document");
    setRightPanelTab("documents");
    setShowDocumentAnalysis(false);
  }

  async function openSourceDocument(documentId: string, pinId: string | null = null) {
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`);
      const data = (await response.json()) as DocumentResponse;

      if (!response.ok || !data.document) {
        return false;
      }

      openDocument(data.document, pinId);
      return true;
    } catch {
      return false;
    }
  }

  function handleSituationDocumentLinked() {
    setSituationDocumentListRefreshKey((currentKey) => currentKey + 1);
  }

  function handleDocumentRemoved(documentId: string, situationId: string) {
    setSituationDocumentListRefreshKey((currentKey) => currentKey + 1);
    if (selectedSituationIdRef.current === situationId) {
      setSelectedDocument((current) => current?.id === documentId ? null : current);
      setSelectedJournalItem(null);
      setActiveAnalysisDocument(null);
      setActiveAnalysisInsights([]);
      setHoveredBookmarkPinId(null);
      setTargetDocumentPinId(null);
      setPendingBookmarkTargetJournalItemId(null);
    }
    window.dispatchEvent(new CustomEvent("bureaucat:journal-refresh"));
    window.dispatchEvent(new CustomEvent("bureaucat:document-pins-refresh"));
  }

  function handleDocumentUploaded(document: CaseDocument) {
    setDocumentListRefreshKey((currentKey) => currentKey + 1);
    openDocument(document);
  }

  async function handleOpenJournalSource(source: JournalSource) {
    const request = ++sourceNavigationRef.current;
    const situationId = selectedSituationIdRef.current;
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(source.documentId)}`, { cache: "no-store" });
      const data = await response.json() as { document?: CaseDocument };
      if (!response.ok || !data.document || request !== sourceNavigationRef.current || situationId !== selectedSituationIdRef.current) return false;
      openDocument(data.document, source.pinId);
      setShowDocumentAnalysis(false);
      setTargetSourceRange({ ...source, token: request });
      return true;
    } catch { return false; }
  }

  const handleOpenAnalysisSourceReference = (reference: AnalysisReference) => handleOpenJournalSource({
    documentId: reference.sourceDocumentId, documentName: "", pinId: reference.pinId, insightId: reference.insightId,
    startOffset: reference.startOffset, endOffset: reference.endOffset, quote: reference.quote
  });

  useEffect(() => {
    let active = true;
    const open = async (event: Event) => {
      const reference = (event as CustomEvent<AnalysisReference>).detail;
      if (!reference?.analysisDocumentId || !reference.insightId) return;
      const request = ++referenceNavigationRef.current;
      const situationId = selectedSituationIdRef.current;
      try {
        const response = await fetch(`/api/documents/${encodeURIComponent(reference.analysisDocumentId)}`, { cache: "no-store" });
        const data = await response.json() as { document?: CaseDocument };
        if (!active || request !== referenceNavigationRef.current || situationId !== selectedSituationIdRef.current ||
            !response.ok || !data.document || data.document.case_id !== caseItem.id || data.document.document_type !== "analysis") return;
        setActiveAnalysisDocument(data.document);
        setShowDocumentAnalysis(true);
        setRightPanelTab("documents");
        setSelectedStepKey("ANALYSIS");
        setTargetAnalysisInsight({ analysisDocumentId: data.document.id, insightId: reference.insightId, token: request });
      } catch { /* Navigation is read-only; keep the current panels on failure. */ }
    };
    window.addEventListener("bureaucat:open-analysis-reference", open);
    return () => { active = false; referenceNavigationRef.current += 1; sourceNavigationRef.current += 1; window.removeEventListener("bureaucat:open-analysis-reference", open); };
  }, [caseItem.id]);

  async function handleOpenJournalBookmark(documentId: string, pinId: string) {
    await openSourceDocument(documentId, pinId);
  }

  async function handleBookmarkSelectedForLink(pin: DocumentPin) {
    if (!pendingBookmarkTargetJournalItemId || !selectedDocument) {
      return;
    }

    const response = await fetch(`/api/journal/${pendingBookmarkTargetJournalItemId}/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin_id: pin.id })
    });

    if (response.ok) {
      const data = (await response.json()) as { journalItem?: JournalItem };
      setPendingBookmarkTargetJournalItemId(null);
      setJournalRefreshKey((currentKey) => currentKey + 1);
      window.dispatchEvent(
        new CustomEvent("bureaucat:journal-item-updated", {
          detail: data.journalItem
        })
      );
      window.dispatchEvent(new CustomEvent("bureaucat:journal-refresh"));
    }
  }

  return (
    <div className="workspace-shell">
      <header className="workspace-header app-case-header">
        <button
          type="button"
          className="app-logo-button"
          onClick={openTitleScreen}
          aria-label="Zpět na titulní obrazovku"
          title="Zpět na titulní obrazovku"
        >
          <img
            src="/bureaucat_logo.png"
            alt="BureauCat"
            className="app-logo-image"
          />
        </button>

        <div className="app-case-title-block">
          <span
            className="app-case-icon-badge"
            style={{ "--case-icon-color": currentCaseIconColor } as React.CSSProperties}
            aria-hidden="true"
          >
            {(() => {
              const CurrentCaseIcon = getCaseIcon(currentCaseIcon);
              return <CurrentCaseIcon className="app-case-icon-svg" />;
            })()}
          </span>
          {isEditingCaseTitle ? (
            <div className="app-case-title-edit">
              <input
                className="app-case-title-input"
                value={caseTitleDraft}
                onChange={(event) => setCaseTitleDraft(event.target.value)}
                onBlur={() => {
                  void saveCaseTitle();
                }}
                onKeyDown={handleCaseTitleKeyDown}
                disabled={isSavingCaseTitle}
                autoFocus
                aria-label="Název případu"
              />
              {caseTitleError ? (
                <p className="app-case-title-error">{caseTitleError}</p>
              ) : null}
            </div>
          ) : (
            <h1
              onDoubleClick={startCaseTitleEdit}
              title="Dvojklikem upravit název případu"
            >
              {currentCaseTitle}
            </h1>
          )}
        </div>

        <div className="app-case-header-actions">
          <span className="status-pill app-status-pill">
            {CASE_STATUS_LABELS[caseItem.status]}
          </span>

          <div className="app-case-menu-wrap">
            <button
              type="button"
              className="app-case-menu-button"
              onClick={() => setIsCaseMenuOpen((isOpen) => !isOpen)}
              aria-label="Menu případu"
              aria-expanded={isCaseMenuOpen}
              title="Menu případu"
            >
              ⋮
            </button>

            {isCaseMenuOpen ? (
              <div className="app-case-menu" role="menu">
                <button
                  type="button"
                  className="app-case-menu-item"
                  onClick={startCaseTitleEdit}
                  role="menuitem"
                >
                  Přejmenovat případ
                </button>

                <button
                  type="button"
                  className="app-case-menu-item"
                  onClick={() => setIsCaseMetaEditorOpen((isOpen) => !isOpen)}
                  role="menuitem"
                >
                  Změnit ikonu
                </button>

                {isCaseMetaEditorOpen ? (
                  <div className="app-case-meta-picker" aria-label="Nastavení ikony a barvy případu">
                    <div className="app-case-menu-label">Ikona</div>
                    <div className="app-case-icon-options">
                      {CASE_ICON_OPTIONS.map(({ key, label, Icon }) => (
                        <button
                          key={key}
                          type="button"
                          className={`app-case-icon-option ${currentCaseIcon === key ? "is-selected" : ""}`}
                          onClick={() => void saveCaseMetadata(key, currentCaseIconColor)}
                          disabled={isSavingCaseMeta}
                          title={label}
                          aria-label={`Ikona: ${label}`}
                        >
                          <Icon className="app-case-icon-option-svg" />
                        </button>
                      ))}
                    </div>

                    <div className="app-case-menu-label">Barva</div>
                    <div className="app-case-color-options">
                      {CASE_COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`app-case-color-option ${currentCaseIconColor === color ? "is-selected" : ""}`}
                          style={{ "--case-icon-color": color } as React.CSSProperties}
                          onClick={() => void saveCaseMetadata(currentCaseIcon, color)}
                          disabled={isSavingCaseMeta}
                          aria-label={`Barva případu ${color}`}
                          title={color}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="app-case-menu-item danger"
                  onClick={deleteCurrentCase}
                  disabled={isDeletingCase}
                  role="menuitem"
                >
                  {isDeletingCase ? "Mažu…" : "Smazat případ"}
                </button>

                {caseDeleteError ? (
                  <p className="app-case-delete-error">{caseDeleteError}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <div className="three-panel-layout workflow-shell-layout" aria-label="Pracovní prostor případu: Workflow, aktivní krok a dokumenty">
        <WorkflowRail
          caseId={caseItem.id}
          onSelectSituation={selectSituation}
          onSelectStep={selectStep}
          selectedSituationId={selectedSituationId}
          selectedStepKey={selectedStepKey}
        />
        <StepWorkspace
          activeAnalysisDocument={activeAnalysisDocument}
          caseItem={caseItem}
          documentListRefreshKey={situationDocumentListRefreshKey}
          hoveredBookmarkPinId={hoveredBookmarkPinId}
          onActiveAnalysisInsightsChange={setActiveAnalysisInsights}
          onBookmarkHover={setHoveredBookmarkPinId}
          onBookmarkLeave={() => setHoveredBookmarkPinId(null)}
          onCloseAnalysisDocument={() => {
            referenceNavigationRef.current += 1;
            setTargetAnalysisInsight(null);
            setActiveAnalysisDocument(null);
            setActiveAnalysisInsights([]);
          }}
          onJournalRefreshRequested={requestJournalRefresh}
          onOpenAnalysisSourceDocument={openSourceDocument}
          onOpenAnalysisSourceReference={handleOpenAnalysisSourceReference}
          targetAnalysisInsight={targetAnalysisInsight}
          onOpenBookmark={handleOpenJournalBookmark}
          onOpenJournalSource={handleOpenJournalSource}
          onContextualPinsChange={handleContextualPinsChange}
          onOpenDocument={openDocument}
          onSelectSituation={selectSituation}
          onStartBookmarkLink={setPendingBookmarkTargetJournalItemId}
          pendingBookmarkTargetJournalItemId={pendingBookmarkTargetJournalItemId}
          selectedSituationId={selectedSituationId}
          selectedStepKey={selectedStepKey}
        />
        <RightContextPanel
          planningPanel={selectedSituationId ? <SituationPlanningPanel key={`${caseItem.id}:${selectedSituationId}`} caseId={caseItem.id} situationId={selectedSituationId}
            view={rightPanelTab === "plan" ? "PLAN" : "ANALYSIS"} refreshKey={situationDocumentListRefreshKey} onOpenSource={handleOpenJournalSource} onSelectPlan={() => setRightPanelTab("plan")} /> : <p>Vyberte situaci.</p>}
          showDocumentAnalysis={showDocumentAnalysis && Boolean(activeAnalysisDocument)}
          onShowDocumentAnalysis={setShowDocumentAnalysis}
          documentAnalysis={activeAnalysisDocument ? <ChatPanel activeAnalysisDocument={activeAnalysisDocument} caseItem={caseItem}
            onActiveAnalysisInsightsChange={setActiveAnalysisInsights} onCloseAnalysisDocument={() => { referenceNavigationRef.current += 1; setTargetAnalysisInsight(null); setShowDocumentAnalysis(false); setActiveAnalysisDocument(null); setActiveAnalysisInsights([]); }}
            onOpenAnalysisSourceDocument={(id) => { void openSourceDocument(id); setShowDocumentAnalysis(false); }}
            onOpenAnalysisSourceReference={handleOpenAnalysisSourceReference} targetAnalysisInsight={targetAnalysisInsight}
            onJournalRefreshRequested={requestJournalRefresh} selectedSituationId={selectedSituationId} hoveredBookmarkPinId={hoveredBookmarkPinId} /> : null}
          caseId={caseItem.id}
          activeTab={rightPanelTab}
          activeAnalysisInsights={activeAnalysisInsights}
          documentListRefreshKey={documentListRefreshKey}
          hoveredBookmarkPinId={hoveredBookmarkPinId}
          isBookmarkLinkMode={pendingBookmarkTargetJournalItemId !== null}
          mode={rightPanelMode}
          onActiveTabChange={setRightPanelTab}
          onAnalysisCreated={(document) => {
            setActiveAnalysisDocument(document);
            setShowDocumentAnalysis(true);
            setRightPanelTab("documents");
            setSelectedStepKey("ANALYSIS");
            setDocumentListRefreshKey((currentKey) => currentKey + 1);
          }}
          onBookmarkSelectedForLink={handleBookmarkSelectedForLink}
          onDocumentUploaded={handleDocumentUploaded}
          onDocumentRemoved={handleDocumentRemoved}
          onOpenDocument={openDocument}
          onOpenSourceDocument={openSourceDocument}
          onSituationDocumentLinked={handleSituationDocumentLinked}
          selectedDocument={selectedDocument}
          selectedJournalItem={selectedJournalItem}
          selectedSituationId={selectedSituationId}
          targetPinId={targetDocumentPinId}
          targetSourceRange={targetSourceRange}
          contextualPinIds={journalPinContext.situationId === selectedSituationId ? journalPinContext.pinIds : []}
        />
      </div>
    </div>
  );
}
