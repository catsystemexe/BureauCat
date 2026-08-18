-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "area" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "case_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filetype" TEXT NOT NULL,
    "original_file" TEXT NOT NULL,
    "extracted_text" TEXT,
    "ai_summary" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "case_id" TEXT NOT NULL,
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
    CONSTRAINT "JournalItem_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE INDEX "Document_case_id_idx" ON "Document"("case_id");

-- CreateIndex
CREATE INDEX "JournalItem_case_id_idx" ON "JournalItem"("case_id");

-- CreateIndex
CREATE INDEX "JournalItem_case_id_section_display_order_idx" ON "JournalItem"("case_id", "section", "display_order");

-- CreateIndex
CREATE INDEX "ChatMessage_case_id_created_at_idx" ON "ChatMessage"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "AISuggestion_case_id_status_idx" ON "AISuggestion"("case_id", "status");
