import type { FormEvent } from "react";

export function MessageComposer({
  content,
  isSending,
  onChange,
  onSend
}: {
  content: string;
  isSending: boolean;
  onChange: (content: string) => void;
  onSend: () => void;
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSend();
  }

  const trimmedContent = content.trim();

  return (
    <form className="message-composer" onSubmit={handleSubmit}>
      <label className="sr-only" htmlFor="chat-message-input">
        Message
      </label>
      <textarea
        disabled={isSending}
        id="chat-message-input"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ask, analyze, or note something about this case…"
        rows={3}
        value={content}
      />
      <button className="primary-action" disabled={isSending || !trimmedContent} type="submit">
        {isSending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
