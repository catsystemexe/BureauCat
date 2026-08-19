export const WORKFLOW_STEP_DEFINITIONS = [
  { key: "ANALYSIS", order: 0 },
  { key: "PLAN", order: 1 },
  { key: "COLLECTION", order: 2 },
  { key: "INPUT_VALIDATION", order: 3 },
  { key: "PRODUCTION", order: 4 },
  { key: "OUTPUT_REVIEW", order: 5 },
  { key: "EXECUTION", order: 6 }
] as const;

export type WorkflowStepKey = (typeof WORKFLOW_STEP_DEFINITIONS)[number]["key"];

export const WORKFLOW_STEP_STATUSES = ["INACTIVE", "ACTIVE", "COMPLETED"] as const;
export type WorkflowStepStatus = (typeof WORKFLOW_STEP_STATUSES)[number];

export const REQUIRED_INPUT_STATUSES = ["MISSING", "INCOMPLETE", "SATISFIED"] as const;
export type RequiredInputStatus = (typeof REQUIRED_INPUT_STATUSES)[number];

export const REQUIRED_INPUT_CRITERION_STATUSES = ["MISSING", "SATISFIED"] as const;
export type RequiredInputCriterionStatus = (typeof REQUIRED_INPUT_CRITERION_STATUSES)[number];

export const WORKFLOW_TASK_STATUSES = ["PENDING", "ACTIVE", "COMPLETED"] as const;
export type WorkflowTaskStatus = (typeof WORKFLOW_TASK_STATUSES)[number];

export const WORKFLOW_OVERRIDE_TYPES = ["CONTINUE_WITHOUT_INPUT"] as const;
export type WorkflowOverrideType = (typeof WORKFLOW_OVERRIDE_TYPES)[number];
