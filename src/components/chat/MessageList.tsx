import type { ChatMessage } from "@/components/types";
import { CHAT_MESSAGE_ROLE_LABELS } from "@/lib/constants/uiLabels";

function formatMessageDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="chat-empty-state">
        <strong>Zatím žádné zprávy.</strong>
        <span>Začněte konzultaci popisem situace nebo otázkou k případu.</span>
      </div>
    );
  }

  return (
    <div className="message-list" aria-label="Zprávy konzultace k případu">
      {messages.map((message) => {
        const createdAt = formatMessageDate(message.created_at);

        return (
          <article className={`message-card message-${message.role}`} key={message.id}>
            <div className="message-card-header">
              <span className="message-role">{CHAT_MESSAGE_ROLE_LABELS[message.role]}</span>
              {createdAt ? <time dateTime={message.created_at}>{createdAt}</time> : null}
            </div>
            <p>{message.content}</p>
          </article>
        );
      })}
    </div>
  );
}
