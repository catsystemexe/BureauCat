"use client";

import { useEffect, useState } from "react";
import type { CaseDocument } from "@/components/types";

type SituationDocumentsResponse = {
  documents?: CaseDocument[];
};

function getDocumentIcon(filetype: string, filename: string) {
  const normalizedType = filetype.toLowerCase();
  const normalizedName = filename.toLowerCase();

  if (normalizedType.includes("image") || /\.(jpg|jpeg|png)$/.test(normalizedName)) {
    return { label: "IMG", kind: "image" };
  }

  if (normalizedType.includes("pdf") || normalizedName.endsWith(".pdf")) {
    return { label: "PDF", kind: "pdf" };
  }

  if (normalizedType.includes("word") || /\.docx?$/.test(normalizedName)) {
    return { label: "DOC", kind: "doc" };
  }

  return { label: "TXT", kind: "text" };
}

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
  const [unlinkingDocumentId, setUnlinkingDocumentId] = useState<string | null>(null);
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

  async function handleUnlinkDocument(document: CaseDocument) {
    if (!selectedSituationId) {
      return;
    }

    try {
      setUnlinkingDocumentId(document.id);
      setError(null);
      const response = await fetch(
        `/api/situations/${selectedSituationId}/documents/${document.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Nepodařilo se odpojit dokument.");
      }

      setDocuments((currentDocuments) =>
        currentDocuments.filter((currentDocument) => currentDocument.id !== document.id)
      );
    } catch {
      setError("Nepodařilo se odpojit dokument.");
    } finally {
      setUnlinkingDocumentId(null);
    }
  }

  return (
    <section className="situation-documents-section" aria-labelledby="situation-documents-title">
      <span aria-hidden="true" className="notebook-section-icon user-section-icon">▣</span>
      <div className="notebook-section-content">
        <div className="situation-documents-header">
          <h3 id="situation-documents-title">Dokumenty</h3>
        </div>
        {isLoading ? <p className="journal-empty-message">Načítám dokumenty…</p> : null}
        {error ? <p className="notebook-inline-error">{error}</p> : null}
        {!isLoading && !error && documents.length === 0 ? (
          <p className="journal-empty-message">Zatím žádné dokumenty k této situaci.</p>
        ) : null}
        {!isLoading && documents.length > 0 ? (
          <ul className="situation-document-list">
            {documents.map((document) => {
              const isUnlinking = unlinkingDocumentId === document.id;
              const documentIcon = getDocumentIcon(document.filetype, document.filename);

              return (
                <li className="situation-document-row" key={document.id}>
                  <span
                    aria-hidden="true"
                    className={`document-file-icon document-file-icon-${documentIcon.kind}`}
                  >
                    {documentIcon.label}
                  </span>
                  <button
                    aria-label={`Otevřít dokument ${document.filename}`}
                    className="situation-document-title"
                    disabled={isUnlinking}
                    onClick={() => onOpenDocument(document)}
                    type="button"
                  >
                    {document.filename}
                  </button>
                  <div className="notebook-row-actions">
                    <button
                      aria-label={`Otevřít dokument ${document.filename}`}
                      className="notebook-icon-button"
                      disabled={isUnlinking}
                      onClick={() => onOpenDocument(document)}
                      title="Otevřít dokument"
                      type="button"
                    >
                      ✎
                    </button>
                    <button
                      aria-label={`Odpojit dokument ${document.filename} od situace`}
                      className="notebook-icon-button destructive-action"
                      disabled={isUnlinking}
                      onClick={() => handleUnlinkDocument(document)}
                      title="Odpojit od situace"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
