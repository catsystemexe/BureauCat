"use client";

import {
  type ChangeEvent,
  forwardRef,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import type { CaseDocument } from "@/components/types";

const ACCEPTED_DOCUMENT_TYPES = ".pdf,.docx,.txt,.jpg,.jpeg,.png,.rtf";

type DocumentUploadResponse = {
  document?: CaseDocument;
};

export type DocumentUploadHandle = {
  openFilePicker: () => void;
};

export const DocumentUpload = forwardRef<DocumentUploadHandle, {
  caseId: string;
  onSituationDocumentLinked: () => void;
  onUploaded: (document: CaseDocument) => void;
  selectedSituationId: string | null;
}>(function DocumentUpload({
  caseId,
  onSituationDocumentLinked,
  onUploaded,
  selectedSituationId
}, ref) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    openFilePicker() {
      if (!isUploading) {
        fileInputRef.current?.click();
      }
    }
  }), [isUploading]);

  async function uploadFile(file: File) {
    if (isUploading) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

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
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Dokument se nepodařilo nahrát.");
    } finally {
      setIsUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      void uploadFile(file);
    }
  }

  return (
    <>
      <input
        accept={ACCEPTED_DOCUMENT_TYPES}
        aria-hidden="true"
        className="direct-document-upload-input"
        disabled={isUploading}
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />
      {uploadError ? <p className="status-message error-message document-upload-inline-error">{uploadError}</p> : null}
      {linkError ? <p className="status-message error-message document-upload-inline-error">{linkError}</p> : null}
    </>
  );
});
