-- Backfill the canonical workflow train for Situations that predate workflow persistence.
INSERT OR IGNORE INTO "WorkflowStep" ("id", "situation_id", "step_key", "status", "display_order", "created_at", "updated_at")
SELECT 'wf_' || "id" || '_analysis', "id", 'ANALYSIS', 'ACTIVE', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Situation";

INSERT OR IGNORE INTO "WorkflowStep" ("id", "situation_id", "step_key", "status", "display_order", "created_at", "updated_at")
SELECT 'wf_' || "id" || '_plan', "id", 'PLAN', 'INACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Situation";

INSERT OR IGNORE INTO "WorkflowStep" ("id", "situation_id", "step_key", "status", "display_order", "created_at", "updated_at")
SELECT 'wf_' || "id" || '_collection', "id", 'COLLECTION', 'INACTIVE', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Situation";

INSERT OR IGNORE INTO "WorkflowStep" ("id", "situation_id", "step_key", "status", "display_order", "created_at", "updated_at")
SELECT 'wf_' || "id" || '_input_validation', "id", 'INPUT_VALIDATION', 'INACTIVE', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Situation";

INSERT OR IGNORE INTO "WorkflowStep" ("id", "situation_id", "step_key", "status", "display_order", "created_at", "updated_at")
SELECT 'wf_' || "id" || '_production', "id", 'PRODUCTION', 'INACTIVE', 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Situation";

INSERT OR IGNORE INTO "WorkflowStep" ("id", "situation_id", "step_key", "status", "display_order", "created_at", "updated_at")
SELECT 'wf_' || "id" || '_output_review', "id", 'OUTPUT_REVIEW', 'INACTIVE', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Situation";

INSERT OR IGNORE INTO "WorkflowStep" ("id", "situation_id", "step_key", "status", "display_order", "created_at", "updated_at")
SELECT 'wf_' || "id" || '_execution', "id", 'EXECUTION', 'INACTIVE', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Situation";
