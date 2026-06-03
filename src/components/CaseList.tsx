"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
          throw new Error("Unable to load cases.");
        }

        const data = (await response.json()) as CasesResponse;

        if (isMounted) {
          setCases(data.cases ?? []);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load cases.");
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
        body: JSON.stringify({ title: "Untitled draft case" })
      });

      if (!response.ok) {
        throw new Error("Unable to create a draft case.");
      }

      const data = (await response.json()) as CreateCaseResponse;

      if (!data.case?.id) {
        throw new Error("The created case response did not include an id.");
      }

      router.push(`/cases/${data.case.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create a draft case.");
      setIsCreating(false);
    }
  }

  return (
    <section className="case-list-card" aria-labelledby="cases-title">
      <div className="case-list-header">
        <div>
          <p className="eyebrow">Cases</p>
          <h1 id="cases-title">Case list</h1>
        </div>
        <button className="primary-action" type="button" onClick={createDraftCase} disabled={isCreating}>
          {isCreating ? "Creating…" : "New Case"}
        </button>
      </div>

      {error ? <p className="status-message error-message">{error}</p> : null}
      {isLoading ? <p className="status-message">Loading cases…</p> : null}

      {!isLoading && cases.length === 0 ? (
        <div className="empty-state">
          <h2>No cases yet</h2>
          <p>Create a draft case to begin an intake workspace.</p>
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
                <small>{caseItem.area ?? "No area set"}</small>
              </span>
              <span className="status-pill">{caseItem.status}</span>
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
