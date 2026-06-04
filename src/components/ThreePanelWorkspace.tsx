"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { DocumentList } from "@/components/documents/DocumentList";
import { DocumentUpload } from "@/components/documents/DocumentUpload";
import { DocumentViewPanel } from "@/components/documents/DocumentViewPanel";
import { JournalPanel } from "@/components/journal/JournalPanel";
import type { CaseDocument, CaseSummary } from "./types";

type RightPanelMode = "help" | "evidence" | "document";

export function MiddleChatPanel({
  caseItem,
  onJournalRefreshRequested
}: {
  caseItem: CaseSummary;
  onJournalRefreshRequested: () => void;
}) {
  return <ChatPanel caseItem={caseItem} onJournalRefreshRequested={onJournalRefreshRequested} />;
}

export function RightContextPanel({
  caseId,
  mode,
  selectedDocument,
  documentListRefreshKey,
  onDocumentUploaded,
  onOpenDocument
}: {
  caseId: string;
  mode: RightPanelMode;
  selectedDocument: CaseDocument | null;
  documentListRefreshKey: number;
  onDocumentUploaded: (document: CaseDocument) => void;
  onOpenDocument: (document: CaseDocument) => void;
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
      ) : (
        <div className="right-panel-placeholder">
          <p className="panel-kicker">Context panel</p>
          <h2>{mode === "evidence" ? "Evidence Panel" : "Help State"}</h2>
          <p className="panel-note">
            {mode === "evidence"
              ? "Evidence Panel placeholder for selected Journal item evidence."
              : "Default right panel guidance. Upload a document to open Document View here."}
          </p>
          <div className="context-state-list">
            <div className={`context-state ${mode === "help" ? "active-state" : ""}`}>
              <strong>Help State</strong>
              <span>Default guidance and uploaded document list.</span>
            </div>
            <div className={`context-state ${mode === "evidence" ? "active-state" : ""}`}>
              <strong>Evidence Panel</strong>
              <span>Placeholder for selected Journal item evidence.</span>
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
  const [documentListRefreshKey, setDocumentListRefreshKey] = useState(0);

  function requestJournalRefresh() {
    setJournalRefreshKey((currentKey) => currentKey + 1);
  }

  function openDocument(document: CaseDocument) {
    setSelectedDocument(document);
    setRightPanelMode("document");
  }

  function handleDocumentUploaded(document: CaseDocument) {
    setDocumentListRefreshKey((currentKey) => currentKey + 1);
    openDocument(document);
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
        <JournalPanel caseItem={caseItem} refreshKey={journalRefreshKey} />
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
          selectedDocument={selectedDocument}
        />
      </div>
    </div>
  );
}
