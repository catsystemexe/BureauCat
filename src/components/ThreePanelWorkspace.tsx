"use client";

import { useState } from "react";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { JournalPanel } from "@/components/journal/JournalPanel";
import type { CaseSummary } from "./types";

export function MiddleChatPanel({
  caseItem,
  onJournalRefreshRequested
}: {
  caseItem: CaseSummary;
  onJournalRefreshRequested: () => void;
}) {
  return <ChatPanel caseItem={caseItem} onJournalRefreshRequested={onJournalRefreshRequested} />;
}

export function RightContextPanel() {
  return (
    <aside className="workspace-panel context-panel" aria-labelledby="context-title">
      <p className="panel-kicker">Context panel</p>
      <h2 id="context-title">Help State</h2>
      <p className="panel-note">Default right panel placeholder.</p>
      <div className="context-state-list">
        <div className="context-state active-state">
          <strong>Help State</strong>
          <span>Default guidance placeholder.</span>
        </div>
        <div className="context-state">
          <strong>Evidence Panel</strong>
          <span>Placeholder for selected Journal item evidence.</span>
        </div>
        <div className="context-state">
          <strong>Document View</strong>
          <span>Placeholder for document content.</span>
        </div>
      </div>
    </aside>
  );
}

export function ThreePanelWorkspace({ caseItem }: { caseItem: CaseSummary }) {
  const [journalRefreshKey, setJournalRefreshKey] = useState(0);

  function requestJournalRefresh() {
    setJournalRefreshKey((currentKey) => currentKey + 1);
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
        <RightContextPanel />
      </div>
    </div>
  );
}
