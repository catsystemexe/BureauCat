"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaseSummary, JournalItem, JournalSectionKey } from "@/components/types";

const JOURNAL_SECTIONS: Array<{ key: JournalSectionKey; label: string }> = [
  { key: "description", label: "Description" },
  { key: "goals", label: "Goals" },
  { key: "risks", label: "Risks" },
  { key: "open_questions", label: "Open Questions" },
  { key: "strategy", label: "Strategy" }
];

type JournalResponse = {
  journal?: JournalItem[];
};

type JournalItemsBySection = Record<JournalSectionKey, JournalItem[]>;

function createEmptyJournalGroups(): JournalItemsBySection {
  return JOURNAL_SECTIONS.reduce((groups, section) => {
    groups[section.key] = [];
    return groups;
  }, {} as JournalItemsBySection);
}

function formatBadgeLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function JournalItemCard({ item }: { item: JournalItem }) {
  return (
    <article className="journal-item-card" aria-label={item.title}>
      <div className="journal-item-card-header">
        <span className="journal-item-type">{item.item_type}</span>
        <span className={`evidence-badge evidence-${item.evidence_state}`}>
          {formatBadgeLabel(item.evidence_state)}
        </span>
      </div>
      <h4>{item.title}</h4>
      {item.value ? <p className="journal-item-value">{item.value}</p> : null}
      {item.status !== "active" ? (
        <span className="journal-status-badge">{formatBadgeLabel(item.status)}</span>
      ) : null}
    </article>
  );
}

export function JournalSection({
  items,
  label,
  sectionKey
}: {
  items: JournalItem[];
  label: string;
  sectionKey: JournalSectionKey;
}) {
  return (
    <section className="journal-section" aria-labelledby={`journal-section-${sectionKey}`}>
      <h3 id={`journal-section-${sectionKey}`}>{label}</h3>
      {items.length > 0 ? (
        <div className="journal-items-list">
          {items.map((item) => (
            <JournalItemCard item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <p className="journal-empty-message">No items yet.</p>
      )}
    </section>
  );
}

export function JournalPanel({ caseItem }: { caseItem: CaseSummary }) {
  const [journalItems, setJournalItems] = useState<JournalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadJournal() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/cases/${caseItem.id}/journal`, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(response.status === 404 ? "Case not found." : "Unable to load journal.");
        }

        const data = (await response.json()) as JournalResponse;

        if (!Array.isArray(data.journal)) {
          throw new Error("Journal response did not include journal items.");
        }

        if (isMounted) {
          setJournalItems(data.journal);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setJournalItems([]);
          setError(loadError instanceof Error ? loadError.message : "Unable to load journal.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadJournal();

    return () => {
      isMounted = false;
    };
  }, [caseItem.id]);

  const journalItemsBySection = useMemo(() => {
    const groups = createEmptyJournalGroups();

    for (const item of journalItems) {
      groups[item.section].push(item);
    }

    return groups;
  }, [journalItems]);

  return (
    <aside className="workspace-panel journal-panel" aria-labelledby="journal-title">
      <p className="panel-kicker">Journal</p>
      <h2 id="journal-title">{caseItem.title}</h2>
      <p className="panel-note">Authoritative working model of this case.</p>
      {isLoading ? <p className="journal-empty-message">Loading journal…</p> : null}
      {error ? <p className="status-message error-message">{error}</p> : null}
      {!isLoading && !error ? (
        <div className="journal-section-list">
          {JOURNAL_SECTIONS.map((section) => (
            <JournalSection
              items={journalItemsBySection[section.key]}
              key={section.key}
              label={section.label}
              sectionKey={section.key}
            />
          ))}
        </div>
      ) : null}
    </aside>
  );
}
