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
    throw new Error("Meeting prep response did not include a valid report.");
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
      throw new Error(response.status === 404 ? "Case not found." : "Unable to load messages.");
    }

    const data = (await response.json()) as MessagesResponse;

    if (!Array.isArray(data.messages)) {
      throw new Error("Messages response did not include messages.");
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
          setError(loadError instanceof Error ? loadError.message : "Unable to load messages.");
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
        throw new Error(response.status === 404 ? "Case not found." : "Unable to send message.");
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
      setError(sendError instanceof Error ? sendError.message : "Unable to send message.");
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
        throw new Error(response.status === 404 ? "Case not found." : "Unable to prepare meeting.");
      }

      const data = (await response.json()) as MeetingPrepResponse;
      setMeetingPrep(parseMeetingPrepResponse(data));
    } catch (prepareError) {
      setMeetingPrepError(
        prepareError instanceof Error ? prepareError.message : "Unable to prepare meeting."
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
        let responseMessage: string | null = null;

        try {
          const body = (await response.json()) as { error?: string };
          responseMessage = body.error ?? null;
        } catch {
          responseMessage = null;
        }

        if (response.status === 404 || response.status === 409) {
          throw new Error(responseMessage ?? "Suggestion can no longer be changed.");
        }

        throw new Error(responseMessage ?? `Unable to ${action} suggestion.`);
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
          error: actionError instanceof Error ? actionError.message : `Unable to ${action} suggestion.`
        }
      }));
    }
  }

  return (
    <main className="workspace-panel chat-panel" aria-labelledby="chat-title">
      <div className="chat-panel-header">
        <div>
          <p className="panel-kicker">Chat</p>
          <h2 id="chat-title">Workspace chat</h2>
          <p className="panel-note">Chat remains visible in the middle panel for case {caseItem.id}.</p>
        </div>
        <MeetingPrepButton isPreparing={isPreparingMeeting} onPrepare={handlePrepareMeeting} />
      </div>

      <div className="chat-panel-body">
        {isLoading ? <p className="journal-empty-message">Loading messages…</p> : null}
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
