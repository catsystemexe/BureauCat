"use client";

import { useEffect, useMemo, useState } from "react";
import { SituationPager } from "@/components/journal/SituationPager";
import type {
  Situation,
  SituationWorkflow,
  WorkflowStepKey,
  WorkflowStepStatus
} from "@/components/types";

const STEP_LABELS: Record<WorkflowStepKey, string> = {
  ANALYSIS: "Analýza",
  PLAN: "Plán",
  COLLECTION: "Podklady",
  INPUT_VALIDATION: "Validace",
  PRODUCTION: "Produkce",
  OUTPUT_REVIEW: "Kontrola",
  EXECUTION: "Dokončení"
};

function stepStatusSymbol(status: WorkflowStepStatus) {
  if (status === "COMPLETED") return "✓";
  if (status === "ACTIVE") return "●";
  return "○";
}

type SituationsResponse = {
  situations?: Situation[];
};

type SituationResponse = {
  situation?: Situation;
};

type WorkflowResponse = {
  workflow?: SituationWorkflow;
};

export function WorkflowRail({
  caseId,
  onSelectSituation,
  onSelectStep,
  selectedSituationId,
  selectedStepKey
}: {
  caseId: string;
  onSelectSituation: (situationId: string | null) => void;
  onSelectStep: (stepKey: WorkflowStepKey) => void;
  selectedSituationId: string | null;
  selectedStepKey: WorkflowStepKey | null;
}) {
  const [situations, setSituations] = useState<Situation[]>([]);
  const [workflow, setWorkflow] = useState<SituationWorkflow | null>(null);
  const [isLoadingSituations, setIsLoadingSituations] = useState(true);
  const [isCreatingSituation, setIsCreatingSituation] = useState(false);
  const [situationError, setSituationError] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSituations() {
      try {
        setIsLoadingSituations(true);
        const response = await fetch(`/api/cases/${caseId}/situations`, { cache: "no-store" });
        const data = (await response.json()) as SituationsResponse;

        if (!response.ok || !Array.isArray(data.situations)) {
          throw new Error("Nepodařilo se načíst situace.");
        }

        if (!isMounted) return;

        const activeSituations = data.situations.filter((situation) => situation.status === "active");
        setSituations(data.situations);
        setSituationError(null);

        const selectedStillExists = activeSituations.some(
          (situation) => situation.id === selectedSituationId
        );

        if (!selectedStillExists) {
          onSelectSituation(activeSituations[0]?.id ?? null);
        }
      } catch {
        if (!isMounted) return;
        setSituations([]);
        setSituationError("Nepodařilo se načíst situace.");
        onSelectSituation(null);
      } finally {
        if (isMounted) setIsLoadingSituations(false);
      }
    }

    void loadSituations();

    return () => {
      isMounted = false;
    };
  }, [caseId, onSelectSituation, selectedSituationId]);

  useEffect(() => {
    let isMounted = true;

    if (!selectedSituationId) {
      setWorkflow(null);
      setWorkflowError(null);
      return () => {
        isMounted = false;
      };
    }

    async function loadWorkflow() {
      try {
        const response = await fetch(`/api/situations/${selectedSituationId}/workflow`, {
          cache: "no-store"
        });
        const data = (await response.json()) as WorkflowResponse;

        if (!response.ok || !data.workflow) {
          throw new Error("Nepodařilo se načíst workflow.");
        }

        if (!isMounted) return;

        setWorkflow(data.workflow);
        setWorkflowError(null);

        const currentStep = data.workflow.workflow_steps.find((step) => step.status === "ACTIVE")
          ?? data.workflow.workflow_steps[0]
          ?? null;

        if (
          currentStep &&
          (!selectedStepKey || !data.workflow.workflow_steps.some((step) => step.step_key === selectedStepKey))
        ) {
          onSelectStep(currentStep.step_key);
        }
      } catch {
        if (!isMounted) return;
        setWorkflow(null);
        setWorkflowError("Nepodařilo se načíst workflow.");
      }
    }

    void loadWorkflow();

    return () => {
      isMounted = false;
    };
  }, [onSelectStep, selectedSituationId, selectedStepKey]);

  const selectedSituation = useMemo(
    () => situations.find((situation) => situation.id === selectedSituationId) ?? null,
    [selectedSituationId, situations]
  );

  const authoritativeGoal = workflow?.goals.find((goal) => goal.status === "active")
    ?? workflow?.goals.find((goal) => goal.status !== "archived")
    ?? null;

  async function handleCreateSituation() {
    const activeSituationCount = situations.filter((situation) => situation.status === "active").length;
    if (activeSituationCount >= 10) return;

    try {
      setIsCreatingSituation(true);
      setSituationError(null);
      const response = await fetch(`/api/cases/${caseId}/situations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Situace ${situations.length + 1}` })
      });
      const data = (await response.json()) as SituationResponse;

      if (!response.ok || !data.situation) {
        throw new Error("Nepodařilo se vytvořit situaci.");
      }

      setSituations((current) => [...current, data.situation!]);
      onSelectSituation(data.situation.id);
      onSelectStep("ANALYSIS");
    } catch {
      setSituationError("Nepodařilo se vytvořit situaci.");
    } finally {
      setIsCreatingSituation(false);
    }
  }

  return (
    <aside className="workspace-panel workflow-rail" aria-label="Situace a workflow">
      <div className="workflow-rail-situations">
        <SituationPager
          error={situationError}
          isCreating={isCreatingSituation}
          isLoading={isLoadingSituations}
          onCreateSituation={handleCreateSituation}
          onSelectSituation={onSelectSituation}
          selectedSituationId={selectedSituationId}
          situations={situations}
        />
      </div>

      <div className="workflow-rail-situation-summary">
        <p className="workflow-rail-eyebrow">Situace</p>
        <strong className="workflow-rail-situation-title">
          {selectedSituation?.title ?? "Bez vybrané situace"}
        </strong>
        <p className="workflow-rail-goal" title={authoritativeGoal?.title ?? undefined}>
          {authoritativeGoal?.title ?? "Cíl zatím není potvrzený."}
        </p>
      </div>

      <nav className="workflow-step-rail" aria-label="Kroky situace">
        {workflow?.workflow_steps.map((step) => {
          const isSelected = selectedStepKey === step.step_key;
          return (
            <button
              aria-current={isSelected ? "step" : undefined}
              className={`workflow-step-button status-${step.status.toLowerCase()}${isSelected ? " is-selected" : ""}`}
              key={step.id}
              onClick={() => onSelectStep(step.step_key)}
              type="button"
            >
              <span className="workflow-step-symbol" aria-hidden="true">
                {stepStatusSymbol(step.status)}
              </span>
              <span className="workflow-step-label">{STEP_LABELS[step.step_key]}</span>
            </button>
          );
        })}
      </nav>

      {workflowError ? <p className="workflow-rail-error">{workflowError}</p> : null}
    </aside>
  );
}