"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import type { CaseDocument, CaseSummary, Situation } from "@/components/types";
import { GoalsSection } from "@/components/journal/GoalsSection";
import { SituationDocumentsSection } from "@/components/journal/SituationDocumentsSection";
import { SituationPager } from "@/components/journal/SituationPager";

const AI_PLACEHOLDERS = [
  { title: "Analýza", message: "Zatím bez analýzy.", icon: "↗" },
  { title: "Poznatky", message: "Zatím bez poznatků.", icon: "◉" },
  { title: "Otázky", message: "Zatím bez otázek.", icon: "?" },
  { title: "Rizika", message: "Zatím bez rizik.", icon: "!" },
  { title: "Postup", message: "Zatím bez návrhu postupu.", icon: "☷" }
] as const;

type SituationsResponse = {
  situations?: Situation[];
};

type SituationResponse = {
  situation?: Situation;
};

function SituationCard({
  onSituationUpdated,
  situation
}: {
  onSituationUpdated: (situation: Situation) => void;
  situation: Situation | null;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsEditing(false);
    setTitleDraft(situation?.title ?? "");
    setError(null);
  }, [situation?.id, situation?.title]);

  function beginEditing() {
    if (!situation) {
      return;
    }

    setTitleDraft(situation.title);
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setTitleDraft(situation?.title ?? "");
    setError(null);
    setIsEditing(false);
  }

  function handleTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!situation || !titleDraft.trim()) {
      setError("Název situace nesmí být prázdný.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const response = await fetch(`/api/situations/${situation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleDraft.trim() })
      });
      const data = (await response.json()) as SituationResponse;

      if (!response.ok || !data.situation) {
        throw new Error("Nepodařilo se upravit situaci.");
      }

      onSituationUpdated(data.situation);
      setIsEditing(false);
    } catch {
      setError("Nepodařilo se upravit situaci.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="notebook-card notebook-user-card situation-card" aria-labelledby="situation-card-title">
      <span aria-hidden="true" className="notebook-section-icon user-section-icon">▤</span>
      <div className="notebook-section-content">
        <div className="notebook-card-header">
          <h3 id="situation-card-title">Situace</h3>
          {!isEditing ? (
            <button
              aria-label="Upravit situaci"
              className="notebook-icon-button persistent-action"
              disabled={!situation}
              onClick={beginEditing}
              title="Upravit situaci"
              type="button"
            >
              ✎
            </button>
          ) : null}
        </div>
        {isEditing ? (
          <form className="situation-edit-form" onSubmit={handleSave}>
            <input
              aria-label="Název situace"
              autoFocus
              className="situation-title-input"
              disabled={isSaving}
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={handleTitleKeyDown}
              value={titleDraft}
            />
            {error ? <p className="notebook-inline-error">{error}</p> : null}
            <div className="notebook-form-actions">
              <button className="notebook-text-button primary-notebook-action" disabled={isSaving} type="submit">
                {isSaving ? "Ukládám…" : "Uložit"}
              </button>
              <button className="notebook-text-button" disabled={isSaving} onClick={cancelEditing} type="button">
                Zrušit
              </button>
            </div>
          </form>
        ) : (
          <p
            className="situation-title-display"
            onDoubleClick={beginEditing}
            title={situation ? "Dvojklikem upravit název situace" : undefined}
          >
            {situation?.title || "Žádná situace není vybrána."}
          </p>
        )}
      </div>
    </section>
  );
}

function UserLayer({
  documentListRefreshKey,
  onOpenDocument,
  onSituationUpdated,
  selectedSituation
}: {
  documentListRefreshKey: number;
  onOpenDocument: (document: CaseDocument) => void;
  onSituationUpdated: (situation: Situation) => void;
  selectedSituation: Situation | null;
}) {
  return (
    <div className="notebook-layer notebook-user-layer">
      <div className="notebook-layer-heading user-layer-heading">
        <span>Uživatel</span>
      </div>
      <SituationCard onSituationUpdated={onSituationUpdated} situation={selectedSituation} />
      <GoalsSection selectedSituationId={selectedSituation?.id ?? null} />
      <SituationDocumentsSection
        onOpenDocument={onOpenDocument}
        refreshKey={documentListRefreshKey}
        selectedSituationId={selectedSituation?.id ?? null}
      />
    </div>
  );
}

function AILayer() {
  return (
    <div className="notebook-layer notebook-ai-layer" aria-label="AI vrstva situace">
      <div className="notebook-layer-heading ai-layer-heading">
        <span>AI asistent</span>
      </div>
      {AI_PLACEHOLDERS.map((placeholder) => (
        <section className="notebook-card notebook-ai-card" key={placeholder.title}>
          <span aria-hidden="true" className="notebook-section-icon ai-section-icon">
            {placeholder.icon}
          </span>
          <div className="notebook-section-content">
            <div className="notebook-card-header">
              <h3>{placeholder.title}</h3>
              <span aria-hidden="true" className="notebook-placeholder-action">＋</span>
            </div>
            <p className="journal-empty-message">{placeholder.message}</p>
          </div>
        </section>
      ))}
    </div>
  );
}

export function JournalPanel({
  caseItem,
  documentListRefreshKey,
  onOpenDocument,
  onSelectSituation,
  selectedSituationId
}: {
  caseItem: CaseSummary;
  documentListRefreshKey: number;
  onOpenDocument: (document: CaseDocument) => void;
  onSelectSituation: (situationId: string | null) => void;
  selectedSituationId: string | null;
}) {
  const [situations, setSituations] = useState<Situation[]>([]);
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
          const activeSituations = data.situations.filter(
            (situation) => situation.status === "active"
          );
          setSituations(data.situations);
          onSelectSituation(activeSituations[0]?.id ?? null);
          setSituationError(null);
        }
      } catch {
        if (isMounted) {
          setSituations([]);
          onSelectSituation(null);
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
  }, [caseItem.id, onSelectSituation]);

  async function handleCreateSituation() {
    const activeSituationCount = situations.filter((situation) => situation.status === "active").length;

    if (activeSituationCount >= 10) {
      return;
    }

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
      onSelectSituation(data.situation.id);
    } catch {
      setSituationError("Nepodařilo se vytvořit situaci.");
    } finally {
      setIsCreatingSituation(false);
    }
  }

  const selectedSituation = useMemo(
    () =>
      situations.find(
        (situation) => situation.status === "active" && situation.id === selectedSituationId
      ) ?? null,
    [selectedSituationId, situations]
  );

  function handleSituationUpdated(updatedSituation: Situation) {
    setSituations((currentSituations) =>
      currentSituations.map((situation) =>
        situation.id === updatedSituation.id ? updatedSituation : situation
      )
    );
  }

  return (
    <aside className="workspace-panel journal-panel" aria-labelledby="journal-title">
      <h2 className="journal-panel-title" id="journal-title">Zápisník</h2>
      <SituationPager
        error={situationError}
        isCreating={isCreatingSituation}
        isLoading={isLoadingSituations}
        onCreateSituation={handleCreateSituation}
        onSelectSituation={onSelectSituation}
        selectedSituationId={selectedSituationId}
        situations={situations}
      />
      <div className="notebook-page">
        <UserLayer
          documentListRefreshKey={documentListRefreshKey}
          onOpenDocument={onOpenDocument}
          onSituationUpdated={handleSituationUpdated}
          selectedSituation={selectedSituation}
        />
        <AILayer />
      </div>
    </aside>
  );
}
