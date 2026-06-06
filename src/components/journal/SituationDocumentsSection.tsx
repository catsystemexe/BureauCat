"use client";

import { useEffect, useState } from "react";
import type { CaseDocument } from "@/components/types";

type SituationDocumentsResponse = {
  documents?: CaseDocument[];
};

export function SituationDocumentsSection({
  onOpenDocument,
  refreshKey,
  selectedSituationId
}: {
  onOpenDocument: (document: CaseDocument) => void;
  refreshKey: number;
  selectedSituationId: string | null;
}) {
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!selectedSituationId) {
      setDocuments([]);
      setIsLoading(false);
      setError(null);
      return () => {
        isMounted = false;
      };
    }

    async function loadDocuments() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/situations/${selectedSituationId}/documents`, {
          cache: "no-store"
        });
        const data = (await response.json()) as SituationDocumentsResponse;

        if (!response.ok || !Array.isArray(data.documents)) {
          throw new Error("Nepodařilo se načíst dokumenty situace.");
        }

        if (isMounted) {
          setDocuments(data.documents);
        }
      } catch {
        if (isMounted) {
          setDocuments([]);
          setError("Nepodařilo se načíst dokumenty situace.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDocuments();

    return () => {
      isMounted = false;
    };
  }, [refreshKey, selectedSituationId]);

  return (
    <section className="situation-documents-section" aria-labelledby="situation-documents-title">
      <h2 id="situation-documents-title">Dokumenty</h2>
      {isLoading ? <p className="journal-empty-message">Načítám dokumenty…</p> : null}
      {error ? <p className="status-message error-message">{error}</p> : null}
      {!isLoading && !error && documents.length === 0 ? (
        <p className="journal-empty-message">Zatím žádné dokumenty k této situaci.</p>
      ) : null}
      {!isLoading && !error && documents.length > 0 ? (
        <ul className="situation-document-list">
          {documents.map((document) => (
            <li key={document.id}>
              <button
                aria-label={`Otevřít dokument ${document.filename}`}
                className="situation-document-button"
                onClick={() => onOpenDocument(document)}
                type="button"
              >
                {document.filename}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
