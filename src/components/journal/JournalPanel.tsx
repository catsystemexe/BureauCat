"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaseSummary, JournalItem, JournalSectionKey, Situation } from "@/components/types";
import { SituationTabs } from "@/components/journal/SituationTabs";
import {
  EVIDENCE_STATE_LABELS,
  JOURNAL_ITEM_STATUS_LABELS,
  JOURNAL_ITEM_TYPE_LABELS,
  JOURNAL_SECTION_LABELS
} from "@/lib/constants/uiLabels";

const JOURNAL_SECTIONS = Object.entries(JOURNAL_SECTION_LABELS).map(([key, label]) => ({
  key: key as JournalSectionKey,
  label
}));

type JournalResponse = {
  journal?: JournalItem[];
};

type SituationsResponse = {
  situations?: Situation[];
};

type SituationResponse = {
  situation?: Situation;
};

type JournalItemsBySection = Record<JournalSectionKey, JournalItem[]>;

function createEmptyJournalGroups(): JournalItemsBySection {
  return JOURNAL_SECTIONS.reduce((groups, section) => {
    groups[section.key] = [];
    return groups;
  }, {} as JournalItemsBySection);
}

export function JournalItemCard({
  isSelected,
  item,
  onSelectItem
}: {
  isSelected: boolean;
  item: JournalItem;
  onSelectItem: (item: JournalItem) => void;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={`journal-item-card ${isSelected ? "selected-journal-item" : ""}`}
      onClick={() => onSelectItem(item)}
      type="button"
    >
      <div className="journal-item-card-header">
        <span className="journal-item-type">{JOURNAL_ITEM_TYPE_LABELS[item.item_type]}</span>
        <span className={`evidence-badge evidence-${item.evidence_state}`}>
          {EVIDENCE_STATE_LABELS[item.evidence_state]}
        </span>
      </div>
      <h4>{item.title}</h4>
      {item.value ? <p className="journal-item-value">{item.value}</p> : null}
      {item.status !== "active" ? (
        <span className="journal-status-badge">{JOURNAL_ITEM_STATUS_LABELS[item.status]}</span>
      ) : null}
    </button>
  );
}

export function JournalSection({
  items,
  label,
  onSelectItem,
  sectionKey,
  selectedItemId
}: {
  items: JournalItem[];
  label: string;
  onSelectItem: (item: JournalItem) => void;
  sectionKey: JournalSectionKey;
  selectedItemId: string | null;
}) {
  return (
    <section className="journal-section" aria-labelledby={`journal-section-${sectionKey}`}>
      <h3 id={`journal-section-${sectionKey}`}>{label}</h3>
      {items.length > 0 ? (
        <div className="journal-items-list">
          {items.map((item) => (
            <JournalItemCard
              isSelected={selectedItemId === item.id}
              item={item}
              key={item.id}
              onSelectItem={onSelectItem}
            />
          ))}
        </div>
      ) : (
        <p className="journal-empty-message">Zatím žádné položky.</p>
      )}
    </section>
  );
}

export function JournalPanel({
  caseItem,
  onSelectItem,
  refreshKey,
  selectedItemId
}: {
  caseItem: CaseSummary;
  onSelectItem: (item: JournalItem) => void;
  refreshKey: number;
  selectedItemId: string | null;
}) {
  const [journalItems, setJournalItems] = useState<JournalItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [situations, setSituations] = useState<Situation[]>([]);
  const [selectedSituationId, setSelectedSituationId] = useState<string | null>(null);
  const [isLoadingSituations, setIsLoadingSituations] = useState(true);
  const [isCreatingSituation, setIsCreatingSituation] = useState(false);
  const [situationError, setSituationError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSituations() {
      try {
        setIsLoadingSituations(true);
        const response = await fetch(`/api/cases/${caseItem.id}/situations`, {
          cache: "no-store"
        });
        const data = (await response.json()) as SituationsResponse;

        if (!response.ok || !Array.isArray(data.situations)) {
          throw new Error("Nepodařilo se načíst situace.");
        }

        if (isMounted) {
          setSituations(data.situations);
          setSelectedSituationId(
            (currentId) =>
              data.situations?.find(
                (situation) => situation.id === currentId && situation.status === "active"
              )?.id ??
              data.situations?.find((situation) => situation.status === "active")?.id ??
              null
          );
          setSituationError(null);
        }
      } catch {
        if (isMounted) {
          setSituations([]);
          setSelectedSituationId(null);
          setSituationError("Nepodařilo se načíst situace.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingSituations(false);
        }
      }
    }

    loadSituations();

    return () => {
      isMounted = false;
    };
  }, [caseItem.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadJournal() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/cases/${caseItem.id}/journal`, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(
            response.status === 404 ? "Případ nebyl nalezen." : "Zápisník se nepodařilo načíst."
          );
        }

        const data = (await response.json()) as JournalResponse;

        if (!Array.isArray(data.journal)) {
          throw new Error("Odpověď neobsahuje položky zápisníku.");
        }

        if (isMounted) {
          setJournalItems(data.journal);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setJournalItems([]);
          setError(
            loadError instanceof Error ? loadError.message : "Zápisník se nepodařilo načíst."
          );
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
  }, [caseItem.id, refreshKey]);

  async function handleCreateSituation() {
    try {
      setIsCreatingSituation(true);
      setSituationError(null);
      const response = await fetch(`/api/cases/${caseItem.id}/situations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Situace ${situations.length + 1}` })
      });
      const data = (await response.json()) as SituationResponse;

      if (!response.ok || !data.situation) {
        throw new Error("Nepodařilo se vytvořit situaci.");
      }

      setSituations((currentSituations) => [...currentSituations, data.situation as Situation]);
      setSelectedSituationId(data.situation.id);
    } catch {
      setSituationError("Nepodařilo se vytvořit situaci.");
    } finally {
      setIsCreatingSituation(false);
    }
  }

  const journalItemsBySection = useMemo(() => {
    const groups = createEmptyJournalGroups();

    for (const item of journalItems) {
      groups[item.section].push(item);
    }

    return groups;
  }, [journalItems]);

  return (
    <aside className="workspace-panel journal-panel" aria-labelledby="journal-title">
      <SituationTabs
        error={situationError}
        isCreating={isCreatingSituation}
        isLoading={isLoadingSituations}
        onCreateSituation={handleCreateSituation}
        onSelectSituation={setSelectedSituationId}
        selectedSituationId={selectedSituationId}
        situations={situations}
      />
      <div className="journal-heading">
        <p className="panel-kicker">Případ</p>
        <h2 id="journal-title">Zápisník</h2>
        <p className="panel-note">Hlavní pracovní model případu.</p>
      </div>
      {isLoading ? <p className="journal-empty-message">Načítám zápisník…</p> : null}
      {error ? <p className="status-message error-message">{error}</p> : null}
      {!isLoading && !error ? (
        <div className="journal-section-list">
          {JOURNAL_SECTIONS.map((section) => (
            <JournalSection
              items={journalItemsBySection[section.key]}
              key={section.key}
              label={section.label}
              onSelectItem={onSelectItem}
              sectionKey={section.key}
              selectedItemId={selectedItemId}
            />
          ))}
        </div>
      ) : null}
    </aside>
  );
}
