"use client";

import { useEffect, useState } from "react";
import {
  CircleCheck,
  Eraser,
  Eye,
  Highlighter,
  Maximize2,
  MessageCircle,
  SquarePen,
  Trash2,
  TriangleAlert
} from "lucide-react";
import type { CaseDocument } from "@/components/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

type DocumentResponse = {
  document?: CaseDocument;
  error?: string;
};

export function DocumentViewPanel({ document: initialDocument }: { document: CaseDocument }) {
  const [currentDocument, setCurrentDocument] = useState(initialDocument);
  const [isOriginalVisible, setIsOriginalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [draftText, setDraftText] = useState(initialDocument.processed_text ?? initialDocument.extracted_text ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const displayText = currentDocument.processed_text ?? currentDocument.extracted_text ?? "";
  const isValidated = currentDocument.validation_status === "validated";

  useEffect(() => {
    setCurrentDocument(initialDocument);
    setDraftText(initialDocument.processed_text ?? initialDocument.extracted_text ?? "");
    setError(null);
    setIsEditing(false);
    setIsOriginalVisible(false);
    setIsFullscreen(false);
  }, [initialDocument]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function patchDocument(payload: Record<string, string>) {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${currentDocument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as DocumentResponse;

      if (!response.ok || !data.document) {
        throw new Error(data.error ?? "Dokument se nepodařilo uložit.");
      }

      setCurrentDocument(data.document);
      setDraftText(data.document.processed_text ?? data.document.extracted_text ?? "");
      return data.document;
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Dokument se nepodařilo uložit.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveText() {
    const updatedDocument = await patchDocument({ processed_text: draftText });

    if (updatedDocument) {
      setIsEditing(false);
    }
  }

  async function handleToggleValidation() {
    const nextStatus = isValidated ? "pending_validation" : "validated";
    const updatedDocument = await patchDocument({ validation_status: nextStatus });

    if (updatedDocument?.validation_status === "validated") {
      setIsEditing(false);
    }
  }

  async function handleDeleteDocument() {
    const confirmed = window.confirm(
      `Smazat dokument?\n\n${currentDocument.filename}\n\nBude odstraněn originál, zpracovaný text a budoucí anotace. Tuto akci nelze vrátit.`
    );

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${currentDocument.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Dokument se nepodařilo smazat.");
      }

      window.location.reload();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Dokument se nepodařilo smazat.");
      setIsSaving(false);
    }
  }

  return (
    <article
      className={`document-view-panel${isFullscreen ? " document-view-panel-fullscreen" : ""}`}
      aria-labelledby="document-view-title"
    >
      <div className="document-view-header">
        <div className="document-title-row document-review-title-row">
          <div className="document-title-meta">
            <h2 id="document-view-title">{currentDocument.filename}</h2>
            <span className="document-upload-date">Dokument nahrán {formatDate(currentDocument.created_at)}</span>
          </div>

          <div className="document-main-actions" aria-label="Akce dokumentu">
            <button
              aria-pressed={isFullscreen}
              className={`document-icon-action${isFullscreen ? " active" : ""}`}
              onClick={() => setIsFullscreen((current) => !current)}
              title="Zobrazit obsah na celou obrazovku"
              type="button"
            >
              <Maximize2 aria-hidden="true" className="document-action-icon" />
            </button>

            <button
              aria-pressed={isEditing}
              className={`document-icon-action${isEditing ? " active" : ""}`}
              disabled={isValidated || isSaving}
              onClick={() => setIsEditing((current) => !current)}
              title={isValidated ? "Validovaný text je zamčený" : "Editovat zpracovaný text"}
              type="button"
            >
              <SquarePen aria-hidden="true" className="document-action-icon" />
            </button>

            <button
              aria-pressed={isOriginalVisible}
              className={`document-icon-action${isOriginalVisible ? " active" : ""}`}
              onClick={() => setIsOriginalVisible((current) => !current)}
              title="Zobrazit originál"
              type="button"
            >
              <Eye aria-hidden="true" className="document-action-icon" />
            </button>

            <button
              className="document-icon-action danger"
              disabled={isSaving}
              onClick={handleDeleteDocument}
              title="Smazat dokument"
              type="button"
            >
              <Trash2 aria-hidden="true" className="document-action-icon" />
            </button>

            <div className="document-validation-control">
              <button
                aria-label={isValidated ? "Schváleno" : "Čeká na schválení"}
                className={`document-validation-icon-button ${isValidated ? "validated" : "pending"}`}
                disabled={isSaving}
                onClick={handleToggleValidation}
                title={isValidated ? "Vrátit do stavu čeká na schválení" : "Schválit zpracovaný text"}
                type="button"
              >
                {isValidated ? (
                  <CircleCheck aria-hidden="true" className="document-action-icon" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="document-action-icon" />
                )}
              </button>
              {!isValidated ? (
                <span className="document-validation-floating-label">Čeká na schválení</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {error ? <p className="status-message error-message document-review-error">{error}</p> : null}

      {isOriginalVisible ? (
        <div className="document-original-placeholder">
          Originál: {currentDocument.original_file}
        </div>
      ) : null}

      <section className="document-view-section document-content-section" aria-label="Obsah dokumentu">
        <div className="document-annotation-toolbar" aria-label="Anotace dokumentu">
          <button title="Zvýraznit text" type="button">
            <Highlighter aria-hidden="true" className="document-mini-icon" />
          </button>
          <button title="Vložit poznámku" type="button">
            <MessageCircle aria-hidden="true" className="document-mini-icon" />
          </button>
          <button title="Smazat poznámky a zvýraznění" type="button">
            <Eraser aria-hidden="true" className="document-mini-icon" />
          </button>
        </div>

        {isEditing ? (
          <div className="document-edit-shell">
            <textarea
              aria-label="Zpracovaný text dokumentu"
              className="document-text-editor"
              disabled={isSaving}
              onChange={(event) => setDraftText(event.target.value)}
              value={draftText}
            />
            <div className="document-edit-actions">
              <button className="secondary-action" disabled={isSaving} onClick={() => {
                setDraftText(displayText);
                setIsEditing(false);
              }} type="button">
                Zrušit
              </button>
              <button className="primary-action" disabled={isSaving} onClick={handleSaveText} type="button">
                {isSaving ? "Ukládám…" : "Uložit text"}
              </button>
            </div>
          </div>
        ) : displayText.trim().length > 0 ? (
          <pre className="document-extracted-text">{displayText}</pre>
        ) : (
          <p className="panel-note">Zpracovaný text pro tento dokument není k dispozici.</p>
        )}
      </section>
    </article>
  );
}
