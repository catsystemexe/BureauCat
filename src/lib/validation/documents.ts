import path from "node:path";
import { z } from "zod";

export const allowedDocumentExtensions = [".txt", ".pdf", ".docx", ".jpg", ".jpeg", ".png"] as const;
export const maxDocumentUploadBytes = 10 * 1024 * 1024;

export type AllowedDocumentExtension = (typeof allowedDocumentExtensions)[number];

export type ValidatedDocumentFile = {
  file: File;
  originalFilename: string;
  extension: AllowedDocumentExtension;
  filetype: string;
};

export class DocumentValidationError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = "DocumentValidationError";
  }
}

function isAllowedDocumentExtension(extension: string): extension is AllowedDocumentExtension {
  return allowedDocumentExtensions.includes(extension as AllowedDocumentExtension);
}

export function validateDocumentUploadFile(value: FormDataEntryValue | null): ValidatedDocumentFile {
  if (!value || !(value instanceof File)) {
    throw new DocumentValidationError("File is required.");
  }

  if (value.size <= 0) {
    throw new DocumentValidationError("Uploaded file cannot be empty.");
  }

  if (value.size > maxDocumentUploadBytes) {
    throw new DocumentValidationError("Uploaded file exceeds the 10 MB MVP limit.");
  }

  const originalFilename = path.basename(value.name).trim();

  if (!originalFilename) {
    throw new DocumentValidationError("Uploaded file must have a filename.");
  }

  const extension = path.extname(originalFilename).toLowerCase();

  if (!isAllowedDocumentExtension(extension)) {
    throw new DocumentValidationError("Unsupported file type. Allowed extensions: .txt, .pdf, .docx, .jpg, .jpeg, .png.");
  }

  return {
    file: value,
    originalFilename,
    extension,
    filetype: extension.slice(1)
  };
}

export const linkDocumentToSituationSchema = z.object({
  document_id: z.string().trim().min(1)
});
