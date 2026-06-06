"use client";

import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import type { CaseDocument } from "@/components/types";

const ACCEPTED_DOCUMENT_TYPES = ".pdf,.docx,.txt,.jpg,.jpeg,.png";

type DocumentUploadResponse = {
  document?: CaseDocument;
};

export function DocumentUpload({
  caseId,
  onSituationDocumentLinked,
  onUploaded,
  selectedSituationId
}: {
  caseId: string;
  onSituationDocumentLinked: () => void;
  onUploaded: (document: CaseDocument) => void;
  selectedSituationId: string | null;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
    setUploadError(null);
    setLinkError(null);
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile || isUploading) {
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setIsUploading(true);
      setUploadError(null);
      setLinkError(null);

      const response = await fetch(`/api/cases/${caseId}/documents`, {
        method: "POST",
        body: formData
      });
      const data = (await response.json()) as DocumentUploadResponse;

      if (!response.ok) {
        throw new Error("Dokument se nepodařilo nahrát.");
      }

      if (!data.document) {
        throw new Error("Odpověď neobsahuje nahraný dokument.");
      }

      const uploadedDocument = data.document;
      onUploaded(uploadedDocument);

      if (selectedSituationId) {
        try {
          const linkResponse = await fetch(`/api/situations/${selectedSituationId}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ document_id: uploadedDocument.id })
          });

          if (!linkResponse.ok) {
            throw new Error("Nepodařilo se propojit dokument se situací.");
          }

          onSituationDocumentLinked();
        } catch {
          setLinkError("Nepodařilo se propojit dokument se situací.");
        }
      }

      setSelectedFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Dokument se nepodařilo nahrát.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form className="document-upload" onSubmit={handleUpload}>
      <label htmlFor="document-upload-input">Nahrát dokument</label>
      <input
        accept={ACCEPTED_DOCUMENT_TYPES}
        disabled={isUploading}
        id="document-upload-input"
        name="file"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
      <p className="document-upload-hint">Povolené formáty: PDF, DOCX, TXT, JPG, PNG.</p>
      <button className="primary-action" disabled={!selectedFile || isUploading} type="submit">
        {isUploading ? "Nahrávám…" : "Nahrát dokument"}
      </button>
      {uploadError ? <p className="status-message error-message">{uploadError}</p> : null}
      {linkError ? <p className="status-message error-message">{linkError}</p> : null}
    </form>
  );
}
