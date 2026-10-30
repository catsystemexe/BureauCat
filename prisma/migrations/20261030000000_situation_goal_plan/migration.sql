-- Additive migration: no legacy goal selection, data backfill or workflow transition.
ALTER TABLE "Situation" ADD COLUMN "workflow_revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Goal" ADD COLUMN "confirmed_at" DATETIME;
ALTER TABLE "Goal" ADD COLUMN "proposal_context_hash" TEXT;
ALTER TABLE "WorkflowEvent" ADD COLUMN "request_key" TEXT;

-- CreateTable
CREATE TABLE "SituationPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "situation_id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "content_json" TEXT NOT NULL,
    "context_hash" TEXT NOT NULL,
    "accepted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SituationPlan_situation_id_fkey" FOREIGN KEY ("situation_id") REFERENCES "Situation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SituationPlan_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "Goal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "RequiredInput" ADD COLUMN "plan_id" TEXT
REFERENCES "SituationPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "RequiredInput_plan_id_idx" ON "RequiredInput"("plan_id");

-- CreateIndex
CREATE INDEX "SituationPlan_goal_id_idx" ON "SituationPlan"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "SituationPlan_situation_id_revision_key" ON "SituationPlan"("situation_id", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowEvent_situation_id_request_key_key" ON "WorkflowEvent"("situation_id", "request_key");


-- Preserve all legacy active goals (confirmed_at is NULL). Only new explicit
-- confirmations participate in this database-level authority invariant.
CREATE UNIQUE INDEX "Goal_one_confirmed_active" ON "Goal"("situation_id")
WHERE "status" = 'active' AND "confirmed_at" IS NOT NULL;
CREATE UNIQUE INDEX "SituationPlan_one_accepted" ON "SituationPlan"("situation_id")
WHERE "status" = 'ACCEPTED';
