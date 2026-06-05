"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CASE_STATUS_LABELS } from "@/lib/constants/uiLabels";
import type { CaseSummary } from "./types";

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
    <section className="case-list-card" aria-labelledby="cases-title">
      <div className="case-list-header">
        <div>
          <p className="eyebrow">BureauCat</p>
          <h1 id="cases-title">Případy</h1>
        </div>
        <button className="primary-action" type="button" onClick={createDraftCase} disabled={isCreating}>
          {isCreating ? "Vytvářím…" : "Nový případ"}
        </button>
      </div>

      {error ? <p className="status-message error-message">{error}</p> : null}
      {isLoading ? <p className="status-message">Načítám případy…</p> : null}

      {!isLoading && cases.length === 0 ? (
        <div className="empty-state">
          <h2>Zatím žádné případy</h2>
          <p>Vytvořte nový případ a začněte zápisník/konzultaci.</p>
        </div>
      ) : null}

      {!isLoading && cases.length > 0 ? (
        <div className="case-list" role="list">
          {cases.map((caseItem) => (
            <button
              className="case-list-item"
              key={caseItem.id}
              type="button"
              onClick={() => router.push(`/cases/${caseItem.id}`)}
              role="listitem"
            >
              <span>
                <strong>{caseItem.title}</strong>
                <small>{caseItem.area ?? "Oblast není uvedena"}</small>
              </span>
              <span className="status-pill">{CASE_STATUS_LABELS[caseItem.status]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
