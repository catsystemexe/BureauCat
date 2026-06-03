import type { ChatMessage } from "@/components/types";

function formatMessageDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="chat-empty-state">
        <strong>No messages yet.</strong>
        <span>Start the workspace chat by sending a message about this case.</span>
      </div>
    );
  }

  return (
    <div className="message-list" aria-label="Case chat messages">
      {messages.map((message) => {
        const createdAt = formatMessageDate(message.created_at);

        return (
          <article className={`message-card message-${message.role}`} key={message.id}>
            <div className="message-card-header">
              <span className="message-role">{message.role}</span>
              {createdAt ? <time dateTime={message.created_at}>{createdAt}</time> : null}
            </div>
            <p>{message.content}</p>
          </article>
        );
      })}
    </div>
  );
}
