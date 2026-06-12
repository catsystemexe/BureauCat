-- Column was already added in some local Replit databases via prisma db push.
-- Keep migration safe for the current SQLite dev workflow.
CREATE INDEX IF NOT EXISTS "DocumentPin_case_bookmark_number_idx"
ON "DocumentPin"("case_bookmark_number");
