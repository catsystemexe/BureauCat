import type { ChatContext } from "@/lib/services/chat";

export type MockAIChatResponse = {
  assistant_reply: string;
  suggestions: unknown[];
};

export async function mockChatAI(context: ChatContext): Promise<MockAIChatResponse> {
  const trimmedMessage = context.currentMessage.trim();
  const quotedText = trimmedMessage.slice(0, 500);

  return {
    assistant_reply:
      "I noted your message. This mock assistant can discuss the case workspace and may propose pending Journal suggestions for your review.",
    suggestions: trimmedMessage
      ? [
          {
            section: "open_questions",
            item_type: "QUESTION",
            title: "Clarify user statement",
            value: `Clarify or verify: ${trimmedMessage}`,
            explanation:
              "Mock AI suggestion created from the latest chat message. It remains pending until the user approves it.",
            evidence_state: "unverified",
            status: "active",
            display_order: 0,
            source_links_json: JSON.stringify([
              {
                document_name: "User Statement",
                quoted_text: quotedText
              }
            ])
          }
        ]
      : []
  };
}
