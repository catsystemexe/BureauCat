import { JournalPanel } from "@/components/journal/JournalPanel";
import type { CaseSummary } from "./types";

export function MiddleChatPanel({ caseItem }: { caseItem: CaseSummary }) {
  return (
    <main className="workspace-panel chat-panel" aria-labelledby="chat-title">
      <div>
        <p className="panel-kicker">Chat</p>
        <h2 id="chat-title">Workspace chat</h2>
        <p className="panel-note">Chat remains visible in the middle panel for case {caseItem.id}.</p>
      </div>
      <div className="chat-placeholder">
        <p>Chat placeholder</p>
        <small>Real message sending is outside this task.</small>
      </div>
    </main>
  );
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
        <JournalPanel caseItem={caseItem} />
        <MiddleChatPanel caseItem={caseItem} />
        <RightContextPanel />
      </div>
    </div>
  );
}
