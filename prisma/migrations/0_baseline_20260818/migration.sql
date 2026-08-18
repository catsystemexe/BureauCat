-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "area" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'folder',
    "icon_color" TEXT NOT NULL DEFAULT '#3b82f6',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Situation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "case_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Situation_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "situation_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Goal_situation_id_fkey" FOREIGN KEY ("situation_id") REFERENCES "Situation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "case_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "display_name" TEXT,
    "filetype" TEXT NOT NULL,
    "original_file" TEXT NOT NULL,
    "document_type" TEXT NOT NULL DEFAULT 'source',
    "analysis_type" TEXT,
    "parent_document_id" TEXT,
    "extracted_text" TEXT,
    "processed_text" TEXT,
    "processed_markdown" TEXT,
    "processing_status" TEXT NOT NULL DEFAULT 'processed',
    "processing_error" TEXT,
    "markdown_version" INTEGER NOT NULL DEFAULT 1,
    "validation_status" TEXT NOT NULL DEFAULT 'pending_validation',
    "ai_summary" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_parent_document_id_fkey" FOREIGN KEY ("parent_document_id") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentAnnotation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "document_id" TEXT NOT NULL,
    "selected_text" TEXT NOT NULL,
    "start_offset" INTEGER,
    "end_offset" INTEGER,
    "annotation_type" TEXT NOT NULL DEFAULT 'note',
    "highlight_color" TEXT,
    "note_text" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "DocumentAnnotation_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentPin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "document_id" TEXT NOT NULL,
    "selected_text" TEXT NOT NULL,
    "start_offset" INTEGER NOT NULL,
    "end_offset" INTEGER NOT NULL,
    "visual_offset" INTEGER,
    "case_bookmark_number" INTEGER,
    "color" TEXT NOT NULL DEFAULT 'red',
    "note_text" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "DocumentPin_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
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
    "analysis_start_offset" INTEGER,
    "analysis_end_offset" INTEGER,
    "journal_item_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "DocumentInsight_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SituationDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "situation_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SituationDocument_situation_id_fkey" FOREIGN KEY ("situation_id") REFERENCES "Situation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SituationDocument_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "case_id" TEXT NOT NULL,
    "situation_id" TEXT,
    "section" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "value" TEXT,
    "explanation" TEXT,
    "evidence_state" TEXT NOT NULL DEFAULT 'unverified',
    "status" TEXT NOT NULL DEFAULT 'active',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "source_links_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "JournalItem_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "JournalItem_situation_id_fkey" FOREIGN KEY ("situation_id") REFERENCES "Situation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "case_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AISuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "case_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "suggested_item_json" TEXT NOT NULL,
    "assistant_reply" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "AISuggestion_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Situation_case_id_idx" ON "Situation"("case_id");

-- CreateIndex
CREATE INDEX "Situation_case_id_display_order_idx" ON "Situation"("case_id", "display_order");

-- CreateIndex
CREATE INDEX "Goal_situation_id_idx" ON "Goal"("situation_id");

-- CreateIndex
CREATE INDEX "Goal_situation_id_display_order_idx" ON "Goal"("situation_id", "display_order");

-- CreateIndex
CREATE INDEX "Document_case_id_idx" ON "Document"("case_id");

-- CreateIndex
CREATE INDEX "Document_document_type_idx" ON "Document"("document_type");

-- CreateIndex
CREATE INDEX "Document_parent_document_id_idx" ON "Document"("parent_document_id");

-- CreateIndex
CREATE UNIQUE INDEX "Document_parent_document_id_document_type_analysis_type_key" ON "Document"("parent_document_id", "document_type", "analysis_type");

-- CreateIndex
CREATE INDEX "DocumentAnnotation_document_id_idx" ON "DocumentAnnotation"("document_id");

-- CreateIndex
CREATE INDEX "DocumentAnnotation_document_id_annotation_type_idx" ON "DocumentAnnotation"("document_id", "annotation_type");

-- CreateIndex
CREATE INDEX "DocumentPin_document_id_idx" ON "DocumentPin"("document_id");

-- CreateIndex
CREATE INDEX "DocumentPin_document_id_start_offset_idx" ON "DocumentPin"("document_id", "start_offset");

-- CreateIndex
CREATE INDEX "DocumentPin_case_bookmark_number_idx" ON "DocumentPin"("case_bookmark_number");

-- CreateIndex
CREATE INDEX "DocumentInsight_document_id_idx" ON "DocumentInsight"("document_id");

-- CreateIndex
CREATE INDEX "DocumentInsight_source_document_id_idx" ON "DocumentInsight"("source_document_id");

-- CreateIndex
CREATE INDEX "DocumentInsight_source_pin_id_idx" ON "DocumentInsight"("source_pin_id");

-- CreateIndex
CREATE INDEX "DocumentInsight_status_idx" ON "DocumentInsight"("status");

-- CreateIndex
CREATE INDEX "DocumentInsight_document_id_analysis_start_offset_analysis_end_offset_idx" ON "DocumentInsight"("document_id", "analysis_start_offset", "analysis_end_offset");

-- CreateIndex
CREATE INDEX "SituationDocument_situation_id_idx" ON "SituationDocument"("situation_id");

-- CreateIndex
CREATE INDEX "SituationDocument_document_id_idx" ON "SituationDocument"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "SituationDocument_situation_id_document_id_key" ON "SituationDocument"("situation_id", "document_id");

-- CreateIndex
CREATE INDEX "JournalItem_case_id_idx" ON "JournalItem"("case_id");

-- CreateIndex
CREATE INDEX "JournalItem_situation_id_idx" ON "JournalItem"("situation_id");

-- CreateIndex
CREATE INDEX "JournalItem_case_id_situation_id_section_display_order_idx" ON "JournalItem"("case_id", "situation_id", "section", "display_order");

-- CreateIndex
CREATE INDEX "ChatMessage_case_id_created_at_idx" ON "ChatMessage"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "AISuggestion_case_id_status_idx" ON "AISuggestion"("case_id", "status");

