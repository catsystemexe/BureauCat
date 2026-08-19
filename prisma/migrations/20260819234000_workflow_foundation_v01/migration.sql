-- CreateTable
CREATE TABLE "WorkflowStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "situation_id" TEXT NOT NULL,
    "step_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INACTIVE',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "WorkflowStep_situation_id_fkey" FOREIGN KEY ("situation_id") REFERENCES "Situation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequiredInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "situation_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'MISSING',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "source_refs_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "RequiredInput_situation_id_fkey" FOREIGN KEY ("situation_id") REFERENCES "Situation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequiredInputCriterion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "required_input_id" TEXT NOT NULL,
    "requirement_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MISSING',
    "matched_value" TEXT,
    "evidence_refs_json" TEXT NOT NULL DEFAULT '[]',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "RequiredInputCriterion_required_input_id_fkey" FOREIGN KEY ("required_input_id") REFERENCES "RequiredInput" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "situation_id" TEXT NOT NULL,
    "workflow_step_id" TEXT NOT NULL,
    "required_input_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "WorkflowTask_situation_id_fkey" FOREIGN KEY ("situation_id") REFERENCES "Situation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowTask_workflow_step_id_fkey" FOREIGN KEY ("workflow_step_id") REFERENCES "WorkflowStep" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowTask_required_input_id_fkey" FOREIGN KEY ("required_input_id") REFERENCES "RequiredInput" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "situation_id" TEXT NOT NULL,
    "workflow_step_id" TEXT,
    "required_input_id" TEXT,
    "override_type" TEXT NOT NULL DEFAULT 'CONTINUE_WITHOUT_INPUT',
    "reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" DATETIME,
    CONSTRAINT "WorkflowOverride_situation_id_fkey" FOREIGN KEY ("situation_id") REFERENCES "Situation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowOverride_workflow_step_id_fkey" FOREIGN KEY ("workflow_step_id") REFERENCES "WorkflowStep" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkflowOverride_required_input_id_fkey" FOREIGN KEY ("required_input_id") REFERENCES "RequiredInput" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "situation_id" TEXT NOT NULL,
    "workflow_step_id" TEXT,
    "event_type" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowEvent_situation_id_fkey" FOREIGN KEY ("situation_id") REFERENCES "Situation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowEvent_workflow_step_id_fkey" FOREIGN KEY ("workflow_step_id") REFERENCES "WorkflowStep" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStep_situation_id_step_key_key" ON "WorkflowStep"("situation_id", "step_key");

-- CreateIndex
CREATE INDEX "WorkflowStep_situation_id_idx" ON "WorkflowStep"("situation_id");

-- CreateIndex
CREATE INDEX "WorkflowStep_situation_id_display_order_idx" ON "WorkflowStep"("situation_id", "display_order");

-- CreateIndex
CREATE INDEX "WorkflowStep_situation_id_status_idx" ON "WorkflowStep"("situation_id", "status");

-- CreateIndex
CREATE INDEX "RequiredInput_situation_id_idx" ON "RequiredInput"("situation_id");

-- CreateIndex
CREATE INDEX "RequiredInput_situation_id_display_order_idx" ON "RequiredInput"("situation_id", "display_order");

-- CreateIndex
CREATE INDEX "RequiredInput_situation_id_status_idx" ON "RequiredInput"("situation_id", "status");

-- CreateIndex
CREATE INDEX "RequiredInputCriterion_required_input_id_idx" ON "RequiredInputCriterion"("required_input_id");

-- CreateIndex
CREATE INDEX "RequiredInputCriterion_required_input_id_display_order_idx" ON "RequiredInputCriterion"("required_input_id", "display_order");

-- CreateIndex
CREATE INDEX "RequiredInputCriterion_required_input_id_status_idx" ON "RequiredInputCriterion"("required_input_id", "status");

-- CreateIndex
CREATE INDEX "WorkflowTask_situation_id_idx" ON "WorkflowTask"("situation_id");

-- CreateIndex
CREATE INDEX "WorkflowTask_workflow_step_id_idx" ON "WorkflowTask"("workflow_step_id");

-- CreateIndex
CREATE INDEX "WorkflowTask_required_input_id_idx" ON "WorkflowTask"("required_input_id");

-- CreateIndex
CREATE INDEX "WorkflowTask_situation_id_status_idx" ON "WorkflowTask"("situation_id", "status");

-- CreateIndex
CREATE INDEX "WorkflowOverride_situation_id_idx" ON "WorkflowOverride"("situation_id");

-- CreateIndex
CREATE INDEX "WorkflowOverride_workflow_step_id_idx" ON "WorkflowOverride"("workflow_step_id");

-- CreateIndex
CREATE INDEX "WorkflowOverride_required_input_id_idx" ON "WorkflowOverride"("required_input_id");

-- CreateIndex
CREATE INDEX "WorkflowOverride_situation_id_revoked_at_idx" ON "WorkflowOverride"("situation_id", "revoked_at");

-- CreateIndex
CREATE INDEX "WorkflowEvent_situation_id_created_at_idx" ON "WorkflowEvent"("situation_id", "created_at");

-- CreateIndex
CREATE INDEX "WorkflowEvent_workflow_step_id_idx" ON "WorkflowEvent"("workflow_step_id");

-- CreateIndex
CREATE INDEX "WorkflowEvent_event_type_idx" ON "WorkflowEvent"("event_type");
