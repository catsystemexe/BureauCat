import type { AISuggestionPreview, SuggestionActionState } from "@/components/types";

function formatBadgeLabel(value: string) {
  return value.replaceAll("_", " ");
}

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
        <p className="panel-kicker">AI Suggestions</p>
        <h3 id="suggestion-preview-title">Pending preview</h3>
        <p className="panel-note">
          Approve as-is or reject each suggestion before it changes the Journal.
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
                <span>{formatBadgeLabel(suggestion.item.section)}</span>
                <span>{suggestion.item.item_type}</span>
                <span className={`evidence-badge evidence-${suggestion.item.evidence_state}`}>
                  {formatBadgeLabel(suggestion.item.evidence_state)}
                </span>
                <span className="journal-status-badge">{formatBadgeLabel(suggestion.status)}</span>
              </div>
              <h4>{suggestion.item.title}</h4>
              {suggestion.item.value ? <p>{suggestion.item.value}</p> : null}
              <dl className="suggestion-preview-details">
                <div>
                  <dt>Section</dt>
                  <dd>{formatBadgeLabel(suggestion.item.section)}</dd>
                </div>
                <div>
                  <dt>Item type</dt>
                  <dd>{suggestion.item.item_type}</dd>
                </div>
                <div>
                  <dt>Evidence state</dt>
                  <dd>{formatBadgeLabel(suggestion.item.evidence_state)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{formatBadgeLabel(suggestion.status)}</dd>
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
                    {isApproving ? "Approving…" : "Approve"}
                  </button>
                  <button
                    className="suggestion-action reject-action"
                    disabled={isActing}
                    onClick={() => onReject(suggestion.id)}
                    type="button"
                  >
                    {isRejecting ? "Rejecting…" : "Reject"}
                  </button>
                </div>
              ) : (
                <p className="suggestion-action-state">
                  Suggestion {formatBadgeLabel(suggestion.status)}.
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
