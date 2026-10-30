import { z } from "zod";

const text = z.string().trim().min(1).max(4000);
const inputFields = { title: text, description: z.string().trim().max(4000), criteria: z.array(text).min(1).max(12) };
export const legacyPlanContentSchema = z.object({
  expectedOutput: text, procedure: z.array(text).min(1).max(20),
  inputs: z.array(z.object(inputFields).strict()).min(1).max(20)
}).strict();
export const newPlanContentSchema = z.object({
  version: z.literal(2), expectedOutput: text,
  procedure: z.array(z.object({ id: text, title: text, expectedResult: text,
    explanation: z.string().trim().max(4000).optional(), inputIds: z.array(text).max(20) }).strict()).min(1).max(20),
  inputs: z.array(z.object({ id: text, ...inputFields }).strict()).min(1).max(20)
}).strict().superRefine((plan, context) => {
  const inputIds = new Set(plan.inputs.map((input) => input.id));
  if (inputIds.size !== plan.inputs.length) context.addIssue({ code: "custom", message: "ID vstupů musí být jedinečná." });
  if (new Set(plan.procedure.map((action) => action.id)).size !== plan.procedure.length) context.addIssue({ code: "custom", message: "ID akcí musí být jedinečná." });
  for (const action of plan.procedure) {
    if (new Set(action.inputIds).size !== action.inputIds.length || action.inputIds.some((id) => !inputIds.has(id))) {
      context.addIssue({ code: "custom", message: "Akce odkazuje na neplatný nebo duplicitní vstup této verze Plánu." });
    }
  }
});
export const planContentSchema = z.union([newPlanContentSchema, legacyPlanContentSchema]);
export type PlanContent = z.infer<typeof planContentSchema>;
export type EditablePlan = z.infer<typeof newPlanContentSchema>;
/** Explicit edit only. Missing old results/links remain blank for the user. */
export function editPlan(content: PlanContent | null): EditablePlan {
  if (content && "version" in content) return content;
  return { version: 2, expectedOutput: content?.expectedOutput ?? "",
    procedure: (content?.procedure ?? [""]).map((title) => ({ id: crypto.randomUUID(), title, expectedResult: "", explanation: "", inputIds: [] })),
    inputs: (content?.inputs ?? [{ title: "", description: "", criteria: [""] }]).map((input) => ({ ...input, id: crypto.randomUUID() })) };
}
export const situationBriefSchema = z.object({
  trigger: z.object({ description: text, documentIds: z.array(text).max(20) }).strict(),
  requirements: z.array(z.object({ text, insightIds: z.array(text).max(20) }).strict()).max(20),
  deadline: z.object({ text, insightIds: z.array(text).max(20) }).strict().nullable()
}).strict().transform((brief) => ({
  ...brief,
  trigger: { ...brief.trigger, documentIds: [...new Set(brief.trigger.documentIds)] },
  requirements: brief.requirements.map((item) => ({ ...item, insightIds: [...new Set(item.insightIds)] })),
  deadline: brief.deadline ? { ...brief.deadline, insightIds: [...new Set(brief.deadline.insightIds)] } : null
}));
export type SituationBrief = z.infer<typeof situationBriefSchema>;
/** Read-only/current editor selection; immutable event payloads remain historical. */
export function currentBrief(brief: SituationBrief | null, documents: { id: string }[], evidence: { id: string; usable: boolean }[]): SituationBrief | null {
  if (!brief) return null;
  const ids = (values: string[]) => [...new Set(values)].filter((id) => evidence.some((source) => source.id === id && source.usable));
  return { ...brief, trigger: { ...brief.trigger, documentIds: [...new Set(brief.trigger.documentIds)].filter((id) => documents.some((doc) => doc.id === id)) },
    requirements: brief.requirements.map((item) => ({ ...item, insightIds: ids(item.insightIds) })),
    deadline: brief.deadline ? { ...brief.deadline, insightIds: ids(brief.deadline.insightIds) } : null };
}
export const inputReviewSchema = z.object({
  criterionId: z.string().min(1), value: z.string().trim().max(4000), explanation: z.string().trim().max(4000),
  insightIds: z.array(z.string().min(1)).max(20), documentIds: z.array(z.string().min(1)).max(20),
  origin: z.enum(["USER", "DOCUMENT"]), sufficient: z.boolean()
}).strict();
export type InputReview = z.infer<typeof inputReviewSchema>;
const base = {
  caseId: z.string().min(1), requestKey: z.string().min(8).max(100),
  expectedRevision: z.number().int().min(0), contextHash: z.string().length(64)
};
export const planningCommandSchema = z.discriminatedUnion("action", [
  z.object({ ...base, action: z.literal("suggestGoals") }).strict(),
  z.object({ ...base, action: z.literal("confirmGoal"), goalId: z.string().optional(), title: text, brief: situationBriefSchema.optional() }).strict(),
  z.object({ ...base, action: z.literal("suggestPlan"), goalId: z.string() }).strict(),
  z.object({ ...base, action: z.literal("savePlan"), goalId: z.string(), content: newPlanContentSchema }).strict(),
  z.object({ ...base, action: z.literal("acceptPlan"), planId: z.string() }).strict(),
  z.object({ ...base, action: z.literal("matchInputs"), planId: z.string() }).strict(),
  z.object({ ...base, action: z.literal("reviewInputs"), planId: z.string(), reviews: z.array(inputReviewSchema).min(1).max(240).refine((rows) => new Set(rows.map((row) => row.criterionId)).size === rows.length, "Kritérium je uvedeno vícekrát.") }).strict(),
  z.object({ ...base, action: z.literal("reviewCriterion"), planId: z.string(), criterionId: z.string(),
    value: z.string().trim().max(4000), insightIds: z.array(z.string()).max(20),
    sufficient: z.boolean(), explanation: z.string().trim().max(4000) }).strict()
]);
export type PlanningCommand = z.infer<typeof planningCommandSchema>;
export const goalSuggestionsSchema = z.object({ goals: z.array(z.object({ title: text, reason: text, insightIds: z.array(z.string()).max(20) }).strict()).min(1).max(4), brief: situationBriefSchema }).strict();
export const inputMatchesSchema = z.object({ matches: z.array(z.object({
  criterionId: z.string(), value: z.string().max(4000), insightIds: z.array(z.string()).max(20),
  explanation: text
}).strict()).max(240) }).strict();
export type PlanningState = {
  historicalBrief?: SituationBrief | null; deadlineVerified?: boolean;
  briefHistory?: { id: string; brief: SituationBrief }[];
  brief?: SituationBrief | null; briefStale?: boolean; documents?: { id: string; name: string; fingerprint?: string }[];
  revision: number; contextHash: string; goalSelectionRequired: boolean;
  goal: { id: string; title: string } | null;
  goals: { id: string; title: string; status: string; confirmed_at: string | null; reason?: string | null; insightIds?: string[]; currentProposal?: boolean; brief?: SituationBrief | null }[];
  steps: { step_key: string; status: string }[];
  plan: { id: string; goal_id: string; status: string; content: PlanContent; revision: number; accepted_at: string | null } | null;
  history: { id: string; goal_id: string; status: string; revision: number; content: PlanContent }[];
  inputs: { id: string; title: string; status: string; criteria: {
    id: string; requirement_text: string; status: string; value: string; explanation: string;
    origin?: "USER" | "DOCUMENT"; documentIds?: string[]; attachments?: { documentId: string; name: string; stale: boolean }[]; historicalDocumentIds?: string[];
    assessed?: boolean; stale: boolean; historicalInsightIds?: string[]; insightIds: string[]; sources: PlanningEvidence[];
  }[] }[];
  evidence: PlanningEvidence[];
  preliminary?: { id: string; title: string; value: string; type: string; evidenceState: string; sourceLinks?: Record<string, unknown>[] }[];
  reviewHistory?: { id: string; createdAt: string; changes: { criterionId: string; requirement?: string; before: { value: string | null; refs: string }; after: { value: string; explanation: string; reviewed: boolean } }[] }[];
};
export type PlanningEvidence = {
  journalItemId?: string | null; id: string; documentId: string; documentName: string; title: string; value: string; quote: string;
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
        stale: current.stale, origin: current.origin, attachments: current.attachments, explanation: current.explanation, sources: current.sources };
    }) }];
  });
}

/** Source identity is the insight ID, never its document or passage. */
export function uniqueInsights<T extends { id: string }>(sources: readonly T[]): T[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (seen.has(source.id)) return false;
    seen.add(source.id);
    return true;
  });
}
