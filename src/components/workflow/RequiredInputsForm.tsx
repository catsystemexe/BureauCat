"use client";

import { useEffect, useRef, useState } from "react";
import { uploadToSituation } from "@/lib/documents/uploadToSituation";
import { uniqueInsights } from "@/lib/workflow/planning";
import type { InputReview, PlanningState } from "@/lib/workflow/planning";
import { evidenceSource } from "@/lib/workflow/analysisOverview";
import type { QuestionSource } from "@/lib/workflow/analysisOverview";
import type { JournalSource } from "@/lib/journal/overview";

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

export function RequiredInputsForm({ state, caseId, situationId, disabled, refreshing, onSave, onUploaded, onOpenSource, onOpenDocument, sourceDetails }: {
  sourceDetails?: Record<string, QuestionSource[]>; onOpenDocument?: (id: string) => void;
  state: PlanningState; caseId: string; situationId: string; disabled: boolean; refreshing: boolean;
  onSave: (reviews: InputReview[]) => Promise<PlanningState | null>;
  onUploaded: () => void; onOpenSource: (source: JournalSource) => Promise<boolean>;
}) {
  const [drafts, setDrafts] = useState(() => savedRows(state));
  const previous = useRef(savedRows(state));
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
  async function attach(id: string, file: File) {
    if (pending.current || blocked) return;
    pending.current = true; setUploading(true); setMessage("");
    try {
      const document = await uploadToSituation(caseId, situationId, file);
      if (!alive.current) return;
      setUploaded((current) => [...current, document]);
      setDrafts((current) => ({ ...current, [id]: { ...current[id], documentIds: [...new Set([...current[id].documentIds, document.id])], sufficient: false, editing: true } }));
      setMessage("Soubor přiložen. Vazbu k položce uložte tlačítkem Uložit."); onUploaded();
    } catch (error) { if (alive.current) setMessage(error instanceof Error ? error.message : "Soubor se nepodařilo přiložit."); }
    finally { pending.current = false; if (alive.current) setUploading(false); }
  }
  const changed = Object.values(drafts).filter((row) => !previous.current[row.criterionId] || content(row) !== content(previous.current[row.criterionId]));
  async function save() {
    if (pending.current || blocked || !changed.length) return;
    pending.current = true; setSaving(true); setMessage("");
    const reviews = changed.map(({ editing: _editing, proof: _proof, ...row }) => row);
    try {
      const next = await onSave(reviews);
      if (!alive.current) return;
      if (!next) { setMessage("Uložení se nezdařilo. Rozepsané hodnoty zůstaly zachované."); return; }
      const saved = savedRows(next); previous.current = saved; setDrafts(saved); setMessage("Uloženo.");
    } catch { if (alive.current) setMessage("Uložení se nezdařilo. Rozepsané hodnoty zůstaly zachované."); }
    finally { pending.current = false; if (alive.current) setSaving(false); }
  }
  return <form className="required-inputs-form" aria-label="K doplnění" onSubmit={(e) => { e.preventDefault(); void save(); }}>
    {criteria(state).map((criterion) => {
      const row = drafts[criterion.id]; if (!row) return null;
      const dirty = content(row) !== content(previous.current[criterion.id] ?? row);
      const compact = criterion.status === "SATISFIED" && row.sufficient && !dirty && !row.editing && !refreshing;
      return <fieldset key={criterion.id} className="required-input-row" aria-label={criterion.requirement_text} disabled={blocked}>
        <label className="required-input-title"><input type="checkbox" checked={row.sufficient} onChange={(e) => edit(criterion.id, { sufficient: e.target.checked })} />{criterion.requirement_text}</label>
        {compact ? <div><p>{row.value}</p><p>{row.origin === "USER" ? "Zadal uživatel" : "Doloženo zdroji"}</p><button type="button" onClick={() => setDrafts((current) => ({ ...current, [criterion.id]: { ...row, editing: true } }))}>Upravit</button></div> : <>
          <label>Doplnit informaci<textarea aria-label={`Doplnit informaci: ${criterion.requirement_text}`} value={row.value} onChange={(e) => edit(criterion.id, { value: e.target.value, origin: "USER" })} /></label>
          <label className="required-input-file">Přiložit soubor<input type="file" aria-label={`Přiložit soubor k položce ${criterion.requirement_text}`} accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.rtf" onChange={(e) => { const file = e.target.files?.[0]; if (file) void attach(criterion.id, file); e.target.value = ""; }} /></label>
        </>}
        {refreshing ? <p role="status">Ověřuji aktuální zdroje…</p> : dirty ? <p>Rozepsané — dosud neuloženo.</p> : criterion.stale ? <p>Původní zdroj byl odebrán nebo změněn. Potvrďte doplnění znovu.</p> : null}
        <details><summary>Zdroje a podrobnosti</summary>
          <p>{row.origin === "USER" ? "Zadal uživatel — uživatelské tvrzení, nikoli ověření dokumentem." : "Dokumentové zdroje a další doložení."}</p>
          <label>Původ hodnoty<select value={row.origin} onChange={(e) => edit(criterion.id, { origin: e.target.value === "USER" ? "USER" : "DOCUMENT" })}><option value="USER">Zadal uživatel</option><option value="DOCUMENT">Dokumentové zdroje</option></select></label>
          <label>Vysvětlení<textarea value={row.explanation} onChange={(e) => edit(criterion.id, { explanation: e.target.value })} /></label>
          {uniqueInsights(state.evidence).map((source) => <label key={source.id}><input type="checkbox" checked={row.insightIds.includes(source.id)} onChange={(e) => edit(criterion.id, { insightIds: e.target.checked ? [...row.insightIds, source.id] : row.insightIds.filter((id) => id !== source.id) })} />{source.documentName}: {source.title} — {source.value}</label>)}
          {row.documentIds.map((id) => <p key={id}>{state.documents?.find((doc) => doc.id === id)?.name ?? uploaded.find((doc) => doc.id === id)?.name ?? "Přiložený dokument"}<button type="button" onClick={() => edit(criterion.id, { documentIds: row.documentIds.filter((docId) => docId !== id) })}>Odebrat vazbu</button></p>)}
          {!refreshing && (sourceDetails?.[criterion.id] ?? uniqueInsights(criterion.sources).map(evidenceSource)).map((source) => <p key={source.key}>
            {source.passage ? <button type="button" onClick={() => void onOpenSource(source.passage!)}>{source.label}: {source.quote}</button> : source.documentId ? <button type="button" onClick={() => onOpenDocument?.(source.documentId!)}>{source.label}</button> : <span>{source.label}</span>}
          </p>)}
          {criterion.historicalInsightIds?.length || criterion.historicalDocumentIds?.length ? <details><summary>Historické vazby</summary><p>{[...new Set([...(criterion.historicalInsightIds ?? []), ...(criterion.historicalDocumentIds ?? [])])].join(", ")}</p></details> : null}
        </details>
      </fieldset>;
    })}
    <button type="submit" disabled={blocked || !changed.length}>Uložit</button>
    {message ? <p role="status">{message}</p> : null}
  </form>;
}
