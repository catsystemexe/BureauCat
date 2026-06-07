"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Goal } from "@/components/types";

type GoalsResponse = {
  goals?: Goal[];
};

type GoalResponse = {
  goal?: Goal;
};

export function GoalsSection({ selectedSituationId }: { selectedSituationId: string | null }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingGoalId, setUpdatingGoalId] = useState<string | null>(null);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalTitleDraft, setGoalTitleDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    setEditingGoalId(null);
    setGoalTitleDraft("");

    if (!selectedSituationId) {
      setGoals([]);
      setIsLoading(false);
      setError(null);
      return () => {
        isMounted = false;
      };
    }

    async function loadGoals() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/situations/${selectedSituationId}/goals`, {
          cache: "no-store"
        });
        const data = (await response.json()) as GoalsResponse;

        if (!response.ok || !Array.isArray(data.goals)) {
          throw new Error("Nepodařilo se načíst cíle.");
        }

        if (isMounted) {
          setGoals(data.goals);
        }
      } catch {
        if (isMounted) {
          setGoals([]);
          setError("Nepodařilo se načíst cíle.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadGoals();

    return () => {
      isMounted = false;
    };
  }, [selectedSituationId]);

  const visibleGoals = useMemo(
    () => goals.filter((goal) => goal.status !== "archived"),
    [goals]
  );

  function beginEditingGoal(goal: Goal) {
    setEditingGoalId(goal.id);
    setGoalTitleDraft(goal.title);
    setError(null);
  }

  function stopEditingGoal() {
    setEditingGoalId(null);
    setGoalTitleDraft("");
  }

  async function handleCreateGoal() {
    if (!selectedSituationId) {
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      const response = await fetch(`/api/situations/${selectedSituationId}/goals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Nový cíl" })
      });
      const data = (await response.json()) as GoalResponse;

      if (!response.ok || !data.goal) {
        throw new Error("Nepodařilo se vytvořit cíl.");
      }

      const createdGoal = data.goal;
      setGoals((currentGoals) => [...currentGoals, createdGoal]);
      beginEditingGoal(createdGoal);
    } catch {
      setError("Nepodařilo se vytvořit cíl.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleToggleGoal(goal: Goal) {
    try {
      setUpdatingGoalId(goal.id);
      setError(null);
      const response = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: goal.status === "completed" ? "active" : "completed" })
      });
      const data = (await response.json()) as GoalResponse;

      if (!response.ok || !data.goal) {
        throw new Error("Nepodařilo se upravit cíl.");
      }

      const updatedGoal = data.goal;
      setGoals((currentGoals) =>
        currentGoals.map((currentGoal) =>
          currentGoal.id === updatedGoal.id ? updatedGoal : currentGoal
        )
      );
    } catch {
      setError("Nepodařilo se upravit cíl.");
    } finally {
      setUpdatingGoalId(null);
    }
  }

  async function handleSaveGoal(event: FormEvent<HTMLFormElement>, goal: Goal) {
    event.preventDefault();
    const title = goalTitleDraft.trim();

    if (!title) {
      setError("Název cíle nesmí být prázdný.");
      return;
    }

    try {
      setUpdatingGoalId(goal.id);
      setError(null);
      const response = await fetch(`/api/goals/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      const data = (await response.json()) as GoalResponse;

      if (!response.ok || !data.goal) {
        throw new Error("Nepodařilo se upravit cíl.");
      }

      const updatedGoal = data.goal;
      setGoals((currentGoals) =>
        currentGoals.map((currentGoal) =>
          currentGoal.id === updatedGoal.id ? updatedGoal : currentGoal
        )
      );
      stopEditingGoal();
    } catch {
      setError("Nepodařilo se upravit cíl.");
    } finally {
      setUpdatingGoalId(null);
    }
  }

  async function handleArchiveGoal(goal: Goal) {
    try {
      setUpdatingGoalId(goal.id);
      setError(null);
      const response = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      const data = (await response.json()) as GoalResponse;

      if (!response.ok || !data.goal) {
        throw new Error("Nepodařilo se archivovat cíl.");
      }

      const archivedGoal = data.goal;
      setGoals((currentGoals) =>
        currentGoals.map((currentGoal) =>
          currentGoal.id === archivedGoal.id ? archivedGoal : currentGoal
        )
      );
      if (editingGoalId === goal.id) {
        stopEditingGoal();
      }
    } catch {
      setError("Nepodařilo se archivovat cíl.");
    } finally {
      setUpdatingGoalId(null);
    }
  }

  return (
    <section className="goals-section" aria-labelledby="goals-title">
      <span aria-hidden="true" className="notebook-section-icon user-section-icon">◎</span>
      <div className="notebook-section-content">
        <div className="goals-section-header">
          <h3 id="goals-title">Cíle</h3>
          <button
            className="notebook-add-button"
            disabled={!selectedSituationId || isCreating || isLoading}
            onClick={handleCreateGoal}
            type="button"
          >
            <span aria-hidden="true">＋</span>
            <span>Cíl</span>
          </button>
        </div>
        {isLoading ? <p className="journal-empty-message">Načítám cíle…</p> : null}
        {error ? <p className="notebook-inline-error">{error}</p> : null}
        {!isLoading && !error && visibleGoals.length === 0 ? (
          <p className="journal-empty-message">Zatím žádné cíle.</p>
        ) : null}
        {!isLoading && visibleGoals.length > 0 ? (
          <div className="goals-list">
            {visibleGoals.map((goal) => {
              const isEditing = editingGoalId === goal.id;
              const isUpdating = updatingGoalId === goal.id;

              return (
                <div className={`goal-row${isEditing ? " editing-goal-row" : ""}`} key={goal.id}>
                  <input
                    aria-label={`Označit cíl „${goal.title}“ jako ${goal.status === "completed" ? "nesplněný" : "splněný"}`}
                    checked={goal.status === "completed"}
                    disabled={isUpdating || isEditing}
                    onChange={() => handleToggleGoal(goal)}
                    type="checkbox"
                  />
                  {isEditing ? (
                    <form className="goal-edit-form" onSubmit={(event) => handleSaveGoal(event, goal)}>
                      <input
                        aria-label="Název cíle"
                        autoFocus
                        disabled={isUpdating}
                        onChange={(event) => setGoalTitleDraft(event.target.value)}
                        value={goalTitleDraft}
                      />
                      <div className="notebook-row-actions">
                        <button
                          aria-label="Uložit cíl"
                          className="notebook-icon-button confirm-action"
                          disabled={isUpdating}
                          title="Uložit"
                          type="submit"
                        >
                          ✓
                        </button>
                        <button
                          aria-label="Zrušit úpravu cíle"
                          className="notebook-icon-button"
                          disabled={isUpdating}
                          onClick={stopEditingGoal}
                          title="Zrušit"
                          type="button"
                        >
                          ×
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <span
                        className={`goal-title${goal.status === "completed" ? " completed-goal-title" : ""}`}
                        onDoubleClick={() => beginEditingGoal(goal)}
                        title="Dvojklikem upravit cíl"
                      >
                        {goal.title}
                      </span>
                      <div className="notebook-row-actions">
                        <button
                          aria-label={`Upravit cíl ${goal.title}`}
                          className="notebook-icon-button"
                          disabled={isUpdating}
                          onClick={() => beginEditingGoal(goal)}
                          title="Upravit cíl"
                          type="button"
                        >
                          ✎
                        </button>
                        <button
                          aria-label={`Archivovat cíl ${goal.title}`}
                          className="notebook-icon-button destructive-action"
                          disabled={isUpdating}
                          onClick={() => handleArchiveGoal(goal)}
                          title="Archivovat cíl"
                          type="button"
                        >
                          <svg aria-hidden="true" className="trash-icon" viewBox="0 0 24 24">
                            <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-1 11H8L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z" />
                          </svg>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
