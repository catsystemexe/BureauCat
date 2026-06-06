"use client";

import { useMemo } from "react";
import type { Situation } from "@/components/types";

export function SituationPager({
  error,
  isCreating,
  isLoading,
  onCreateSituation,
  onSelectSituation,
  selectedSituationId,
  situations
}: {
  error: string | null;
  isCreating: boolean;
  isLoading: boolean;
  onCreateSituation: () => void;
  onSelectSituation: (situationId: string) => void;
  selectedSituationId: string | null;
  situations: Situation[];
}) {
  const activeSituations = useMemo(
    () => situations.filter((situation) => situation.status === "active"),
    [situations]
  );

  return (
    <nav className="situation-pager" aria-label="Stránky situací">
      <div className="situation-page-buttons">
        {activeSituations.map((situation, index) => {
          const isSelected = situation.id === selectedSituationId;

          return (
            <button
              aria-label={`Situace ${index + 1}: ${situation.title}`}
              aria-pressed={isSelected}
              className={`situation-page-button${isSelected ? " selected-situation-page" : ""}`}
              key={situation.id}
              onClick={() => onSelectSituation(situation.id)}
              title={situation.title}
              type="button"
            >
              {index + 1}
            </button>
          );
        })}
        <button
          aria-label="Přidat situaci"
          className="situation-page-button situation-page-add-button"
          disabled={isCreating || isLoading}
          onClick={onCreateSituation}
          title="Přidat situaci"
          type="button"
        >
          +
        </button>
      </div>
      {isLoading ? <p className="journal-empty-message">Načítám situace…</p> : null}
      {error ? <p className="status-message error-message">{error}</p> : null}
    </nav>
  );
}
