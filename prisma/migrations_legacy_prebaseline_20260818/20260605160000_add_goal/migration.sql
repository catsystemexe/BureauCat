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

-- Migrate legacy case-level JournalItem goals to the first active Situation,
-- falling back to the first Situation when a case has no active Situation.
-- Cases without a Situation are intentionally skipped and JournalItem is preserved.
INSERT INTO "Goal" (
    "id",
    "situation_id",
    "title",
    "status",
    "display_order",
    "created_at",
    "updated_at"
)
SELECT
    'goal_' || journal_goal."id",
    (
        SELECT situation."id"
        FROM "Situation" AS situation
        WHERE situation."case_id" = journal_goal."case_id"
        ORDER BY
            CASE WHEN situation."status" = 'active' THEN 0 ELSE 1 END ASC,
            situation."display_order" ASC,
            situation."created_at" ASC
        LIMIT 1
    ),
    journal_goal."title",
    CASE journal_goal."status"
        WHEN 'resolved' THEN 'completed'
        WHEN 'obsolete' THEN 'archived'
        ELSE 'active'
    END,
    journal_goal."display_order",
    journal_goal."created_at",
    journal_goal."updated_at"
FROM "JournalItem" AS journal_goal
WHERE journal_goal."section" = 'goals'
  AND journal_goal."item_type" = 'GOAL'
  AND EXISTS (
      SELECT 1
      FROM "Situation" AS situation
      WHERE situation."case_id" = journal_goal."case_id"
  );

-- CreateIndex
CREATE INDEX "Goal_situation_id_idx" ON "Goal"("situation_id");

-- CreateIndex
CREATE INDEX "Goal_situation_id_display_order_idx" ON "Goal"("situation_id", "display_order");
