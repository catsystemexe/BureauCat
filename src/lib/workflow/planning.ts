import { z } from "zod";

const text = z.string().trim().min(1).max(4000);
export const planContentSchema = z.object({
  expectedOutput: text,
  procedure: z.array(text).min(1).max(20),
  inputs: z.array(z.object({ title: text, description: z.string().trim().max(4000), criteria: z.array(text).min(1).max(12) }).strict()).min(1).max(20)
}).strict();
export type PlanContent = z.infer<typeof planContentSchema>;
const base = {
  caseId: z.string().min(1), requestKey: z.string().min(8).max(100),
  expectedRevision: z.number().int().min(0), contextHash: z.string().length(64)
};
export const planningCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("suggestGoals") }).strict(),
  z.object({ ...base, action: z.literal("confirmGoal"), goalId: z.string().optional(), title: text }).strict(),
  z.object({ ...base, action: z.literal("suggestPlan"), goalId: z.string() }).strict(),
  z.object({ ...base, action: z.literal("savePlan"), goalId: z.string(), content: planContentSchema }).strict(),
  z.object({ ...base, action: z.literal("acceptPlan"), planId: z.string() }).strict(),
  z.object({ ...base, action: z.literal("matchInputs"), planId: z.string() }).strict(),
  z.object({ ...base, action: z.literal("reviewCriterion"), planId: z.string(), criterionId: z.string(),
    value: z.string().trim().max(4000), insightIds: z.array(z.string()).max(20),
    sufficient: z.boolean(), explanation: z.string().trim().max(4000) }).strict()
]);
export type PlanningCommand = z.infer<typeof planningCommandSchema>;
export const goalSuggestionsSchema = z.object({ goals: z.array(z.object({ title: text, reason: text, insightIds: z.array(z.string()).max(20) }).strict()).min(2).max(4) }).strict();
export const inputMatchesSchema = z.object({ matches: z.array(z.object({
  criterionId: z.string(), value: z.string().max(4000), insightIds: z.array(z.string()).max(20),
  explanation: text
}).strict()).max(240) }).strict();
export type PlanningState = {
  revision: number; contextHash: string; goalSelectionRequired: boolean;
  goal: { id: string; title: string } | null;
  goals: { id: string; title: string; status: string; confirmed_at: string | null }[];
  steps: { step_key: string; status: string }[];
  plan: { id: string; goal_id: string; status: string; content: PlanContent; revision: number; accepted_at: string | null } | null;
  history: { id: string; goal_id: string; status: string; revision: number; content: PlanContent }[];
  inputs: { id: string; title: string; status: string; criteria: {
    id: string; requirement_text: string; status: string; value: string; explanation: string;
    stale: boolean; historicalInsightIds?: string[]; insightIds: string[]; sources: PlanningEvidence[];
  }[] }[];
  evidence: PlanningEvidence[];
  reviewHistory?: { id: string; createdAt: string; changes: { criterionId: string; requirement?: string; before: { value: string | null; refs: string }; after: { value: string; explanation: string; reviewed: boolean } }[] }[];
};
export type PlanningEvidence = {
  id: string; documentId: string; documentName: string; title: string; value: string; quote: string;
  startOffset: number | null; endOffset: number | null; pinId: string | null;
  type: string; evidenceState: string; fingerprint: string; usable: boolean;
};

/** Keep the existing workflow DTO fields, projecting only the current Plan. */
export function effectiveRequiredInputs<T extends { id: string; criteria: { id: string }[] }>(inputs: T[], planning: PlanningState) {
  return inputs.flatMap((input) => {
    const effective = planning.inputs.find((item) => item.id === input.id);
    if (!effective) return [];
    return [{ ...input, status: effective.status, criteria: input.criteria.map((criterion) => {
      const current = effective.criteria.find((item) => item.id === criterion.id)!;
      return { ...criterion, status: current.status, matched_value: current.value || null,
        stale: current.stale, explanation: current.explanation, sources: current.sources };
    }) }];
  });
}
