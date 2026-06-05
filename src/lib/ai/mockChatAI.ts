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
      "Vaši zprávu jsem zaznamenal. Mohu ji s vámi rozebrat a navrhnout body ke kontrole před přidáním do zápisníku.",
    suggestions: trimmedMessage
      ? [
          {
            section: "open_questions",
            item_type: "QUESTION",
            title: "Upřesnit vyjádření uživatele",
            value: `Upřesnit nebo ověřit: ${trimmedMessage}`,
            explanation:
              "Návrh asistenta vznikl z poslední zprávy v konzultaci. Do zápisníku se přidá až po schválení uživatelem.",
            evidence_state: "unverified",
            status: "active",
            display_order: 0,
            source_links_json: JSON.stringify([
              {
                document_name: "Vyjádření uživatele",
                quoted_text: quotedText
              }
            ])
          }
        ]
      : []
  };
}
