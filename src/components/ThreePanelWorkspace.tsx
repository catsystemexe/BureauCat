"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { DocumentList } from "@/components/documents/DocumentList";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { DocumentViewPanel } from "@/components/documents/DocumentViewPanel";
import { JournalPanel } from "@/components/journal/JournalPanel";
import {
  CASE_STATUS_LABELS,
  EVIDENCE_STATE_LABELS,
  JOURNAL_ITEM_STATUS_LABELS,
  JOURNAL_ITEM_TYPE_LABELS,
  JOURNAL_SECTION_LABELS
} from "@/lib/constants/uiLabels";
import type { CaseDocument, CaseSummary, JournalItem } from "./types";

type RightPanelMode = "help" | "evidence" | "document";
type RightPanelTab = "documents" | "analysis" | "procedure";

type ParsedSourceLinks =
  | { kind: "empty" }
  | { kind: "parsed"; links: unknown[] }
  | { kind: "raw"; rawValue: string };

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

function normalizeSourceLinkKey(key: string) {
  return key.replaceAll("_", "").replaceAll("-", "").toLowerCase();
}

function getRecordValue(record: Record<string, unknown>, keys: string[]) {
  const normalizedKeys = new Set(keys.map(normalizeSourceLinkKey));

  for (const [key, value] of Object.entries(record)) {
    if (!normalizedKeys.has(normalizeSourceLinkKey(key))) {
      continue;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function extractDocumentIdFromValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    return getRecordValue(value as Record<string, unknown>, ["id", "document_id", "documentId"]);
  }

  return null;
}

function findDocumentSourceReference(sourceLink: unknown): DocumentSourceReference | null {
  if (!sourceLink || typeof sourceLink !== "object" || Array.isArray(sourceLink)) {
    return null;
  }

  const sourceRecord = sourceLink as Record<string, unknown>;
  const typeValue = sourceRecord.type;
  const typeSuggestsDocument =
    typeof typeValue === "string" && typeValue.toLowerCase().includes("document");

  const directDocumentId = getRecordValue(sourceRecord, [
    "document_id",
    "documentId",
    "documentID",
    "doc_id",
    "docId"
  ]);
  const nestedDocumentId = extractDocumentIdFromValue(sourceRecord.document);
  const typedId = typeSuggestsDocument ? getRecordValue(sourceRecord, ["id"]) : null;
  const documentId = directDocumentId ?? nestedDocumentId ?? typedId;

  if (!documentId) {
    return null;
  }

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

export function MiddleChatPanel({
  caseItem,
  onJournalRefreshRequested
}: {
  caseItem: CaseSummary;
  onJournalRefreshRequested: () => void;
}) {
  return <ChatPanel caseItem={caseItem} onJournalRefreshRequested={onJournalRefreshRequested} />;
}

export function EvidencePanel({
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
  caseId,
  mode,
  selectedDocument,
  selectedJournalItem,
  documentListRefreshKey,
  onDocumentUploaded,
  onOpenDocument,
  onOpenSourceDocument,
  onSituationDocumentLinked,
  selectedSituationId
}: {
  caseId: string;
  mode: RightPanelMode;
  selectedDocument: CaseDocument | null;
  selectedJournalItem: JournalItem | null;
  documentListRefreshKey: number;
  onDocumentUploaded: (document: CaseDocument) => void;
  onOpenDocument: (document: CaseDocument) => void;
  onOpenSourceDocument: (documentId: string) => Promise<boolean>;
  onSituationDocumentLinked: () => void;
  selectedSituationId: string | null;
}) {
  const [activeTab, setActiveTab] = useState<RightPanelTab>("documents");
  const [isUploadVisible, setIsUploadVisible] = useState(false);
  const [isCaseDocumentListVisible, setIsCaseDocumentListVisible] = useState(false);
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
          onClick={() => setActiveTab("documents")}
          role="tab"
          type="button"
        >
          Dokument
        </button>
        <button
          aria-selected={activeTab === "analysis"}
          className={`right-panel-tab${activeTab === "analysis" ? " selected-right-panel-tab" : ""}`}
          onClick={() => setActiveTab("analysis")}
          role="tab"
          type="button"
        >
          Analýza
        </button>
        <button
          aria-selected={activeTab === "procedure"}
          className={`right-panel-tab${activeTab === "procedure" ? " selected-right-panel-tab" : ""}`}
          onClick={() => setActiveTab("procedure")}
          role="tab"
          type="button"
        >
          Postup
        </button>

        <div className="right-panel-tab-actions" aria-label="Akce dokumentů">
          <button
            aria-pressed={isUploadVisible}
            className="right-panel-icon-action"
            onClick={() => setIsUploadVisible((current) => !current)}
            title="Zobrazit / skrýt nahrání dokumentu"
            type="button"
          >
            ⤴
          </button>
          <button
            aria-pressed={isCaseDocumentListVisible}
            className="right-panel-icon-action"
            onClick={() => setIsCaseDocumentListVisible((current) => !current)}
            ref={documentListToggleRef}
            title="Zobrazit / skrýt seznam dokumentů"
            type="button"
          >
            ☰
          </button>
        </div>
      </div>

      {activeTab === "documents" ? (
        <div className="right-panel-tab-content">
          {isUploadVisible ? (
            <DocumentUpload
              caseId={caseId}
              onSituationDocumentLinked={onSituationDocumentLinked}
              onUploaded={onDocumentUploaded}
              selectedSituationId={selectedSituationId}
            />
          ) : null}

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
            <DocumentViewPanel document={selectedDocument} />
          ) : mode === "evidence" && selectedJournalItem ? (
            <EvidencePanel
              journalItem={selectedJournalItem}
              key={selectedJournalItem.id}
              onOpenDocument={onOpenSourceDocument}
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
      ) : null}

      {activeTab === "analysis" ? (
        <div className="right-panel-tab-content right-panel-placeholder compact-right-placeholder">
          <h2>Analýza</h2>
          <p className="panel-note">Zatím bez analýzy.</p>
        </div>
      ) : null}

      {activeTab === "procedure" ? (
        <div className="right-panel-tab-content right-panel-placeholder compact-right-placeholder">
          <h2>Postup</h2>
          <p className="panel-note">Zatím bez návrhu postupu.</p>
        </div>
      ) : null}
    </aside>
  );
}

export function ThreePanelWorkspace({ caseItem }: { caseItem: CaseSummary }) {
  const [, setJournalRefreshKey] = useState(0);
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>("help");
  const [selectedDocument, setSelectedDocument] = useState<CaseDocument | null>(null);
  const [selectedJournalItem, setSelectedJournalItem] = useState<JournalItem | null>(null);
  const [documentListRefreshKey, setDocumentListRefreshKey] = useState(0);
  const [situationDocumentListRefreshKey, setSituationDocumentListRefreshKey] = useState(0);
  const [selectedSituationId, setSelectedSituationId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSituationId(null);
  }, [caseItem.id]);

  const selectSituation = useCallback((situationId: string | null) => {
    setSelectedSituationId(situationId);
  }, []);

  function requestJournalRefresh() {
    setJournalRefreshKey((currentKey) => currentKey + 1);
  }

  function openDocument(document: CaseDocument) {
    setSelectedDocument(document);
    setRightPanelMode("document");
  }

  async function openSourceDocument(documentId: string) {
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}`);
      const data = (await response.json()) as DocumentResponse;

      if (!response.ok || !data.document) {
        return false;
      }

      openDocument(data.document);
      return true;
    } catch {
      return false;
    }
  }

  function handleSituationDocumentLinked() {
    setSituationDocumentListRefreshKey((currentKey) => currentKey + 1);
  }

  function handleDocumentUploaded(document: CaseDocument) {
    setDocumentListRefreshKey((currentKey) => currentKey + 1);
    openDocument(document);
  }

  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">BureauCat · Případ</p>
          <h1>{caseItem.title}</h1>
        </div>
        <div className="case-meta">
          <span>{caseItem.area ?? "Oblast není uvedena"}</span>
          <span className="status-pill">{CASE_STATUS_LABELS[caseItem.status]}</span>
        </div>
      </header>
      <div className="three-panel-layout" aria-label="Pracovní prostor případu: Zápisník, Konzultace a Dokumenty">
        <JournalPanel
          caseItem={caseItem}
          documentListRefreshKey={situationDocumentListRefreshKey}
          onOpenDocument={openDocument}
          onSelectSituation={selectSituation}
          selectedSituationId={selectedSituationId}
        />
        <MiddleChatPanel
          caseItem={caseItem}
          onJournalRefreshRequested={requestJournalRefresh}
        />
        <RightContextPanel
          caseId={caseItem.id}
          documentListRefreshKey={documentListRefreshKey}
          mode={rightPanelMode}
          onDocumentUploaded={handleDocumentUploaded}
          onOpenDocument={openDocument}
          onOpenSourceDocument={openSourceDocument}
          onSituationDocumentLinked={handleSituationDocumentLinked}
          selectedDocument={selectedDocument}
          selectedJournalItem={selectedJournalItem}
          selectedSituationId={selectedSituationId}
        />
      </div>
    </div>
  );
}
