CREATE TABLE "DocumentAnnotation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "document_id" TEXT NOT NULL,
  "selected_text" TEXT NOT NULL,
  "start_offset" INTEGER,
  "end_offset" INTEGER,
  "annotation_type" TEXT NOT NULL DEFAULT 'note',
  "note_text" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "DocumentAnnotation_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DocumentAnnotation_document_id_idx" ON "DocumentAnnotation"("document_id");
CREATE INDEX "DocumentAnnotation_document_id_annotation_type_idx" ON "DocumentAnnotation"("document_id", "annotation_type");
