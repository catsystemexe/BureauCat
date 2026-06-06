-- CreateTable
CREATE TABLE "SituationDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "situation_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SituationDocument_situation_id_fkey" FOREIGN KEY ("situation_id") REFERENCES "Situation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SituationDocument_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Link each existing case-level Document to the first active Situation in its Case,
-- falling back to the first Situation. Documents in Cases without a Situation are skipped.
INSERT INTO "SituationDocument" (
    "id",
    "situation_id",
    "document_id",
    "created_at"
)
SELECT
    'situation_document_' || document."id",
    (
        SELECT situation."id"
        FROM "Situation" AS situation
        WHERE situation."case_id" = document."case_id"
        ORDER BY
            CASE WHEN situation."status" = 'active' THEN 0 ELSE 1 END ASC,
            situation."display_order" ASC,
            situation."created_at" ASC
        LIMIT 1
    ),
    document."id",
    CURRENT_TIMESTAMP
FROM "Document" AS document
WHERE EXISTS (
    SELECT 1
    FROM "Situation" AS situation
    WHERE situation."case_id" = document."case_id"
);

-- CreateIndex
CREATE INDEX "SituationDocument_situation_id_idx" ON "SituationDocument"("situation_id");

-- CreateIndex
CREATE INDEX "SituationDocument_document_id_idx" ON "SituationDocument"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "SituationDocument_situation_id_document_id_key" ON "SituationDocument"("situation_id", "document_id");
