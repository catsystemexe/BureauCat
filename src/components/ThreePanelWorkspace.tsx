"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { DocumentList } from "@/components/documents/DocumentList";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { DocumentViewPanel } from "@/components/documents/DocumentViewPanel";
import { JournalPanel } from "@/components/journal/JournalPanel";
import type { CaseDocument, CaseSummary, JournalItem } from "./types";

type RightPanelMode = "help" | "evidence" | "document";

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

function formatDetailLabel(value: string) {
  return value.replaceAll("_", " ");
}

function displayValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "Not provided";
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
    label: documentName ? `Document: ${documentName}` : `Open Document ${documentId}`
  };
}

function formatSourceLink(sourceLink: unknown) {
  if (sourceLink === null || sourceLink === undefined || sourceLink === "") {
    return "Not provided";
  }

  if (
    typeof sourceLink === "string" ||
    typeof sourceLink === "number" ||
    typeof sourceLink === "boolean"
  ) {
    return String(sourceLink);
  }

  try {
    return JSON.stringify(sourceLink, null, 2);
  } catch {
    return "Not provided";
  }
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
        setDocumentLoadError("Unable to load document.");
      }
    } catch {
      setDocumentLoadError("Unable to load document.");
    } finally {
      setLoadingDocumentId(null);
    }
  }

  return (
    <section className="evidence-panel" aria-labelledby="evidence-panel-title">
      <p className="panel-kicker">Evidence Panel</p>
      <h2 id="evidence-panel-title">{displayValue(journalItem.title)}</h2>
      <dl className="evidence-detail-list">
        <div className="evidence-detail-row">
          <dt>Title</dt>
          <dd>{displayValue(journalItem.title)}</dd>
        </div>
        <div className="evidence-detail-row">
          <dt>Section</dt>
          <dd>{displayValue(formatDetailLabel(journalItem.section))}</dd>
        </div>
        <div className="evidence-detail-row">
          <dt>Item type</dt>
          <dd>{displayValue(journalItem.item_type)}</dd>
        </div>
        <div className="evidence-detail-row">
          <dt>Value</dt>
          <dd>{displayValue(journalItem.value)}</dd>
        </div>
        <div className="evidence-detail-row">
          <dt>Explanation</dt>
          <dd>{displayValue(journalItem.explanation)}</dd>
        </div>
        <div className="evidence-detail-row">
          <dt>Evidence state</dt>
          <dd>
            <span className={`evidence-badge evidence-${journalItem.evidence_state}`}>
              {formatDetailLabel(journalItem.evidence_state)}
            </span>
          </dd>
        </div>
        <div className="evidence-detail-row">
          <dt>Status</dt>
          <dd>{displayValue(formatDetailLabel(journalItem.status))}</dd>
        </div>
        <div className="evidence-detail-row">
          <dt>Display order</dt>
          <dd>{displayValue(journalItem.display_order)}</dd>
        </div>
      </dl>

      <section className="source-links-panel" aria-labelledby="source-links-title">
        <h3 id="source-links-title">Source links</h3>
        {parsedSourceLinks.kind === "empty" ? (
          <p className="source-link-empty">Not provided</p>
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
                        ? "Loading document…"
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
              <p className="source-link-empty">Not provided</p>
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
  onOpenSourceDocument
}: {
  caseId: string;
  mode: RightPanelMode;
  selectedDocument: CaseDocument | null;
  selectedJournalItem: JournalItem | null;
  documentListRefreshKey: number;
  onDocumentUploaded: (document: CaseDocument) => void;
  onOpenDocument: (document: CaseDocument) => void;
  onOpenSourceDocument: (documentId: string) => Promise<boolean>;
}) {
  return (
    <aside className="workspace-panel context-panel" aria-labelledby="context-title">
      <h2 className="sr-only" id="context-title">Right context panel</h2>
      <DocumentUpload caseId={caseId} onUploaded={onDocumentUploaded} />

      {selectedDocument && mode !== "document" ? (
        <section className="last-document-card" aria-labelledby="last-document-title">
          <p className="panel-kicker">Selected document</p>
          <h3 id="last-document-title">{selectedDocument.filename}</h3>
          <button
            className="secondary-action"
            onClick={() => onOpenDocument(selectedDocument)}
            type="button"
          >
            Open in Document View
          </button>
        </section>
      ) : null}

      {mode === "document" && selectedDocument ? (
        <DocumentViewPanel document={selectedDocument} />
      ) : mode === "evidence" && selectedJournalItem ? (
        <EvidencePanel
          journalItem={selectedJournalItem}
          key={selectedJournalItem.id}
          onOpenDocument={onOpenSourceDocument}
        />
      ) : (
        <div className="right-panel-placeholder">
          <p className="panel-kicker">Context panel</p>
          <h2>Help State</h2>
          <p className="panel-note">
            Default right panel guidance. Upload a document to open Document View here.
          </p>
          <div className="context-state-list">
            <div className={`context-state ${mode === "help" ? "active-state" : ""}`}>
              <strong>Help State</strong>
              <span>Default guidance and uploaded document list.</span>
            </div>
            <div className={`context-state ${mode === "evidence" ? "active-state" : ""}`}>
              <strong>Evidence Panel</strong>
              <span>Shows selected Journal item evidence.</span>
            </div>
            <div className={`context-state ${mode === "document" ? "active-state" : ""}`}>
              <strong>Document View</strong>
              <span>Shows uploaded document content when a document is selected.</span>
            </div>
          </div>
          {mode === "help" ? (
            <DocumentList
              caseId={caseId}
              onOpenDocument={onOpenDocument}
              refreshKey={documentListRefreshKey}
            />
          ) : null}
        </div>
      )}
    </aside>
  );
}

export function ThreePanelWorkspace({ caseItem }: { caseItem: CaseSummary }) {
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>("help");
  const [selectedDocument, setSelectedDocument] = useState<CaseDocument | null>(null);
  const [selectedJournalItem, setSelectedJournalItem] = useState<JournalItem | null>(null);
  const [documentListRefreshKey, setDocumentListRefreshKey] = useState(0);

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

  function handleDocumentUploaded(document: CaseDocument) {
    setDocumentListRefreshKey((currentKey) => currentKey + 1);
    openDocument(document);
  }

  function selectJournalItem(journalItem: JournalItem) {
    setSelectedJournalItem(journalItem);
    setRightPanelMode("evidence");
  }

  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">BureauCat workspace</p>
          <h1>{caseItem.title}</h1>
        </div>
        <div className="case-meta">
          <span>{caseItem.area ?? "No area set"}</span>
          <span className="status-pill">{caseItem.status}</span>
        </div>
      </header>
      <div className="three-panel-layout" aria-label="Three-panel case workspace">
        <JournalPanel
          caseItem={caseItem}
          onSelectItem={selectJournalItem}
          refreshKey={journalRefreshKey}
          selectedItemId={selectedJournalItem?.id ?? null}
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
          selectedDocument={selectedDocument}
          selectedJournalItem={selectedJournalItem}
        />
      </div>
    </div>
  );
}
