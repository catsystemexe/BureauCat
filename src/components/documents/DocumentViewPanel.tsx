"use client";

import type { CaseDocument } from "@/components/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}


export function DocumentViewPanel({ document }: { document: CaseDocument }) {
  return (
    <article className="document-view-panel" aria-labelledby="document-view-title">
      <div className="document-view-header">
        <div className="document-title-row">
          <h2 id="document-view-title">{document.filename}</h2>
          <span className="document-upload-date">Dokument nahrán {formatDate(document.created_at)}</span>
        </div>
      </div>

      <section className="document-view-section document-content-section" aria-label="Obsah dokumentu">
        <button
          aria-label="Zobrazit obsah na celou obrazovku"
          className="document-fullscreen-button"
          type="button"
        >
          ⛶
        </button>
        {document.extracted_text && document.extracted_text.trim().length > 0 ? (
          <pre className="document-extracted-text">{document.extracted_text}</pre>
        ) : (
          <p className="panel-note">Extrahovaný text pro tento dokument není k dispozici.</p>
        )}
      </section>
    </article>
  );
}
