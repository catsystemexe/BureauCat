"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookmarkCheck, Brain, Check, Download, Trash2 } from "lucide-react";
import { MeetingPrepButton } from "@/components/chat/MeetingPrepButton";
import { analysisReferenceColor, type AnalysisReference, type ReferenceIssue } from "@/lib/analysis/references";
import { ANALYSIS_CATEGORIES, IDENTIFICATION_ROLES, classifyAnalysisInsight } from "@/lib/analysis/presentation";
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
  onOpenAnalysisSourceDocument,
  onOpenAnalysisSourceReference,
  targetAnalysisInsight,
  onJournalRefreshRequested,
  selectedSituationId,
  hoveredBookmarkPinId
}: {
  activeAnalysisDocument?: CaseDocument | null;
  caseItem: CaseSummary;
  onActiveAnalysisInsightsChange?: (insights: DocumentInsight[]) => void;
  onCloseAnalysisDocument?: () => void;
  onOpenAnalysisSourceDocument?: (documentId: string) => void;
  onOpenAnalysisSourceReference?: (reference: AnalysisReference) => Promise<boolean>;
  targetAnalysisInsight?: { analysisDocumentId: string; insightId: string; token: number } | null;
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
  const [referenceSnapshot, setReferenceSnapshot] = useState<{ documentId: string; references: AnalysisReference[]; issues: ReferenceIssue[] } | null>(null);
  const referenceByInsight = new Map((referenceSnapshot?.documentId === activeAnalysisDocument?.id ? referenceSnapshot?.references ?? [] : []).map((reference) => [reference.insightId, reference]));
  const analysisContentRef = useRef<HTMLDivElement | null>(null);
  const analysisDocumentIdRef = useRef(activeAnalysisDocument?.id ?? null);
  useLayoutEffect(() => {
    analysisDocumentIdRef.current = activeAnalysisDocument?.id ?? null;
    return () => { analysisDocumentIdRef.current = null; };
  }, [activeAnalysisDocument?.id]);
  const [analysisInsightsError, setAnalysisInsightsError] = useState<string | null>(null);
  const [expandedInsightIds, setExpandedInsightIds] = useState<string[]>([]);
  const [hoveredInsightId, setHoveredInsightId] = useState<string | null>(null);
  const [externalHoveredBookmarkPinId, setExternalHoveredBookmarkPinId] = useState<string | null>(null);
  const insightSourceScrollRef = useRef<{ insightId: string; timer: number } | null>(null);

  function cancelInsightSourceScroll(insightId?: string) {
    const pending = insightSourceScrollRef.current;
    if (!pending || (insightId && pending.insightId !== insightId)) return;
    window.clearTimeout(pending.timer);
    insightSourceScrollRef.current = null;
  }

  useLayoutEffect(() => {
    return () => cancelInsightSourceScroll();
  }, [activeAnalysisDocument?.id, selectedSituationId, analysisInsights, expandedInsightIds, referenceSnapshot]);

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
    let isMounted = true, version = 0, loaded = false;
    setAnalysisInsights([]);
    setReferenceSnapshot(null);
    async function loadAnalysisInsights() {
      const request = ++version;
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
        const response = await fetch(`/api/documents/${activeAnalysisDocument.id}/references`, {
          cache: "no-store"
        });
        const data = (await response.json()) as { insights?: DocumentInsight[]; references?: AnalysisReference[]; issues?: ReferenceIssue[]; error?: string };

        if (!response.ok || !Array.isArray(data.insights)) {
          throw new Error(data.error ?? "Insighty se nepodařilo načíst.");
        }

        if (isMounted && request === version) {
          const currentInsights = data.insights.filter((insight) => insight.document_id === activeAnalysisDocument.id);
          setAnalysisInsights(currentInsights);
          setReferenceSnapshot({ documentId: activeAnalysisDocument.id, references: data.references ?? [], issues: data.issues ?? [] });
          const preserveExpanded = loaded;
          setExpandedInsightIds((current) => preserveExpanded ? current.filter((id) => currentInsights.some((insight) => insight.id === id)) :
            currentInsights.filter((insight) => insight.status === "pending").map((insight) => insight.id));
          loaded = true;
        }
      } catch (loadError) {
        if (isMounted && request === version) {
          setAnalysisInsights([]);
          setAnalysisInsightsError(loadError instanceof Error ? loadError.message : "Insighty se nepodařilo načíst.");
        }
      }
    }

    void loadAnalysisInsights();
    const refresh = () => { void loadAnalysisInsights(); };
    window.addEventListener("bureaucat:document-pins-refresh", refresh);

    return () => {
      isMounted = false;
      window.removeEventListener("bureaucat:document-pins-refresh", refresh);
    };
  }, [activeAnalysisDocument]);

  useEffect(() => {
    if (!targetAnalysisInsight || targetAnalysisInsight.analysisDocumentId !== activeAnalysisDocument?.id ||
        referenceSnapshot?.documentId !== activeAnalysisDocument.id || !analysisInsights.some((insight) => insight.id === targetAnalysisInsight.insightId)) return;
    setExpandedInsightIds((current) => current.includes(targetAnalysisInsight.insightId) ? current : [...current, targetAnalysisInsight.insightId]);
    const frame = window.requestAnimationFrame(() => {
      const card = [...(analysisContentRef.current?.querySelectorAll<HTMLElement>("[data-insight-id]") ?? [])]
        .find((element) => element.dataset.insightId === targetAnalysisInsight.insightId);
      card?.scrollIntoView({ block: "nearest" });
      card?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [targetAnalysisInsight, activeAnalysisDocument?.id, referenceSnapshot, analysisInsights]);

  function getAnalysisInsightLabel(type: string) {
    if (type === "risk") return "Riziko";
    if (type === "conflict") return "Rozpor";
    if (type === "question") return "Otázka";
    if (type === "legal_reference") return "Právní odkaz";
    if (type === "term") return "Termín";
    if (type === "identifier") return "Identifikátor";
    if (type === "claim") return "Tvrzení";
    return "Poznatek";
  }

  function getAnalysisInsightStatusLabel(status: string) {
    if (status === "approved") return "Schváleno";
    if (status === "rejected") return "Zamítnuto";
    if (status === "journalized") return "Zapsáno";
    return "Čeká";
  }

  function getAnalysisInsightColor(type: string) {
    if (type === "risk" || type === "conflict") return "#f97316";
    if (type === "question") return "#eab308";
    if (type === "legal_reference") return "#8b5cf6";
    if (type === "term") return "#8b5cf6";
    if (type === "identifier") return "#6b7280";
    return "#22c55e";
  }

  function getAnalysisSectionKeyForInsight(insight: DocumentInsight) {
    if (insight.insight_type === "identifier") return "Identifikace";
    if (insight.insight_type === "legal_reference") return "Paragrafy a úřední jazyk";
    if (insight.insight_type === "risk" || insight.insight_type === "conflict" || insight.insight_type === "term") return "Rizika, lhůty a rozpory";
    if (insight.insight_type === "question") return "Otázky";
    return "Klíčové skutečnosti";
  }

  function dispatchScrollToInsightSource(insight: DocumentInsight) {
    const reference = referenceByInsight.get(insight.id);
    if (!reference) return;

    window.dispatchEvent(
      new CustomEvent("bureaucat:scroll-to-source-range", {
        detail: {
          documentId: reference.sourceDocumentId,
          startOffset: reference.startOffset,
          endOffset: reference.endOffset,
          quote: reference.quote,
          insightId: insight.id
        }
      })
    );
  }

  function handleInsightMouseEnter(insight: DocumentInsight, isExpanded: boolean) {
    cancelInsightSourceScroll();
    setHoveredInsightId(insight.id);
    window.dispatchEvent(new CustomEvent("bureaucat:analysis-insight-hover", { detail: { insightId: insight.id } }));
    const reference = referenceByInsight.get(insight.id);
    if (reference) {
      window.dispatchEvent(new CustomEvent("bureaucat:bookmark-pin-hover", { detail: { pinId: reference.pinId } }));
    }
    if (isExpanded) {
      insightSourceScrollRef.current = {
        insightId: insight.id,
        timer: window.setTimeout(() => {
          insightSourceScrollRef.current = null;
          dispatchScrollToInsightSource(insight);
        }, 280)
      };
    }
  }

  function handleInsightMouseLeave(insight: DocumentInsight) {
    cancelInsightSourceScroll(insight.id);
    setHoveredInsightId((currentId) => currentId === insight.id ? null : currentId);
    window.dispatchEvent(new CustomEvent("bureaucat:analysis-insight-leave", { detail: { insightId: insight.id } }));
    const reference = referenceByInsight.get(insight.id);
    if (reference) {
      window.dispatchEvent(new CustomEvent("bureaucat:bookmark-pin-leave", { detail: { pinId: reference.pinId } }));
    }
  }


  function renderAnalysisInsightCard(insight: DocumentInsight) {
    const isExpanded = expandedInsightIds.includes(insight.id);
    const reference = referenceByInsight.get(insight.id);
    const placement = classifyAnalysisInsight(insight);
    const isBookmarkHovered =
      ((hoveredBookmarkPinId !== null && hoveredBookmarkPinId !== undefined) || externalHoveredBookmarkPinId !== null) &&
      reference?.pinId === (hoveredBookmarkPinId ?? externalHoveredBookmarkPinId);

    return (
      <span
        className="analysis-inline-insight-wrap"
        key={insight.id}
        data-insight-id={insight.id}
        style={{ "--insight-link-color": reference ? analysisReferenceColor(reference.color) : getAnalysisInsightColor(insight.insight_type) } as React.CSSProperties}
      >
        {reference ? <button type="button" className="analysis-reference-index" data-reference-number={reference.number}
          aria-label={`Odkaz ${reference.number}: otevřít zdroj poznatku ${insight.title}`}
          style={{ "--reference-color": analysisReferenceColor(reference.color) } as React.CSSProperties}
          onMouseEnter={() => handleInsightMouseEnter(insight, isExpanded)} onMouseLeave={() => handleInsightMouseLeave(insight)}
          onFocus={() => handleInsightMouseEnter(insight, isExpanded)} onBlur={() => handleInsightMouseLeave(insight)}
          onClick={async () => {
            setExpandedInsightIds((current) => current.includes(insight.id) ? current : [...current, insight.id]);
            if (onOpenAnalysisSourceReference) {
              const opened = await onOpenAnalysisSourceReference(reference);
              if (!opened && analysisDocumentIdRef.current === reference.analysisDocumentId) setAnalysisInsightsError("Zdroj poznatku se nepodařilo otevřít.");
            } else dispatchScrollToInsightSource(insight);
          }} /> : null}
        {placement.time ? <span className="analysis-time-kind">{placement.time}</span> : null}
        <button
          className={`analysis-inline-insight analysis-inline-insight-${insight.insight_type} analysis-inline-insight-status-${insight.status}${isBookmarkHovered || isExpanded ? " analysis-inline-insight-bookmark-hover" : ""}${isBookmarkHovered ? " analysis-reference-matched" : ""}`}
          onClick={() => {
            const willExpand = !expandedInsightIds.includes(insight.id);
            toggleExpandedInsight(insight.id);

            if (willExpand) {
              dispatchScrollToInsightSource(insight);
            }
          }}
          onMouseEnter={() => handleInsightMouseEnter(insight, isExpanded)}
          onMouseLeave={() => handleInsightMouseLeave(insight)}
          onFocus={() => handleInsightMouseEnter(insight, isExpanded)}
          onBlur={() => handleInsightMouseLeave(insight)}
          title={insight.title}
          type="button"
        >
          <span className="analysis-inline-insight-status-dot" aria-hidden="true" />
          <span className="analysis-inline-insight-text">{insight.title}</span>
        </button>

        {isExpanded ? (
          <span className="analysis-inline-insight-detail">
            {insight.content ? <span className="analysis-insight-content">{insight.content}</span> : null}
            {!reference ? <span className="analysis-reference-unavailable">{referenceSnapshot?.issues.find((issue) => issue.insightId === insight.id)?.message ?? "Ověřený číselný odkaz není dostupný."}</span> : null}
            {insight.source_text ? (
              <span className="analysis-inline-insight-source">{insight.source_text}</span>
            ) : null}

            {insight.status === "pending" ? (
              <span className="analysis-inline-insight-detail-actions" aria-label="Rozhodnutí insightu">
                <button
                  aria-label="Schválit insight"
                  onClick={(event) => {
                    event.stopPropagation();
                    void updateAnalysisInsightStatus(insight.id, "approved");
                  }}
                  title="Schválit insight"
                  type="button"
                >
                  <Check aria-hidden="true" />
                  <span>Potvrdit</span>
                </button>
                <button
                  aria-label="Schválit a zapsat do zápisníku s bookmarkem"
                  onClick={(event) => {
                    event.stopPropagation();
                    void journalizeAnalysisInsight(insight.id);
                  }}
                  title="Schválit + zapsat do zápisníku + bookmark"
                  type="button"
                >
                  <BookmarkCheck aria-hidden="true" />
                  <span>Potvrdit + bookmark</span>
                </button>
                <button
                  aria-label="Odmítnout insight"
                  onClick={(event) => {
                    event.stopPropagation();
                    void deleteAnalysisInsight(insight.id);
                  }}
                  title="Odmítnout insight"
                  type="button"
                >
                  <Trash2 aria-hidden="true" />
                  <span>Smazat</span>
                </button>
              </span>
            ) : null}
          </span>
        ) : null}
      </span>
    );
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
      collapseAnalysisInsight(insightId);
    } catch (updateError) {
      setAnalysisInsightsError(
        updateError instanceof Error ? updateError.message : "Insight se nepodařilo upravit."
      );
    }
  }


  async function deleteAnalysisInsight(insightId: string) {
    try {
      setAnalysisInsightsError(null);

      const response = await fetch(`/api/document-insights/${insightId}`, {
        method: "DELETE"
      });

      const data = (await response.json()) as { deleted?: boolean; error?: string };

      if (!response.ok || !data.deleted) {
        throw new Error(data.error ?? "Insight se nepodařilo smazat.");
      }

      setAnalysisInsights((currentInsights) =>
        currentInsights.filter((insight) => insight.id !== insightId)
      );
      collapseAnalysisInsight(insightId);
    } catch (deleteError) {
      setAnalysisInsightsError(
        deleteError instanceof Error ? deleteError.message : "Insight se nepodařilo smazat."
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
      collapseAnalysisInsight(insightId);

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

    const activeInsightsById = activeIds
      .map((id) => analysisInsights.find((insight) => insight.id === id))
      .filter((insight): insight is DocumentInsight => Boolean(insight));

    const activePinId = hoveredBookmarkPinId ?? externalHoveredBookmarkPinId;

    const activeInsightsByPin = activePinId
      ? analysisInsights.filter((insight) => insight.source_pin_id === activePinId)
      : [];

    const activeInsights = [...activeInsightsById, ...activeInsightsByPin].filter(
      (insight, index, array) => array.findIndex((candidate) => candidate.id === insight.id) === index
    );

    onActiveAnalysisInsightsChange?.(activeInsights);
  }, [
    analysisInsights,
    expandedInsightIds,
    hoveredInsightId,
    hoveredBookmarkPinId,
    externalHoveredBookmarkPinId,
    onActiveAnalysisInsightsChange
  ]);

  function collapseAnalysisInsight(insightId: string) {
    setExpandedInsightIds((currentIds) => currentIds.filter((id) => id !== insightId));
  }

  function toggleExpandedInsight(insightId: string) {
    setExpandedInsightIds((currentIds) =>
      currentIds.includes(insightId)
        ? currentIds.filter((id) => id !== insightId)
        : [...currentIds, insightId]
    );
  }

  function renderAnalysisPlainTextSegment(segment: string, keyPrefix: string) {
    const normalizedSegment = segment
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/(^|\n)##\s+/g, "$1## ");

    const lines = normalizedSegment.split("\n");
    const parts: React.ReactNode[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const rawLine = lines[index];
      const line = rawLine.trim();

      if (!line) {
        continue;
      }

      if (line.startsWith("## ")) {
        if (parts.length > 0) {
          parts.push("\n\n");
        }

        parts.push(
          <span className="analysis-category-heading" key={`${keyPrefix}-heading-${index}`}>
            {line.replace(/^##\s+/, "")}
          </span>
        );

        parts.push("\n\n");
        continue;
      }

      parts.push(rawLine.replace(/^##\s+/, ""));

      const nextLine = lines[index + 1]?.trim();

      if (nextLine && !nextLine.startsWith("## ")) {
        parts.push("\n");
      }
    }

    return parts;
  }

  useEffect(() => {
    const expandedInsights = expandedInsightIds
      .map((id) => analysisInsights.find((insight) => insight.id === id))
      .filter((insight): insight is DocumentInsight => Boolean(insight));

    const expandedPinIds = expandedInsights
      .map((insight) => insight.source_pin_id)
      .filter((pinId): pinId is string => typeof pinId === "string" && pinId.length > 0);

    const expandedInsightIdSet = new Set(expandedInsights.map((insight) => insight.id));

    window.dispatchEvent(
      new CustomEvent("bureaucat:expanded-insight-links-change", {
        detail: {
          insightIds: [...expandedInsightIdSet],
          pinIds: [...new Set(expandedPinIds)]
        }
      })
    );

    return () => {
      window.dispatchEvent(
        new CustomEvent("bureaucat:expanded-insight-links-change", {
          detail: {
            insightIds: [],
            pinIds: []
          }
        })
      );
    };
  }, [analysisInsights, expandedInsightIds]);

  function splitAnalysisMarkdownSections(text: string) {
    const normalizedText = text
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n");

    const matches = [...normalizedText.matchAll(/^##\s+(.+)$/gm)];

    return matches.map((match, index) => {
      const headingStart = match.index ?? 0;
      const headingText = match[0];
      const title = match[1].trim();
      const bodyStart = headingStart + headingText.length;
      const nextHeadingStart = matches[index + 1]?.index ?? normalizedText.length;
      const rawBody = normalizedText.slice(bodyStart, nextHeadingStart);
      const bodyTrimStart = rawBody.match(/^\n*/)?.[0].length ?? 0;
      const body = rawBody.trim();

      return {
        title,
        body,
        bodyStartOffset: bodyStart + bodyTrimStart
      };
    });
  }

  function renderAnalysisStructuredText(_text: string) {
    const currentInsights = analysisInsights.filter((insight) => insight.document_id === activeAnalysisDocument?.id);
    return <div className="analysis-section-list">
      {ANALYSIS_CATEGORIES.map((category) => {
        const entries = currentInsights.filter((insight) => classifyAnalysisInsight(insight).category === category);
        if (!entries.length) return null;
        return <section className="analysis-section-block" key={category}>
          <h4 className="analysis-section-title">{category}</h4>
          {category === "Identifikace" ? IDENTIFICATION_ROLES.map((role) => {
            const members = entries.filter((insight) => classifyAnalysisInsight(insight).role === role);
            return members.length ? <section className="analysis-identification-role" key={role} aria-label={role}>
              <h5>{role}</h5><div className="analysis-section-body">{members.map(renderAnalysisInsightCard)}</div>
            </section> : null;
          }) : <div className="analysis-section-body">{entries.map(renderAnalysisInsightCard)}</div>}
        </section>;
      })}
    </div>;
  }

  function renderAnalysisTextWithInlineInsights(text: string, baseOffset = 0) {
    const normalizedAnalysisText = text
      .replace(/\n{3,}/g, "\n\n")
      .replace(/(^|\n)##\s+/g, "$1## ");
    
    console.log("TEXT LENGTH", normalizedAnalysisText.length);

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
          insight.analysis_start_offset >= baseOffset &&
          insight.analysis_end_offset <= baseOffset + normalizedAnalysisText.length
      )
      .map((insight) => ({
        insight,
        start: insight.analysis_start_offset! - baseOffset,
        end: insight.analysis_end_offset! - baseOffset
      }))
      .sort((a, b) => a.start - b.start);

    console.log("INLINE COUNT", inlineInsights.length);

    inlineInsights.forEach((i) => {
      console.log(
        "INLINE",
        i.insight.title,
        i.start,
        i.end,
        normalizedAnalysisText.slice(i.start, i.end)
      );
    });
    
    if (inlineInsights.length === 0) {
      return text;
    }

    const parts: React.ReactNode[] = [];
    let cursor = 0;

    for (let index = 0; index < inlineInsights.length; index += 1) {
      const range = inlineInsights[index];

      if (range.start > cursor) {
        parts.push(...renderAnalysisPlainTextSegment(normalizedAnalysisText.slice(cursor, range.start), `plain-${cursor}`));
      }

      const isExpanded = expandedInsightIds.includes(range.insight.id);
      const isBookmarkHovered =
        ((hoveredBookmarkPinId !== null && hoveredBookmarkPinId !== undefined) || externalHoveredBookmarkPinId !== null) &&
        range.insight.source_pin_id === (hoveredBookmarkPinId ?? externalHoveredBookmarkPinId);
      const selectedText = normalizedAnalysisText.slice(range.start, range.end);

      parts.push(
        <span
          className="analysis-inline-insight-wrap"
          key={range.insight.id}
          style={{ "--insight-link-color": getAnalysisInsightColor(range.insight.insight_type) } as React.CSSProperties}
        >
          <button
            className={`analysis-inline-insight analysis-inline-insight-${range.insight.insight_type} analysis-inline-insight-status-${range.insight.status}${isBookmarkHovered || isExpanded ? " analysis-inline-insight-bookmark-hover" : ""}`}
            onClick={() => toggleExpandedInsight(range.insight.id)}
            onMouseEnter={() => handleInsightMouseEnter(range.insight, isExpanded)}
            onMouseLeave={() => handleInsightMouseLeave(range.insight)}
            title={range.insight.title}
            type="button"
          >
            <span className="analysis-inline-insight-status-dot" aria-hidden="true" />
            <span className="analysis-inline-insight-text">{selectedText}</span>
          </button>

          {isExpanded ? (
            <span className="analysis-inline-insight-detail">
              {range.insight.source_text ? (
                <span className="analysis-inline-insight-source">{range.insight.source_text}</span>
              ) : null}

              {range.insight.status === "pending" ? (
                <span className="analysis-inline-insight-detail-actions" aria-label="Rozhodnutí insightu">
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
                    <span>Potvrdit</span>
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
                    <span>Potvrdit + bookmark</span>
                  </button>
                  <button
                    aria-label="Odmítnout insight"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteAnalysisInsight(range.insight.id);
                    }}
                    title="Odmítnout insight"
                    type="button"
                  >
                    <Trash2 aria-hidden="true" />
                    <span>Smazat</span>
                  </button>
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      );

      const nextRange = inlineInsights[index + 1];
      const sectionEnd = normalizedAnalysisText.indexOf("\n## ", range.end);
      const blockEnd = nextRange
        ? nextRange.start
        : sectionEnd >= 0
          ? sectionEnd
          : normalizedAnalysisText.length;

      cursor = Math.max(range.end, blockEnd);
    }

    if (cursor < text.length) {
      parts.push(...renderAnalysisPlainTextSegment("\n\n" + normalizedAnalysisText.slice(cursor), `plain-${cursor}`));
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
            <div className="analysis-floating-title-block">
              <Brain className="analysis-floating-title-icon" aria-hidden="true" />
              <div className="analysis-floating-title-text">
                <button
                  className="analysis-floating-title-button"
                  disabled={!activeAnalysisDocument.parent_document_id}
                  onClick={() => {
                    if (activeAnalysisDocument.parent_document_id) {
                      onOpenAnalysisSourceDocument?.(activeAnalysisDocument.parent_document_id);
                    }
                  }}
                  title="Otevřít zdrojový dokument"
                  type="button"
                >
                  {(
                    activeAnalysisDocument.display_name ??
                    activeAnalysisDocument.filename
                  ).replace(/^Analýza:\s*/i, "")}
                </button>

              </div>
            </div>
            <div className="analysis-floating-header-actions">
              <button
                type="button"
                title="Export analýzy"
                onClick={() => {
                  setAnalysisInsightsError("Export analýzy bude doplněn později.");
                }}
              >
                <Download size={16} />
              </button>

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
          <div className="analysis-floating-subheader">
            <span className="analysis-pending-counter">
              {analysisInsights.filter((insight) => insight.status === "pending").length > 0
                ? `${analysisInsights.filter((insight) => insight.status === "pending").length} čeká na rozhodnutí`
                : "Všechny insighty vyřešeny"}
            </span>
          </div>
          <div className="analysis-floating-content" ref={analysisContentRef}>
            {analysisInsightsError ? (
              <p className="analysis-insight-error">{analysisInsightsError}</p>
            ) : null}

            <div className="analysis-floating-text">
              {renderAnalysisStructuredText(
                activeAnalysisDocument.processed_markdown ??
                  activeAnalysisDocument.processed_text ??
                  activeAnalysisDocument.extracted_text ??
                  "Analýza neobsahuje text."
              )}
            </div>
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
