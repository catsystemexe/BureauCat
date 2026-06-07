"use client";

import { useCallback, useEffect, useState } from "react";
import { MeetingPrepButton } from "@/components/chat/MeetingPrepButton";
import { MeetingPrepCard } from "@/components/chat/MeetingPrepCard";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { MessageList } from "@/components/chat/MessageList";
import { SuggestionPreview } from "@/components/chat/SuggestionPreview";
import type {
  AISuggestionPreview,
  AISuggestionRecord,
  CaseSummary,
  ChatMessage,
  MeetingPrepReport,
  SuggestionAction,
  SuggestionActionState,
  SuggestionJournalItem
} from "@/components/types";

type MessagesResponse = {
  messages?: ChatMessage[];
};

type SendChatResponse = {
  assistantMessage?: ChatMessage;
  suggestions?: AISuggestionRecord[];
};

type MeetingPrepResponse = {
  meetingPrep?: MeetingPrepReport;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseMeetingPrepResponse(data: MeetingPrepResponse): MeetingPrepReport {
  const meetingPrep = data.meetingPrep;

  if (
    !meetingPrep ||
    typeof meetingPrep.summary !== "string" ||
    !isStringArray(meetingPrep.goals) ||
    !isStringArray(meetingPrep.risks) ||
    !isStringArray(meetingPrep.documents_to_bring) ||
    !isStringArray(meetingPrep.questions_to_ask) ||
    typeof meetingPrep.strategy !== "string"
  ) {
    throw new Error("Odpověď neobsahuje platné podklady k jednání.");
  }

  return meetingPrep;
}

function parseSuggestion(record: AISuggestionRecord): AISuggestionPreview | null {
  try {
    const item = JSON.parse(record.suggested_item_json) as SuggestionJournalItem;

    if (!item.section || !item.item_type || !item.title || !item.evidence_state || !item.status) {
      return null;
    }

    return {
      id: record.id,
      status: record.status,
      item
    };
  } catch {
    return null;
  }
}

export function ChatPanel({
  caseItem,
  onJournalRefreshRequested
}: {
  caseItem: CaseSummary;
  onJournalRefreshRequested: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerContent, setComposerContent] = useState("");
  const [suggestionPreviews, setSuggestionPreviews] = useState<AISuggestionPreview[]>([]);
  const [suggestionActionStates, setSuggestionActionStates] = useState<
    Record<string, SuggestionActionState | undefined>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [meetingPrep, setMeetingPrep] = useState<MeetingPrepReport | null>(null);
  const [isPreparingMeeting, setIsPreparingMeeting] = useState(false);
  const [meetingPrepError, setMeetingPrepError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    const response = await fetch(`/api/cases/${caseItem.id}/messages`, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(response.status === 404 ? "Případ nebyl nalezen." : "Zprávy se nepodařilo načíst.");
    }

    const data = (await response.json()) as MessagesResponse;

    if (!Array.isArray(data.messages)) {
      throw new Error("Odpověď neobsahuje zprávy.");
    }

    return data.messages;
  }, [caseItem.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialMessages() {
      try {
        setIsLoading(true);
        setMeetingPrep(null);
        setMeetingPrepError(null);
        const loadedMessages = await loadMessages();

        if (isMounted) {
          setMessages(loadedMessages);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setMessages([]);
          setError(loadError instanceof Error ? loadError.message : "Zprávy se nepodařilo načíst.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInitialMessages();

    return () => {
      isMounted = false;
    };
  }, [loadMessages]);

  async function handleSend() {
    const content = composerContent.trim();

    if (!content || isSending) {
      return;
    }

    try {
      setIsSending(true);
      setError(null);

      const response = await fetch(`/api/cases/${caseItem.id}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        throw new Error(response.status === 404 ? "Případ nebyl nalezen." : "Zprávu se nepodařilo odeslat.");
      }

      const data = (await response.json()) as SendChatResponse;
      const previews = (data.suggestions ?? [])
        .map(parseSuggestion)
        .filter((suggestion): suggestion is AISuggestionPreview => suggestion !== null);
      const loadedMessages = await loadMessages();

      setMessages(loadedMessages);
      setSuggestionPreviews(previews);
      setSuggestionActionStates({});
      setComposerContent("");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Zprávu se nepodařilo odeslat.");
    } finally {
      setIsSending(false);
    }
  }

  async function handlePrepareMeeting() {
    if (isPreparingMeeting) {
      return;
    }

    try {
      setIsPreparingMeeting(true);
      setMeetingPrepError(null);

      const response = await fetch(`/api/cases/${caseItem.id}/meeting-prep`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(response.status === 404 ? "Případ nebyl nalezen." : "Podklady k jednání se nepodařilo připravit.");
      }

      const data = (await response.json()) as MeetingPrepResponse;
      setMeetingPrep(parseMeetingPrepResponse(data));
    } catch (prepareError) {
      setMeetingPrepError(
        prepareError instanceof Error ? prepareError.message : "Podklady k jednání se nepodařilo připravit."
      );
    } finally {
      setIsPreparingMeeting(false);
    }
  }

  async function handleSuggestionAction(suggestionId: string, action: SuggestionAction) {
    setSuggestionActionStates((currentStates) => ({
      ...currentStates,
      [suggestionId]: { loadingAction: action, error: null }
    }));

    try {
      const response = await fetch(`/api/suggestions/${suggestionId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: action === "approve" ? JSON.stringify({}) : undefined
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 409) {
          throw new Error("Tento návrh už nelze změnit.");
        }

        throw new Error("Návrh se nepodařilo upravit.");
      }

      setSuggestionPreviews((currentPreviews) =>
        currentPreviews.map((suggestion) =>
          suggestion.id === suggestionId
            ? { ...suggestion, status: action === "approve" ? "approved" : "rejected" }
            : suggestion
        )
      );
      setSuggestionActionStates((currentStates) => ({
        ...currentStates,
        [suggestionId]: { loadingAction: null, error: null }
      }));

      if (action === "approve") {
        onJournalRefreshRequested();
      }
    } catch (actionError) {
      setSuggestionActionStates((currentStates) => ({
        ...currentStates,
        [suggestionId]: {
          loadingAction: null,
          error: actionError instanceof Error ? actionError.message : "Návrh se nepodařilo upravit."
        }
      }));
    }
  }

  return (
    <main className="workspace-panel chat-panel" aria-labelledby="chat-title">
      <div className="chat-panel-header">
        <div>
          <h2 id="chat-title">Konzultace</h2>
        </div>
      </div>

      <div className="chat-panel-body">
        <section className="workflow-card" aria-labelledby="workflow-card-title">
          <h3 id="workflow-card-title">Doporučený postup</h3>
          <ol>
            <li>Nahrajte relevantní dokumenty.</li>
            <li>Popište situaci v konzultaci.</li>
            <li>Zkontrolujte návrhy asistenta.</li>
            <li>Přidejte důležité body do zápisníku.</li>
            <li>Připravte se na jednání.</li>
          </ol>
        </section>
        {isLoading ? <p className="journal-empty-message">Načítám zprávy…</p> : null}
        {error ? <p className="status-message error-message">{error}</p> : null}
        {meetingPrepError ? (
          <p className="status-message error-message meeting-prep-error">{meetingPrepError}</p>
        ) : null}
        {!isLoading ? <MessageList messages={messages} /> : null}
        {meetingPrep ? <MeetingPrepCard meetingPrep={meetingPrep} /> : null}
        <SuggestionPreview
          actionStates={suggestionActionStates}
          onApprove={(suggestionId) => handleSuggestionAction(suggestionId, "approve")}
          onReject={(suggestionId) => handleSuggestionAction(suggestionId, "reject")}
          suggestions={suggestionPreviews}
        />
      </div>

      <MessageComposer
        content={composerContent}
        isSending={isSending}
        onChange={setComposerContent}
        onSend={handleSend}
      />
    </main>
  );
}
