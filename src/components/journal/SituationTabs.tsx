"use client";

import { useMemo } from "react";
import type { Situation } from "@/components/types";

export function SituationTabs({
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
  const selectedSituation =
    activeSituations.find((situation) => situation.id === selectedSituationId) ??
    activeSituations[0] ??
    null;

  return (
    <section className="situation-navigation" aria-labelledby="situations-title">
      <div className="situation-navigation-header">
        <h2 id="situations-title">Situace</h2>
        <button
          className="situation-add-button"
          disabled={isCreating || isLoading}
          onClick={onCreateSituation}
          type="button"
        >
          + Situace
        </button>
      </div>
      {isLoading ? <p className="journal-empty-message">Načítám situace…</p> : null}
      {error ? <p className="status-message error-message">{error}</p> : null}
      {!isLoading && activeSituations.length > 0 ? (
        <>
          <div className="situation-tabs" role="tablist" aria-label="Situace případu">
            {activeSituations.map((situation) => (
              <button
                aria-selected={selectedSituation?.id === situation.id}
                className={`situation-tab${
                  selectedSituation?.id === situation.id ? " selected-situation-tab" : ""
                }`}
                key={situation.id}
                onClick={() => onSelectSituation(situation.id)}
                role="tab"
                type="button"
              >
                {situation.title}
              </button>
            ))}
          </div>
          <p className="situation-description">
            {selectedSituation?.description || "Popis situace zatím není vyplněn."}
          </p>
        </>
      ) : null}
    </section>
  );
}
