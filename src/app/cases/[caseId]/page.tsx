"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ThreePanelWorkspace } from "@/components/ThreePanelWorkspace";
import type { CaseSummary } from "@/components/types";

type CaseResponse = {
  case?: CaseSummary;
};

export default function CaseWorkspacePage() {
  const params = useParams<{ caseId: string }>();
  const [caseItem, setCaseItem] = useState<CaseSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCase() {
      try {
        const response = await fetch(`/api/cases/${params.caseId}`, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(response.status === 404 ? "Případ nebyl nalezen." : "Případ se nepodařilo načíst.");
        }

        const data = (await response.json()) as CaseResponse;

        if (!data.case) {
          throw new Error("Odpověď neobsahuje podrobnosti případu.");
        }

        if (isMounted) {
          setCaseItem(data.case);
          setError(null);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Případ se nepodařilo načíst.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCase();

    return () => {
      isMounted = false;
    };
  }, [params.caseId]);

  if (isLoading) {
    return <main className="workspace-loading">Načítám pracovní prostor případu…</main>;
  }

  if (error || !caseItem) {
    return (
      <main className="workspace-loading">
        <p className="status-message error-message">{error ?? "Případ nebyl nalezen."}</p>
        <Link href="/cases">Zpět na případy</Link>
      </main>
    );
  }

  return <ThreePanelWorkspace caseItem={caseItem} />;
}
