import type { AISuggestionPreview } from "@/components/types";

function formatBadgeLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function SuggestionPreview({ suggestions }: { suggestions: AISuggestionPreview[] }) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <section className="suggestion-preview-section" aria-labelledby="suggestion-preview-title">
      <div>
        <p className="panel-kicker">AI Suggestions</p>
        <h3 id="suggestion-preview-title">Pending preview</h3>
        <p className="panel-note">Approval actions will be added in the next task.</p>
      </div>
      <div className="suggestion-preview-list">
        {suggestions.map((suggestion) => (
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
          </article>
        ))}
      </div>
    </section>
  );
}
