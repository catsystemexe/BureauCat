"use client";

import { useEffect, useRef, useState } from "react";
import { uploadToSituation } from "@/lib/documents/uploadToSituation";
import type { InputReview, PlanningState } from "@/lib/workflow/planning";
type Draft = InputReview & { editing: boolean; proof: string };
const content = (row: InputReview) => JSON.stringify([row.value, row.explanation, [...row.insightIds].sort(), [...row.documentIds].sort(), row.origin, row.sufficient]);
const proof = (row: InputReview, state: PlanningState) => JSON.stringify([row.value, row.explanation, row.origin,
  row.insightIds.map((id) => [id, state.evidence.find((e) => e.id === id)?.fingerprint]),
  row.documentIds.map((id) => [id, state.documents?.find((d) => d.id === id)?.fingerprint])]);
const criteria = (state: PlanningState) => state.inputs.flatMap((input) => input.criteria);
function savedRows(state: PlanningState): Record<string, Draft> {
  return Object.fromEntries(criteria(state).map((criterion) => {
    const row: InputReview = { criterionId: criterion.id, value: criterion.value, explanation: criterion.explanation,
      insightIds: [...new Set(criterion.insightIds)], documentIds: [...new Set(criterion.documentIds ?? [])],
      origin: criterion.origin ?? "DOCUMENT", sufficient: !criterion.stale && criterion.status === "SATISFIED" };
    return [criterion.id, { ...row, editing: !row.sufficient, proof: proof(row, state) }];
  }));
}

export function RequiredInputsForm({ state, caseId, situationId, disabled, refreshing, onSave, onUploaded }: {
  state: PlanningState; caseId: string; situationId: string; disabled: boolean; refreshing: boolean;
  onSave: (reviews: InputReview[], tasks: { taskId: string; completed: boolean }[]) => Promise<PlanningState | null>;
  onUploaded: () => void;
}) {
  const [drafts, setDrafts] = useState(() => savedRows(state));
  const previous = useRef(savedRows(state));
  const [taskDrafts, setTaskDrafts] = useState<Record<string, boolean>>(() => Object.fromEntries((state.tasks ?? []).map((task) => [task.id, task.completed])));
  const previousTasks = useRef(taskDrafts);
  const pickers = useRef<Record<string, HTMLInputElement | null>>({});
  useEffect(() => {
    const before = previousTasks.current;
    const next = Object.fromEntries((state.tasks ?? []).map((task) => [task.id, task.completed]));
    previousTasks.current = next;
    setTaskDrafts((current) => Object.fromEntries(Object.entries(next).map(([id, completed]) => [id, current[id] === before[id] || current[id] === undefined ? completed : current[id]])));
  }, [JSON.stringify(state.tasks)]);
  const [uploading, setUploading] = useState(false), [saving, setSaving] = useState(false), [message, setMessage] = useState("");
  const [uploaded, setUploaded] = useState<{ id: string; name: string }[]>([]);
  const pending = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (refreshing) setMessage(""); }, [refreshing]);
  const snapshot = JSON.stringify([state.inputs, state.evidence, state.documents]);
  useEffect(() => {
    const next = savedRows(state), priorSaved = previous.current;
    previous.current = next;
    setDrafts((current) => Object.fromEntries(Object.entries(next).map(([id, saved]) => {
      const old = current[id], prior = priorSaved[id];
      if (!old || !prior) return [id, saved];
      if (content(old) === content(prior) && content(saved) !== content(prior)) return [id, { ...saved, editing: old.editing || !saved.sufficient }];
      const merged = { ...old };
      if (old.value === prior.value) merged.value = saved.value;
      if (old.explanation === prior.explanation) merged.explanation = saved.explanation;
      if (JSON.stringify(old.insightIds) === JSON.stringify(prior.insightIds)) merged.insightIds = saved.insightIds;
      if (JSON.stringify(old.documentIds) === JSON.stringify(prior.documentIds)) merged.documentIds = saved.documentIds;
      merged.insightIds = merged.insightIds.filter((sourceId) => state.evidence.some((e) => e.id === sourceId));
      merged.documentIds = merged.documentIds.filter((sourceId) => state.documents?.some((d) => d.id === sourceId));
      if (old.origin === prior.origin && old.value === prior.value) merged.origin = saved.origin;
      if (old.sufficient === prior.sufficient && content(old) === content(prior)) merged.sufficient = saved.sufficient;
      if (merged.sufficient && old.proof !== proof(merged, state)) merged.sufficient = false;
      merged.proof = proof(merged, state);
      if (!merged.sufficient) merged.editing = true;
      return [id, merged];
    })));
  }, [snapshot]);
  const blocked = disabled || refreshing || uploading || saving;
  function edit(id: string, update: Partial<InputReview>) {
    setMessage("");
    setDrafts((current) => {
      const row = { ...current[id], ...update, editing: true, sufficient: false };
      if ("sufficient" in update) row.sufficient = update.sufficient!;
      return { ...current, [id]: { ...row, proof: proof(row, state) } };
    });
  }
  async function attach(ids: string[], file: File) {
    if (pending.current || blocked) return;
    pending.current = true; setUploading(true); setMessage("");
    try {
      const document = await uploadToSituation(caseId, situationId, file);
      if (!alive.current) return;
      setUploaded((current) => [...current, document]);
      setDrafts((current) => { const next = { ...current }; for (const id of ids) next[id] = { ...next[id], documentIds: [...new Set([...next[id].documentIds, document.id])], sufficient: false, editing: true }; return next; });
      setMessage("Soubor přiložen. Vazbu k položce uložte tlačítkem Uložit."); onUploaded();
    } catch (error) { if (alive.current) setMessage(error instanceof Error ? error.message : "Soubor se nepodařilo přiložit."); }
    finally { pending.current = false; if (alive.current) setUploading(false); }
  }
  const changed = Object.values(drafts).filter((row) => !previous.current[row.criterionId] || content(row) !== content(previous.current[row.criterionId]));
  const changedTasks = (state.tasks ?? []).filter((task) => taskDrafts[task.id] !== undefined && taskDrafts[task.id] !== previousTasks.current[task.id]).map((task) => ({ taskId: task.id, completed: taskDrafts[task.id] }));
  async function save() {
    if (pending.current || blocked || (!changed.length && !changedTasks.length)) return;
    pending.current = true; setSaving(true); setMessage("");
    const reviews = changed.map(({ editing: _editing, proof: _proof, ...row }) => row);
    try {
      const next = await onSave(reviews, changedTasks);
      if (!alive.current) return;
      if (!next) { setMessage("Uložení se nezdařilo. Rozepsané hodnoty zůstaly zachované."); return; }
      const saved = savedRows(next); previous.current = saved; setDrafts(saved); const tasks = Object.fromEntries((next.tasks ?? []).map((task) => [task.id, task.completed])); previousTasks.current = tasks; setTaskDrafts(tasks); setMessage("Uloženo.");
    } catch { if (alive.current) setMessage("Uložení se nezdařilo. Rozepsané hodnoty zůstaly zachované."); }
    finally { pending.current = false; if (alive.current) setSaving(false); }
  }
  return <form className="required-inputs-form" aria-label="K doplnění" onSubmit={(e) => { e.preventDefault(); void save(); }}>
    {state.inputs.map((input) => {
      const rows = input.criteria.flatMap((criterion) => drafts[criterion.id] ? [drafts[criterion.id]] : []);
      if (!rows.length) return null;
      const values = [...new Set(rows.map((row) => row.value).filter(Boolean))];
      const value = values.length === 1 ? values[0] : "";
      const dirty = rows.some((row) => content(row) !== content(previous.current[row.criterionId] ?? row));
      const checked = rows.every((row) => row.sufficient);
      const update = (patch: Partial<InputReview>) => { for (const row of rows) edit(row.criterionId, patch); };
      return <fieldset key={input.id} className="required-input-row" aria-label={input.title} disabled={blocked}>
        <label className="required-input-title"><input type="checkbox" checked={checked && values.length <= 1} disabled={values.length > 1} onChange={(e) => update({ sufficient: e.target.checked, ...(e.target.checked ? { value, ...(rows.some((row) => !row.insightIds.length) ? { origin: "USER" as const } : {}) } : {}) })} />{input.title}</label>
        <input type="text" aria-label={input.title} value={value} onChange={(e) => update({ value: e.target.value, origin: "USER", insightIds: [] })} />
        {input.attachmentRequired === true ? <><button type="button" aria-label={`Přiložit požadovanou přílohu: ${input.title}`} onClick={() => pickers.current[input.id]?.click()}>📎</button>
          <input type="file" hidden aria-hidden="true" tabIndex={-1} ref={(element) => { pickers.current[input.id] = element; }} accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.rtf" onChange={(e) => { const file = e.target.files?.[0]; if (file) void attach(rows.map((row) => row.criterionId), file); e.target.value = ""; }} />
        </> : null}
        {refreshing ? <p role="status">Ověřuji aktuální doložení…</p> : dirty ? <p>Změny nejsou uložené.</p> : input.criteria.some((criterion) => criterion.stale) ? <p>Doložení se změnilo; potvrďte znovu.</p> : values.length > 1 ? <p>Uložené hodnoty se liší. Doplňte jednoznačnou informaci.</p> : null}
      </fieldset>;
    })}
    {(state.tasks ?? []).map((task) => <fieldset key={`task:${task.id}`} className="required-task-row" disabled={blocked}>
      <label className="required-input-title"><input type="checkbox" checked={taskDrafts[task.id] ?? task.completed} onChange={(e) => { setMessage(""); setTaskDrafts((current) => ({ ...current, [task.id]: e.target.checked })); }} />{task.title}{task.deadline ? <span> — {task.deadline}</span> : task.deadlineStale ? <span> — termín vyžaduje ověření</span> : null}</label>
    </fieldset>)}
    <button type="submit" disabled={blocked || (!changed.length && !changedTasks.length)}>Uložit</button>
    {message ? <p role="status">{message}</p> : null}
  </form>;
}
