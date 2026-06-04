"use client";

import { useEffect, useState } from "react";
import type { CaseDocument } from "@/components/types";

type DocumentListResponse = {
  documents?: CaseDocument[];
  error?: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
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
          throw new Error(data.error ?? "Unable to load documents.");
        }

        if (!Array.isArray(data.documents)) {
          throw new Error("Document list response did not include documents.");
        }

        if (isActive) {
          setDocuments(data.documents);
        }
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load documents.");
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
        <p className="panel-kicker">Documents</p>
        <h3 id="document-list-title">Uploaded documents</h3>
      </div>

      {isLoading ? <p className="panel-note">Loading documents…</p> : null}
      {error ? <p className="status-message error-message">{error}</p> : null}
      {!isLoading && !error && documents.length === 0 ? (
        <p className="panel-note">No documents uploaded for this case yet.</p>
      ) : null}

      {!isLoading && !error && documents.length > 0 ? (
        <ul className="document-list">
          {documents.map((document) => (
            <li key={document.id}>
              <button
                className="document-list-item"
                onClick={() => onOpenDocument(document)}
                type="button"
              >
                <span className="document-list-filename">{document.filename}</span>
                <span className="document-list-meta">
                  <span>{document.filetype.toUpperCase()}</span>
                  <span>{formatDate(document.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
