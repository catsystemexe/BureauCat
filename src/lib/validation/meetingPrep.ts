import { z } from "zod";

export const meetingPrepSchema = z
  .object({
    summary: z.string().trim().min(1, "Summary is required."),
    goals: z.array(z.string().trim().min(1)).default([]),
    risks: z.array(z.string().trim().min(1)).default([]),
    documents_to_bring: z.array(z.string().trim().min(1)).default([]),
    questions_to_ask: z.array(z.string().trim().min(1)).default([]),
    strategy: z.string().trim().min(1, "Strategy is required.")
  })
  .strict();

export const meetingPrepResponseSchema = z
  .object({
    meetingPrep: meetingPrepSchema,
    suggestions: z.array(z.never()).default([])
  })
  .strict();

export type MeetingPrep = z.infer<typeof meetingPrepSchema>;
export type MeetingPrepResponse = z.infer<typeof meetingPrepResponseSchema>;
