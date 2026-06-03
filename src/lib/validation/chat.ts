import { z } from "zod";
import { suggestionJournalItemSchema } from "@/lib/validation/suggestions";

export const chatMessageRoleSchema = z.enum(["user", "assistant", "system"]);

export const createChatMessageSchema = z
  .object({
    content: z.string().trim().min(1, "Message content is required.")
  })
  .strict();

export const aiChatResponseSchema = z
  .object({
    assistant_reply: z.string().trim().min(1, "Assistant reply is required."),
    suggestions: z.array(suggestionJournalItemSchema).default([])
  })
  .strict();

export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;
export type CreateChatMessageInput = z.infer<typeof createChatMessageSchema>;
export type AIChatResponse = z.infer<typeof aiChatResponseSchema>;
