"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

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

  return (
    <section className="goals-section" aria-labelledby="goals-title">
      <div className="goals-section-header">
        <h2 id="goals-title">Cíle</h2>
        <button
          className="goal-add-button"
          disabled={!selectedSituationId || isCreating || isLoading}
          onClick={handleCreateGoal}
          type="button"
        >
          + Cíl
        </button>
      </div>
      {isLoading ? <p className="journal-empty-message">Načítám cíle…</p> : null}
      {error ? <p className="status-message error-message">{error}</p> : null}
      {!isLoading && !error && visibleGoals.length === 0 ? (
        <p className="journal-empty-message">Zatím žádné cíle.</p>
      ) : null}
      {!isLoading && visibleGoals.length > 0 ? (
        <div className="goals-list">
          {visibleGoals.map((goal) => (
            <label className="goal-row" key={goal.id}>
              <input
                checked={goal.status === "completed"}
                disabled={updatingGoalId === goal.id}
                onChange={() => handleToggleGoal(goal)}
                type="checkbox"
              />
              <span className={goal.status === "completed" ? "completed-goal-title" : undefined}>
                {goal.title}
              </span>
            </label>
          ))}
        </div>
      ) : null}
    </section>
  );
}
