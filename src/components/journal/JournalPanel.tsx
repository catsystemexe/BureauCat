"use client";

import { useEffect, useMemo, useState } from "react";
import type { CaseDocument, CaseSummary, Situation } from "@/components/types";
import { GoalsSection } from "@/components/journal/GoalsSection";
import { SituationDocumentsSection } from "@/components/journal/SituationDocumentsSection";
import { SituationPager } from "@/components/journal/SituationPager";

const AI_PLACEHOLDERS = [
  { title: "Analýza", message: "Zatím bez analýzy." },
  { title: "Poznatky", message: "Zatím bez poznatků." },
  { title: "Otázky", message: "Zatím bez otázek." },
  { title: "Rizika", message: "Zatím bez rizik." },
  { title: "Postup", message: "Zatím bez návrhu postupu." }
] as const;

type SituationsResponse = {
  situations?: Situation[];
};

type SituationResponse = {
  situation?: Situation;
};

function SituationCard({ situation }: { situation: Situation | null }) {
  return (
    <section className="notebook-card notebook-user-card" aria-labelledby="situation-card-title">
      <div className="notebook-card-header">
        <h3 id="situation-card-title">Situace</h3>
        <span
          aria-label="Úprava popisu zatím není dostupná"
          className="situation-edit-placeholder"
          role="img"
          title="Úprava popisu zatím není dostupná"
        >
          ✎
        </span>
      </div>
      <p className="situation-description">
        {situation?.description || "Popis situace zatím není vyplněn."}
      </p>
    </section>
  );
}

function UserLayer({
  documentListRefreshKey,
  onOpenDocument,
  selectedSituation
}: {
  documentListRefreshKey: number;
  onOpenDocument: (document: CaseDocument) => void;
  selectedSituation: Situation | null;
}) {
  return (
    <div className="notebook-layer notebook-user-layer">
      <SituationCard situation={selectedSituation} />
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
      {AI_PLACEHOLDERS.map((placeholder) => (
        <section className="notebook-card notebook-ai-card" key={placeholder.title}>
          <h3>{placeholder.title}</h3>
          <p className="journal-empty-message">{placeholder.message}</p>
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

  return (
    <aside className="workspace-panel journal-panel" aria-labelledby="journal-title">
      <header className="notebook-heading">
        <h2 id="journal-title">Zápisník</h2>
      </header>
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
          selectedSituation={selectedSituation}
        />
        <AILayer />
      </div>
    </aside>
  );
}
