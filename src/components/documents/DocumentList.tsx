"use client";

import { useEffect, useState } from "react";
import type { CaseDocument } from "@/components/types";

type DocumentListResponse = {
  documents?: CaseDocument[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function DocumentList({
  caseId,
  refreshKey,
  onOpenDocument
}: {
  caseId: string;
  refreshKey: number;
  onOpenDocument: (document: CaseDocument) => void;
}) {
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadDocuments() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/cases/${caseId}/documents`);
        const data = (await response.json()) as DocumentListResponse;

        if (!response.ok) {
          throw new Error("Dokumenty se nepodařilo načíst.");
        }

        if (!Array.isArray(data.documents)) {
          throw new Error("Odpověď neobsahuje seznam dokumentů.");
        }

        if (isActive) {
          setDocuments(data.documents);
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error ? loadError.message : "Dokumenty se nepodařilo načíst."
          );
          setDocuments([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadDocuments();

    return () => {
      isActive = false;
    };
  }, [caseId, refreshKey]);

  return (
    <section className="document-list-card" aria-labelledby="document-list-title">
      <div className="document-list-header">
        <h3 id="document-list-title">Dokumenty</h3>
      </div>

      {isLoading ? <p className="panel-note">Načítám dokumenty…</p> : null}
      {error ? <p className="status-message error-message">{error}</p> : null}
      {!isLoading && !error && documents.length === 0 ? (
        <p className="panel-note">Zatím nebyly nahrány žádné dokumenty.</p>
      ) : null}

      {!isLoading && !error && documents.length > 0 ? (
        <ul className="document-list">
          {documents.map((document) => (
            <li key={document.id}>
              <button
                aria-label={`Otevřít dokument ${document.filename}`}
                className="document-list-item"
                onClick={() => onOpenDocument(document)}
                type="button"
              >
                <span className="document-list-filename">{document.filename}</span>
                <span className="document-list-meta">
                  <span>{document.filetype.toUpperCase()}</span>
                  <span>{formatDate(document.created_at)}</span>
                </span>
                <span className="document-list-open-label">Otevřít dokument</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
