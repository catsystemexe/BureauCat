"use client";

import type { CaseDocument } from "@/components/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderOptionalText(value: string | null, fallback: string) {
  return value && value.trim().length > 0 ? value : fallback;
}

export function DocumentViewPanel({ document }: { document: CaseDocument }) {
  return (
    <article className="document-view-panel" aria-labelledby="document-view-title">
      <div className="document-view-header">
        <p className="panel-kicker">Dokument</p>
        <h2 id="document-view-title">{document.filename}</h2>
        <div className="document-meta-list" aria-label="Podrobnosti dokumentu">
          <span>{document.filetype.toUpperCase()}</span>
          <span>Dokument nahrán {formatDate(document.created_at)}</span>
        </div>
      </div>

      <section className="document-view-section" aria-labelledby="document-summary-title">
        <h3 id="document-summary-title">Shrnutí</h3>
        <p>{renderOptionalText(document.ai_summary, "Shrnutí zatím není k dispozici.")}</p>
      </section>

      <section className="document-view-section" aria-labelledby="document-text-title">
        <h3 id="document-text-title">Extrahovaný text</h3>
        {document.extracted_text && document.extracted_text.trim().length > 0 ? (
          <pre className="document-extracted-text">{document.extracted_text}</pre>
        ) : (
          <p className="panel-note">Extrahovaný text pro tento dokument není k dispozici.</p>
        )}
      </section>

      <section className="document-view-section" aria-labelledby="document-file-title">
        <h3 id="document-file-title">Původní soubor</h3>
        <p className="document-file-path">{document.original_file}</p>
      </section>
    </article>
  );
}
