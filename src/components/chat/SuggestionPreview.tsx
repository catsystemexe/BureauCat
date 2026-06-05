import type { AISuggestionPreview, SuggestionActionState } from "@/components/types";
import {
  EVIDENCE_STATE_LABELS,
  JOURNAL_ITEM_TYPE_LABELS,
  JOURNAL_SECTION_LABELS,
  SUGGESTION_STATUS_LABELS
} from "@/lib/constants/uiLabels";

export function SuggestionPreview({
  actionStates,
  onApprove,
  onReject,
  suggestions
}: {
  actionStates: Record<string, SuggestionActionState | undefined>;
  onApprove: (suggestionId: string) => void;
  onReject: (suggestionId: string) => void;
  suggestions: AISuggestionPreview[];
}) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className="suggestion-preview-section" aria-labelledby="suggestion-preview-title">
      <div>
        <p className="panel-kicker">Návrhy asistenta</p>
        <h3 id="suggestion-preview-title">Návrhy ke kontrole</h3>
        <p className="panel-note">
          Každý návrh zkontrolujte. Do zápisníku se přidá až po vašem schválení.
        </p>
      </div>
      <div className="suggestion-preview-list">
        {suggestions.map((suggestion) => {
          const actionState = actionStates[suggestion.id];
          const isPending = suggestion.status === "pending";
          const isApproving = actionState?.loadingAction === "approve";
          const isRejecting = actionState?.loadingAction === "reject";
          const isActing = Boolean(actionState?.loadingAction);

          return (
            <article className="suggestion-preview-card" key={suggestion.id}>
              <div className="suggestion-preview-meta">
                <span>{JOURNAL_SECTION_LABELS[suggestion.item.section]}</span>
                <span>{JOURNAL_ITEM_TYPE_LABELS[suggestion.item.item_type]}</span>
                <span className={`evidence-badge evidence-${suggestion.item.evidence_state}`}>
                  {EVIDENCE_STATE_LABELS[suggestion.item.evidence_state]}
                </span>
                <span className="journal-status-badge">
                  {SUGGESTION_STATUS_LABELS[suggestion.status]}
                </span>
              </div>
              <h4>{suggestion.item.title}</h4>
              {suggestion.item.value ? <p>{suggestion.item.value}</p> : null}
              <dl className="suggestion-preview-details">
                <div>
                  <dt>Sekce</dt>
                  <dd>{JOURNAL_SECTION_LABELS[suggestion.item.section]}</dd>
                </div>
                <div>
                  <dt>Typ položky</dt>
                  <dd>{JOURNAL_ITEM_TYPE_LABELS[suggestion.item.item_type]}</dd>
                </div>
                <div>
                  <dt>Stav podkladů</dt>
                  <dd>{EVIDENCE_STATE_LABELS[suggestion.item.evidence_state]}</dd>
                </div>
                <div>
                  <dt>Stav návrhu</dt>
                  <dd>{SUGGESTION_STATUS_LABELS[suggestion.status]}</dd>
                </div>
              </dl>
              {isPending ? (
                <div className="suggestion-preview-actions">
                  <button
                    className="suggestion-action approve-action"
                    disabled={isActing}
                    onClick={() => onApprove(suggestion.id)}
                    type="button"
                  >
                    {isApproving ? "Přidávám…" : "Přidat do zápisníku"}
                  </button>
                  <button
                    className="suggestion-action reject-action"
                    disabled={isActing}
                    onClick={() => onReject(suggestion.id)}
                    type="button"
                  >
                    {isRejecting ? "Zamítám…" : "Zamítnout"}
                  </button>
                </div>
              ) : (
                <p className="suggestion-action-state">
                  {SUGGESTION_STATUS_LABELS[suggestion.status]}
                </p>
              )}
              {actionState?.error ? (
                <p className="status-message error-message suggestion-action-error">
                  {actionState.error}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
