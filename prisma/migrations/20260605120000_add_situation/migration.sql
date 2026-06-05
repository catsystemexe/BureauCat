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

-- Backfill one deterministic default Situation for every existing Case.
INSERT INTO "Situation" (
    "id",
    "case_id",
    "title",
    "description",
    "status",
    "display_order",
    "created_at",
    "updated_at"
)
SELECT
    'situation_' || "id",
    "id",
    'Situace 1',
    NULL,
    'active',
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Case";

-- CreateIndex
CREATE INDEX "Situation_case_id_idx" ON "Situation"("case_id");

-- CreateIndex
CREATE INDEX "Situation_case_id_display_order_idx" ON "Situation"("case_id", "display_order");
