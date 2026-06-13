"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CASE_STATUS_LABELS } from "@/lib/constants/uiLabels";
import type { CaseSummary } from "./types";
import {
  Car,
  FileText,
  Landmark,
  UsersRound
} from "lucide-react";


type CasesResponse = {
  cases?: CaseSummary[];
};

type CreateCaseResponse = {
  case?: CaseSummary;
};

export function CaseList() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCases() {
      try {
        const response = await fetch("/api/cases", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Případy se nepodařilo načíst.");
        }

        const data = (await response.json()) as CasesResponse;

        if (isMounted) {
          setCases(data.cases ?? []);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Případy se nepodařilo načíst.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCases();

    return () => {
      isMounted = false;
    };
  }, []);

  async function createDraftCase() {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nový případ" })
      });

      if (!response.ok) {
        throw new Error("Nový případ se nepodařilo vytvořit.");
      }

      const data = (await response.json()) as CreateCaseResponse;

      if (!data.case?.id) {
        throw new Error("Odpověď neobsahuje identifikátor vytvořeného případu.");
      }

      router.push(`/cases/${data.case.id}`);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Nový případ se nepodařilo vytvořit."
      );
      setIsCreating(false);
    }
  }

return (
  <main className="title-screen">
    <section className="title-hero" aria-labelledby="cases-title">
      <img
        src="/bureaucat_title_art.png"
        alt=""
        aria-hidden="true"
        className="title-hero-art"
      />

      <div className="title-hero-overlay" />

      <div className="title-brand-panel">
        <img
          src="/bureaucat_logo.png"
          alt="BureauCat"
          className="title-logo"
        />

        <p className="title-kicker">Asistent pro jednání s úřady</p>

      <div className="title-action-stack">
        <button
          className="title-primary-action"
          type="button"
          onClick={createDraftCase}
          disabled={isCreating}
        >
          {isCreating ? "Vytvářím…" : "Nový případ"}
        </button>

        <button
          className="title-secondary-action"
          type="button"
        >
          ⚡ Rychlá analýza
        </button>
      </div>
    </div>

      <aside className="title-cases-panel" aria-label="Nedávné případy">
        <div className="title-cases-header">
          <p className="title-cases-kicker">Nedávné</p>
          <h1 id="cases-title">Případy</h1>
        </div>

        {error ? <p className="title-error">{error}</p> : null}
        {isLoading ? <p className="title-muted">Načítám případy…</p> : null}

        {!isLoading && cases.length === 0 ? (
          <p className="title-muted">Zatím žádné případy.</p>
        ) : null}

        {!isLoading && cases.length > 0 ? (
          <div className="title-case-list" role="list">
            {cases.map((caseItem, index) => {
  const caseIcons = [UsersRound, Landmark, Car, FileText];
  const CaseIcon = caseIcons[index % caseIcons.length];
  const caseMeta = ["8 dokumentů • 3 otázky", "21 dokumentů • 6 poznatků", "2 dokumenty • 1 úkol", "Bez metadat"];

  return (
    <button
      className="title-case-card"
      key={caseItem.id}
      type="button"
      onClick={() => router.push(`/cases/${caseItem.id}`)}
      role="listitem"
    >
      <span className="title-case-icon" aria-hidden="true">
        <CaseIcon className="title-case-lucide-icon" />
      </span>

      <span className="title-case-main">
        <strong>{caseItem.title}</strong>
        <small>{caseMeta[index % caseMeta.length]}</small>
      </span>

      <span className="title-status-pill">
        <span aria-hidden="true" className="title-status-dot" />
        {CASE_STATUS_LABELS[caseItem.status]}
      </span>
    </button>
  );
})}
          </div>
        ) : null}
      </aside>
    </section>
  </main>
);
}