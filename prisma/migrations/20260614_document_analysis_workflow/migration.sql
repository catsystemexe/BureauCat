ALTER TABLE "Document" ADD COLUMN "document_type" TEXT NOT NULL DEFAULT 'source';
ALTER TABLE "Document" ADD COLUMN "analysis_type" TEXT;
ALTER TABLE "Document" ADD COLUMN "parent_document_id" TEXT;

CREATE TABLE "DocumentInsight" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "document_id" TEXT NOT NULL,
  "source_document_id" TEXT,
  "source_pin_id" TEXT,
  "insight_type" TEXT NOT NULL,
  "target_section" TEXT NOT NULL,
  "target_item_type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT,
  "evidence_state" TEXT NOT NULL DEFAULT 'inferred',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "source_text" TEXT,
  "source_start_offset" INTEGER,
  "source_end_offset" INTEGER,
  "journal_item_id" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "DocumentInsight_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "Document" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Document_document_type_idx" ON "Document"("document_type");
CREATE INDEX "Document_parent_document_id_idx" ON "Document"("parent_document_id");

CREATE INDEX "DocumentInsight_document_id_idx" ON "DocumentInsight"("document_id");
CREATE INDEX "DocumentInsight_source_document_id_idx" ON "DocumentInsight"("source_document_id");
CREATE INDEX "DocumentInsight_source_pin_id_idx" ON "DocumentInsight"("source_pin_id");
CREATE INDEX "DocumentInsight_status_idx" ON "DocumentInsight"("status");
