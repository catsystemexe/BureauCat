"use client";

import { useCallback, useEffect, useState } from "react";
import { BookmarkCheck, Check, Trash2 } from "lucide-react";
import { MeetingPrepButton } from "@/components/chat/MeetingPrepButton";
import { MeetingPrepCard } from "@/components/chat/MeetingPrepCard";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { MessageList } from "@/components/chat/MessageList";
import { SuggestionPreview } from "@/components/chat/SuggestionPreview";
import type {
  AISuggestionPreview,
  AISuggestionRecord,
  CaseDocument,
  CaseSummary,
  ChatMessage,
  MeetingPrepReport,
  SuggestionAction,
  SuggestionActionState,
  SuggestionJournalItem,
  DocumentInsight
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
  activeAnalysisDocument = null,
  onActiveAnalysisInsightsChange,
  onCloseAnalysisDocument,
  onJournalRefreshRequested,
  selectedSituationId,
  hoveredBookmarkPinId
}: {
  activeAnalysisDocument?: CaseDocument | null;
  caseItem: CaseSummary;
  onActiveAnalysisInsightsChange?: (insights: DocumentInsight[]) => void;
  onCloseAnalysisDocument?: () => void;
  onJournalRefreshRequested: () => void;
  selectedSituationId: string | null;
  hoveredBookmarkPinId?: string | null;
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
  const [analysisInsights, setAnalysisInsights] = useState<DocumentInsight[]>([]);
  const [analysisInsightsError, setAnalysisInsightsError] = useState<string | null>(null);
  const [expandedInsightIds, setExpandedInsightIds] = useState<string[]>([]);
  const [hoveredInsightId, setHoveredInsightId] = useState<string | null>(null);
  const [externalHoveredBookmarkPinId, setExternalHoveredBookmarkPinId] = useState<string | null>(null);

  useEffect(() => {
    function handleBookmarkPinHover(event: Event) {
      const customEvent = event as CustomEvent<{ pinId?: string }>;
      setExternalHoveredBookmarkPinId(customEvent.detail?.pinId ?? null);
    }

    function handleBookmarkPinLeave() {
      setExternalHoveredBookmarkPinId(null);
    }

    window.addEventListener("bureaucat:bookmark-pin-hover", handleBookmarkPinHover);
    window.addEventListener("bureaucat:bookmark-pin-leave", handleBookmarkPinLeave);

    return () => {
      window.removeEventListener("bureaucat:bookmark-pin-hover", handleBookmarkPinHover);
      window.removeEventListener("bureaucat:bookmark-pin-leave", handleBookmarkPinLeave);
    };
  }, []);

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


  useEffect(() => {
    let isMounted = true;

    async function loadAnalysisInsights() {
      if (!activeAnalysisDocument) {
        setAnalysisInsights([]);
        setAnalysisInsightsError(null);
        setExpandedInsightIds([]);
        setHoveredInsightId(null);
        onActiveAnalysisInsightsChange?.([]);
        return;
      }

      try {
        setAnalysisInsightsError(null);
        const response = await fetch(`/api/documents/${activeAnalysisDocument.id}/insights`, {
          cache: "no-store"
        });
        const data = (await response.json()) as { insights?: DocumentInsight[]; error?: string };

        if (!response.ok || !Array.isArray(data.insights)) {
          throw new Error(data.error ?? "Insighty se nepodařilo načíst.");
        }

        if (isMounted) {
          setAnalysisInsights(data.insights);
        }
      } catch (loadError) {
        if (isMounted) {
          setAnalysisInsights([]);
          setAnalysisInsightsError(loadError instanceof Error ? loadError.message : "Insighty se nepodařilo načíst.");
        }
      }
    }

    void loadAnalysisInsights();

    return () => {
      isMounted = false;
    };
  }, [activeAnalysisDocument]);

  function getAnalysisInsightLabel(type: string) {
    if (type === "risk") return "Riziko";
    if (type === "question") return "Otázka";
    if (type === "legal_reference") return "Právní odkaz";
    if (type === "term") return "Termín";
    if (type === "claim") return "Tvrzení";
    return "Poznatek";
  }

  function getAnalysisInsightStatusLabel(status: string) {
    if (status === "approved") return "Schváleno";
    if (status === "rejected") return "Zamítnuto";
    if (status === "journalized") return "Zapsáno";
    return "Čeká";
  }

  async function updateAnalysisInsightStatus(
    insightId: string,
    status: "approved" | "journalized" | "rejected"
  ) {
    try {
      setAnalysisInsightsError(null);

      const response = await fetch(`/api/document-insights/${insightId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      const data = (await response.json()) as { insight?: DocumentInsight; error?: string };

      if (!response.ok || !data.insight) {
        throw new Error(data.error ?? "Insight se nepodařilo upravit.");
      }

      setAnalysisInsights((currentInsights) =>
        currentInsights.map((insight) =>
          insight.id === insightId ? data.insight! : insight
        )
      );
    } catch (updateError) {
      setAnalysisInsightsError(
        updateError instanceof Error ? updateError.message : "Insight se nepodařilo upravit."
      );
    }
  }


  async function journalizeAnalysisInsight(insightId: string) {
    if (!selectedSituationId) {
      setAnalysisInsightsError("Nejdřív vyber situaci.");
      return;
    }

    try {
      setAnalysisInsightsError(null);

      const response = await fetch(`/api/document-insights/${insightId}/journalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation_id: selectedSituationId })
      });

      const data = (await response.json()) as { insight?: DocumentInsight; error?: string };

      if (!response.ok || !data.insight) {
        throw new Error(data.error ?? "Insight se nepodařilo zapsat.");
      }

      setAnalysisInsights((currentInsights) =>
        currentInsights.map((insight) =>
          insight.id === insightId ? data.insight! : insight
        )
      );

      onJournalRefreshRequested();
      window.dispatchEvent(new CustomEvent("bureaucat:journal-refresh"));
      window.dispatchEvent(new CustomEvent("bureaucat:document-pins-refresh"));
    } catch (journalizeError) {
      setAnalysisInsightsError(
        journalizeError instanceof Error ? journalizeError.message : "Insight se nepodařilo zapsat."
      );
    }
  }

  useEffect(() => {
    const activeIds = [
      ...expandedInsightIds,
      ...(hoveredInsightId ? [hoveredInsightId] : [])
    ].filter((id, index, array) => array.indexOf(id) === index);

    const activeInsights = activeIds
      .map((id) => analysisInsights.find((insight) => insight.id === id))
      .filter((insight): insight is DocumentInsight => Boolean(insight));

    onActiveAnalysisInsightsChange?.(activeInsights);
  }, [analysisInsights, expandedInsightIds, hoveredInsightId, onActiveAnalysisInsightsChange]);

  function toggleExpandedInsight(insightId: string) {
    setExpandedInsightIds((currentIds) =>
      currentIds.includes(insightId)
        ? currentIds.filter((id) => id !== insightId)
        : [...currentIds, insightId]
    );
  }

  function renderAnalysisTextWithInlineInsights(text: string) {
    
    console.log("TEXT LENGTH", text.length);

    console.log(
      "ALL INSIGHTS",
      analysisInsights.map((i) => ({
        title: i.title,
        status: i.status,
        start: i.analysis_start_offset,
        end: i.analysis_end_offset
      }))
    );
    
    const inlineInsights = analysisInsights
      
      
      .filter(
        (insight) =>
          insight.analysis_start_offset !== null &&
          insight.analysis_end_offset !== null &&
          insight.analysis_end_offset > insight.analysis_start_offset &&
          insight.analysis_start_offset >= 0 &&
          insight.analysis_end_offset <= text.length
      )
      .map((insight) => ({
        insight,
        start: insight.analysis_start_offset!,
        end: insight.analysis_end_offset!
      }))
      .sort((a, b) => a.start - b.start);

    console.log("INLINE COUNT", inlineInsights.length);

    inlineInsights.forEach((i) => {
      console.log(
        "INLINE",
        i.insight.title,
        i.start,
        i.end,
        text.slice(i.start, i.end)
      );
    });
    
    if (inlineInsights.length === 0) {
      return text;
    }

    const parts: React.ReactNode[] = [];
    let cursor = 0;

    for (const range of inlineInsights) {
      if (range.start > cursor) {
        parts.push(text.slice(cursor, range.start));
      }

      const isExpanded = expandedInsightIds.includes(range.insight.id);
      const isBookmarkHovered =
        ((hoveredBookmarkPinId !== null && hoveredBookmarkPinId !== undefined) || externalHoveredBookmarkPinId !== null) &&
        range.insight.source_pin_id === (hoveredBookmarkPinId ?? externalHoveredBookmarkPinId);
      const selectedText = text.slice(range.start, range.end);

      parts.push(
        <span className="analysis-inline-insight-wrap" key={range.insight.id}>
          <button
            className={`analysis-inline-insight analysis-inline-insight-${range.insight.insight_type} analysis-inline-insight-status-${range.insight.status}${isBookmarkHovered ? " analysis-inline-insight-bookmark-hover" : ""}`}
            onClick={() => toggleExpandedInsight(range.insight.id)}
            onMouseEnter={() => {
              setHoveredInsightId(range.insight.id);
              window.dispatchEvent(new CustomEvent("bureaucat:analysis-insight-hover", { detail: { insightId: range.insight.id } }));
            }}
            onMouseLeave={() => {
              setHoveredInsightId((currentId) => currentId === range.insight.id ? null : currentId);
              window.dispatchEvent(new CustomEvent("bureaucat:analysis-insight-leave", { detail: { insightId: range.insight.id } }));
            }}
            title={range.insight.title}
            type="button"
          >
            {selectedText}
          </button>

          {range.insight.status === "pending" ? (
            <span className="analysis-inline-insight-quick-actions" aria-label="Rychlé rozhodnutí insightu">
              <button
                aria-label="Schválit insight"
                onClick={(event) => {
                  event.stopPropagation();
                  void updateAnalysisInsightStatus(range.insight.id, "approved");
                }}
                title="Schválit insight"
                type="button"
              >
                <Check aria-hidden="true" />
              </button>
              <button
                aria-label="Schválit a zapsat do zápisníku s bookmarkem"
                onClick={(event) => {
                  event.stopPropagation();
                  void journalizeAnalysisInsight(range.insight.id);
                }}
                title="Schválit + zapsat do zápisníku + bookmark"
                type="button"
              >
                <BookmarkCheck aria-hidden="true" />
              </button>
              <button
                aria-label="Odmítnout insight"
                onClick={(event) => {
                  event.stopPropagation();
                  void updateAnalysisInsightStatus(range.insight.id, "rejected");
                }}
                title="Odmítnout insight"
                type="button"
              >
                <Trash2 aria-hidden="true" />
              </button>
            </span>
          ) : null}

          {isExpanded ? (
            <span className="analysis-inline-insight-detail">
              <span className="analysis-inline-insight-meta">
                <strong>{getAnalysisInsightLabel(range.insight.insight_type)}</strong>
                <em>{getAnalysisInsightStatusLabel(range.insight.status)}</em>
              </span>
              <span className="analysis-inline-insight-title">{range.insight.title}</span>
              {range.insight.content ? (
                <span className="analysis-inline-insight-content">{range.insight.content}</span>
              ) : null}
              {range.insight.source_text ? (
                <span className="analysis-inline-insight-source">{range.insight.source_text}</span>
              ) : null}
            </span>
          ) : null}
        </span>
      );

      cursor = range.end;
    }

    if (cursor < text.length) {
      parts.push(text.slice(cursor));
    }

    return parts;
  }


  async function deleteAnalysisDocument(
    analysisDocumentId: string
  ) {
    const confirmed = window.confirm(
      "Smazat analýzu včetně insightů a bookmarků?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/documents/${analysisDocumentId}/analysis`,
        {
          method: "DELETE"
        }
      );

      if (!response.ok) {
        throw new Error(
          "Analýzu se nepodařilo smazat."
        );
      }

      setAnalysisInsights([]);
      setExpandedInsightIds([]);
      setHoveredInsightId(null);

      onActiveAnalysisInsightsChange?.([]);
      onJournalRefreshRequested();
      window.dispatchEvent(new CustomEvent("bureaucat:journal-refresh"));
      window.dispatchEvent(new CustomEvent("bureaucat:document-pins-refresh"));

      onCloseAnalysisDocument?.();
    } catch (error) {
      setAnalysisInsightsError(
        error instanceof Error
          ? error.message
          : "Analýzu se nepodařilo smazat."
      );
    }
  }

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

      {activeAnalysisDocument ? (
        <section className="analysis-floating-panel" aria-label="Inspekce analýzy dokumentu">
          <header className="analysis-floating-header">
            <div>
              <p>Analýza dokumentu</p>
              <h3>{activeAnalysisDocument.display_name ?? activeAnalysisDocument.filename}</h3>
              <span className="analysis-pending-counter">
                {analysisInsights.filter((insight) => insight.status === "pending").length > 0
                  ? `${analysisInsights.filter((insight) => insight.status === "pending").length} čeká na rozhodnutí`
                  : "Všechny insighty vyřešeny"}
              </span>
            </div>
            <div className="analysis-floating-header-actions">
              <button
                type="button"
                title="Smazat analýzu"
                onClick={() => {
                  if (activeAnalysisDocument) {
                    void deleteAnalysisDocument(
                      activeAnalysisDocument.id
                    );
                  }
                }}
              >
                <Trash2 size={16} />
              </button>

              <button
                type="button"
                onClick={onCloseAnalysisDocument}
                title="Zavřít analýzu"
              >
                ×
              </button>
            </div>
          </header>
          <div className="analysis-floating-content">
            {analysisInsightsError ? (
              <p className="analysis-insight-error">{analysisInsightsError}</p>
            ) : null}

            <pre className="analysis-floating-text">
              {renderAnalysisTextWithInlineInsights(
                activeAnalysisDocument.processed_markdown ??
                  activeAnalysisDocument.processed_text ??
                  activeAnalysisDocument.extracted_text ??
                  "Analýza neobsahuje text."
              )}
            </pre>
          </div>
        </section>
      ) : null}

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
