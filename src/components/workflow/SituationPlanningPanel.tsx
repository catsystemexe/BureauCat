"use client";

import { RequiredInputsForm } from "@/components/workflow/RequiredInputsForm";
import { useEffect, useRef, useState } from "react";
import { analysisOverview } from "@/lib/workflow/analysisOverview";
import type { AnalysisQuestion, QuestionSource } from "@/lib/workflow/analysisOverview";
import type { JournalSource } from "@/lib/journal/overview";
import { uniqueInsights, editPlan, currentBrief } from "@/lib/workflow/planning";
import type { EditablePlan, PlanningCommand, PlanningState, SituationBrief } from "@/lib/workflow/planning";
const emptyPlan = () => editPlan(null);
const lines = (value: string) => value.split("\n");
type Action = PlanningCommand extends infer C ? C extends PlanningCommand ? Omit<C, "caseId" | "requestKey" | "expectedRevision" | "contextHash"> : never : never;

export function SituationPlanningPanel({ caseId, situationId, view, onOpenSource, refreshKey = 0, onSelectPlan, onOpenDocument, onSituationDocumentLinked }: {
  onSituationDocumentLinked?: () => void; onOpenDocument?: (id: string) => void; onSelectPlan?: () => void; refreshKey?: number; caseId: string; situationId: string; view: "ANALYSIS" | "PLAN" | "COLLECTION";
  onOpenSource: (source: JournalSource) => Promise<boolean>;
}) {
  const [state, setState] = useState<PlanningState | null>(null);
  const [goalEditing, setGoalEditing] = useState(false);
  const [planEditing, setPlanEditing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [goalId, setGoalId] = useState("");
  const [title, setTitle] = useState("");
  const [briefDraft, setBriefDraft] = useState<SituationBrief | null>(null);
  const [draft, setDraft] = useState<EditablePlan>(emptyPlan);
  const sequence = useRef(0), pending = useRef(false), queuedRefresh = useRef(false);
  const [sourcesStale, setSourcesStale] = useState(false);
  const alive = useRef(true);
  const endpoint = `/api/situations/${situationId}/planning`;
  function apply(next: PlanningState, preserveDraft = false) {
    setState(next);
    if (!preserveDraft || state?.goal?.id !== next.goal?.id || state?.plan?.id !== next.plan?.id) {
      setDraft(next.plan && "version" in next.plan.content ? next.plan.content : emptyPlan());
      setGoalId(next.goal?.id ?? "");
      setTitle(next.goal?.title ?? "");
      setBriefDraft(next.brief ?? null);
    }
    setSourcesStale(false);
  }
  async function refresh(preserveDraft = false) {
    if (pending.current) { queuedRefresh.current = true; return; }
    const request = ++sequence.current;
    pending.current = true; setBusy(true); setError("");
    try {
      const response = await fetch(`${endpoint}?caseId=${encodeURIComponent(caseId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Stav se nepodařilo načíst.");
      if (alive.current && request === sequence.current) apply(data.planning, preserveDraft);
    } catch (e) { if (alive.current && request === sequence.current) setError(e instanceof Error ? e.message : "Chyba načtení."); }
    finally { if (alive.current && request === sequence.current) { pending.current = false; setBusy(false); if (queuedRefresh.current) { queuedRefresh.current = false; void refresh(true); } } }
  }
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => { alive.current = false; sequence.current++; pending.current = false; };
    // The parent keys this component by Case/Situation, so no state crosses scopes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, situationId]);
  useEffect(() => {
    const changed = () => { setSourcesStale(true); void refresh(true); };
    window.addEventListener("bureaucat:journal-refresh", changed);
    return () => window.removeEventListener("bureaucat:journal-refresh", changed);
  });
  useEffect(() => { if (state) { setSourcesStale(true); void refresh(true); } }, [refreshKey]);

  const briefAvailability = JSON.stringify([state?.documents?.map((d) => d.id), state?.evidence.map((e) => [e.id, e.usable])]);
  useEffect(() => {
    if (state) setBriefDraft((draft) => currentBrief(draft, state.documents ?? [], state.evidence));
  }, [briefAvailability]);

  async function run(action: Action) {
    if (!state || pending.current) return null;
    pending.current = true; setBusy(true); setError("");
    const request = ++sequence.current;
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        ...action, caseId, requestKey: crypto.randomUUID(), expectedRevision: state.revision, contextHash: state.contextHash
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Změnu se nepodařilo uložit.");
      if (!alive.current || request !== sequence.current) return null;
      apply(data.planning, action.action === "reviewCriterion" || action.action === "matchInputs" || action.action === "suggestGoals" || action.action === "reviewInputs");
      if (action.action === "confirmGoal") setGoalEditing(false);
      if (["savePlan", "suggestPlan", "acceptPlan"].includes(action.action)) setPlanEditing(false);
      if (action.action === "suggestPlan") onSelectPlan?.();
      const stepKey = action.action === "confirmGoal" || action.action === "savePlan" || action.action === "suggestPlan" ? "PLAN" : action.action === "acceptPlan" ? "COLLECTION" : null;
      window.dispatchEvent(new CustomEvent("bureaucat:workflow-refresh", { detail: { situationId, stepKey } }));
      return data.planning as PlanningState;
    } catch (e) { if (alive.current && request === sequence.current) setError(e instanceof Error ? e.message : "Změna selhala."); return null; }
    finally { if (alive.current && request === sequence.current) { pending.current = false; setBusy(false); if (queuedRefresh.current) { queuedRefresh.current = false; void refresh(true); } } }
  }
  const canEdit = !busy && !sourcesStale;
  const startPlanEdit = () => { setDraft(editPlan(state?.plan?.content ?? null)); setPlanEditing(true); };
  const displayedBrief = goalEditing ? briefDraft : state?.brief;
  const overview = state ? analysisOverview(state) : null;
  const suggestPlan = () => state?.goal && void run({ action: "suggestPlan", goalId: state.goal.id });
  return <div className="situation-planning">
    {error ? <p role="alert" className="planning-error">{error} <button disabled={busy} type="button" onClick={() => void refresh(true)}>Zkusit znovu načíst</button></p> : null}
    {busy ? <p role="status">Zpracovávám…</p> : null}
    {!state ? <p>Načítám pracovní stav…</p> : <>
      <section hidden={view === "PLAN"} aria-label="Analýza situace">
        <h2>Situace</h2>
        <div className="planning-situation-brief">
        {displayedBrief ? <><p>{displayedBrief.trigger.description}</p>
          {state.briefStale ? <p role="status">Historický kontext — podklady se změnily.</p> : null}
          {displayedBrief.trigger.documentIds.map((id) => { const doc = state.documents?.find((d) => d.id === id); return doc ? <button key={id} type="button" onClick={() => onOpenDocument?.(id)}>{doc.name}</button> : <p key={id}>Původní dokument podnětu již není v situaci.</p>; })}
        </> : <p>Podnět zatím není určený. Navrhněte jej pomocí AI nebo zadejte vlastní.</p>}
        {displayedBrief?.requirements.length ? <ul className="planning-situation-requirements">{displayedBrief.requirements.map((item, i) => <li key={`requirement:${i}`}>
          {item.text}<BriefSources ids={item.insightIds} state={state} onOpenSource={onOpenSource} />
        </li>)}</ul> : null}
        {displayedBrief?.deadline ? <div><strong>{!goalEditing && !sourcesStale && state.deadlineVerified ? "Doložený explicitní termín" : "Termín — doložení není potvrzené"}: {displayedBrief.deadline.text}</strong><BriefSources ids={displayedBrief.deadline.insightIds} state={state} onOpenSource={onOpenSource} /></div> : null}
        </div>
        <h2>Cíl</h2>
        {state.goal ? <article className="planning-goal-card"><strong>{state.goal.title}</strong>
          <button disabled={!canEdit} type="button" onClick={() => { setBriefDraft(state.brief ?? null); setGoalEditing(true); }}>Změnit</button></article> : <>
          <p>Cíl zatím není potvrzený.</p>
          {state.goalSelectionRequired ? <p>Starší cíle vyžadují výslovný výběr.</p> : null}
          {state.goals.filter((g) => g.status === "draft" && g.currentProposal).map((g) => <article className="planning-goal-card" key={g.id}>
            <strong>{g.title}</strong>{g.reason ? <p>{g.reason}</p> : null}
            <button disabled={!canEdit} type="button" onClick={() => void run({ action: "confirmGoal", goalId: g.id, title: g.title, ...(g.brief ? { brief: g.brief } : {}) })}>Použít</button>
            <button disabled={!canEdit} type="button" onClick={() => { setGoalId(g.id); setTitle(g.title); setBriefDraft(g.brief ?? state.brief ?? null); setGoalEditing(true); }}>Upravit</button>
          </article>)}
          <button disabled={!canEdit} type="button" onClick={() => void run({ action: "suggestGoals" })}>Navrhnout cíl a podnět pomocí AI</button>
          <button type="button" disabled={!canEdit} onClick={() => { setGoalId(""); setTitle(""); setBriefDraft({ trigger: { description: "", documentIds: [] }, requirements: [], deadline: null }); setGoalEditing(true); }}>Vlastní cíl</button>
        </>}
        <div hidden={!goalEditing}>
          <fieldset disabled={!canEdit}><legend>Formulace cíle</legend>
            <label>Vlastní nebo uložený návrh<select value={goalId} onChange={(e) => { setGoalId(e.target.value); setTitle(state.goals.find((g) => g.id === e.target.value)?.title ?? ""); setBriefDraft(state.goals.find((g) => g.id === e.target.value)?.brief ?? null); }}>
              <option value="">Vlastní formulace</option>{state.goals.filter((g) => g.status === "draft" || g.status === "active").map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select></label>
            <label>Čeho chcete dosáhnout?<textarea value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label>Podnět / co nyní řešíme<textarea value={briefDraft?.trigger.description ?? ""} onChange={(e) => setBriefDraft({ ...(briefDraft ?? { requirements: [], deadline: null }), trigger: { description: e.target.value, documentIds: briefDraft?.trigger.documentIds ?? [] } })} /></label>
            <fieldset><legend>Dokumenty podnětu (bez výběru jde o vlastní Akci)</legend>{state.documents?.map((doc) => <label key={doc.id}><input type="checkbox" checked={briefDraft?.trigger.documentIds.includes(doc.id) ?? false} onChange={(e) => setBriefDraft({ ...(briefDraft ?? { requirements: [], deadline: null }), trigger: { description: briefDraft?.trigger.description ?? "", documentIds: e.target.checked ? [...new Set([...(briefDraft?.trigger.documentIds ?? []), doc.id])] : (briefDraft?.trigger.documentIds ?? []).filter((id) => id !== doc.id) } })} />{doc.name}</label>)}</fieldset>
            {briefDraft?.requirements.map((item, index) => <fieldset key={`requirement:${index}`}><legend>{item.text}</legend>
              <BriefSourceSelection ids={item.insightIds} evidence={state.evidence} onChange={(ids) => setBriefDraft({ ...briefDraft, requirements: briefDraft.requirements.map((entry, i) => i === index ? { ...entry, insightIds: ids } : entry) })} />
            </fieldset>)}
            {briefDraft?.deadline ? <fieldset><legend>Zdroj termínu: {briefDraft.deadline.text}</legend>
              <BriefSourceSelection ids={briefDraft.deadline.insightIds} evidence={state.evidence} onChange={(ids) => setBriefDraft({ ...briefDraft, deadline: { ...briefDraft.deadline!, insightIds: ids } })} />
              {!briefDraft.deadline.insightIds.length ? <p>Termín není doložený. Vyberte platný zdroj nebo jej ponechte jako neověřený údaj.</p> : null}
              <button type="button" onClick={() => setBriefDraft({ ...briefDraft, deadline: null })}>Odebrat termín</button>
            </fieldset> : null}
            <button type="button" disabled={!title.trim()} onClick={() => void run({ action: "confirmGoal", title, ...(goalId ? { goalId } : {}), ...(briefDraft?.trigger.description.trim() ? { brief: briefDraft } : {}) })}>Potvrdit cíl</button>
            <button type="button" onClick={() => setGoalEditing(false)}>Zavřít úpravu</button>
          </fieldset>
        </div>
        <h2>K doplnění</h2>
        {state.plan?.status === "ACCEPTED" && state.inputs.some((input) => input.criteria.length) ? <RequiredInputsForm key={state.plan.id}
          state={state} caseId={caseId} situationId={situationId} disabled={!canEdit} refreshing={sourcesStale}
          onOpenSource={onOpenSource} onOpenDocument={onOpenDocument}
          sourceDetails={Object.fromEntries(overview!.criterionSources.map(({ criterion, sources }) => [criterion.id, sources]))}
          onSave={(reviews) => run({ action: "reviewInputs", planId: state.plan!.id, reviews })}
          onUploaded={() => { onSituationDocumentLinked?.(); window.dispatchEvent(new Event("bureaucat:journal-refresh")); }} /> : null}
        {overview!.questions.length ? <details className="planning-additional-questions"><summary>Další otázky z podkladů</summary>
          <AnalysisQuestions questions={overview!.questions} onOpenSource={onOpenSource} onOpenDocument={onOpenDocument} />
        </details> : null}
        <footer><button disabled={!state.goal || !canEdit || planEditing} type="button" onClick={suggestPlan}>Navrhnout plán</button>
          <button disabled={!state.goal || !canEdit} type="button" onClick={() => { startPlanEdit(); onSelectPlan?.(); }}>Vytvořit plán ručně</button></footer>
      </section>
      <section hidden={view !== "PLAN"} aria-label="Plán situace">
        <header><h2>Plán</h2><strong>Potvrzený cíl: {state.goal?.title ?? "Cíl zatím není potvrzený."}</strong></header>
        {state.plan ? <div hidden={planEditing}>
          <h3>Očekávaný výstup</h3><p>{state.plan.content.expectedOutput}</p>
          <ol>{state.plan.content.procedure.map((action, i) => typeof action === "string" ? <li key={`legacy:${i}`}><strong>{action}</strong></li> : <li key={action.id}>
            <strong>{action.title}</strong><p>Výsledek: {action.expectedResult}</p>
            {action.explanation || action.inputIds.length ? <details><summary>Podklady a vysvětlení</summary><p>{action.explanation}</p>
              {state.plan!.content.inputs.filter((input) => "id" in input && typeof input.id === "string" && action.inputIds.includes(input.id)).map((input) => <div key={(input as EditablePlan["inputs"][number]).id}><strong>{input.title}</strong><p>{input.description}</p><ul>{input.criteria.map((c, n) => <li key={n}>{c}</li>)}</ul></div>)}
            </details> : null}
          </li>)}</ol>
          <p>{state.plan.status === "ACCEPTED" ? "Přijatý plán" : "Návrh — dosud nepřijatý"}</p>
          {state.plan.status !== "ACCEPTED" ? <button disabled={!canEdit} type="button" onClick={() => void run({ action: "acceptPlan", planId: state.plan!.id })}>Použít plán</button> : null}
          <button disabled={!canEdit} type="button" onClick={startPlanEdit}>{state.plan.status === "ACCEPTED" ? "Změnit plán" : "Upravit"}</button>
        </div> : <div hidden={planEditing}><p>Plán zatím není uložený.</p><button disabled={!state.goal || !canEdit} type="button" onClick={suggestPlan}>Navrhnout plán</button><button disabled={!state.goal || !canEdit} type="button" onClick={startPlanEdit}>Vytvořit plán ručně</button></div>}
        <div hidden={!planEditing}><fieldset disabled={!canEdit}><legend>Úprava návrhu plánu</legend>
          <label>Očekávaný výstup<textarea value={draft.expectedOutput} onChange={(e) => setDraft({ ...draft, expectedOutput: e.target.value })} /></label>
          {draft.inputs.map((input) => <div key={input.id}>
            <label>Potřebná informace<input value={input.title} onChange={(e) => setDraft({ ...draft, inputs: draft.inputs.map((x) => x.id === input.id ? { ...x, title: e.target.value } : x) })} /></label>
            <label>Vysvětlení<textarea value={input.description} onChange={(e) => setDraft({ ...draft, inputs: draft.inputs.map((x) => x.id === input.id ? { ...x, description: e.target.value } : x) })} /></label>
            <label>Kritéria dostatečnosti (jedno na řádek)<textarea value={input.criteria.join("\n")} onChange={(e) => setDraft({ ...draft, inputs: draft.inputs.map((x) => x.id === input.id ? { ...x, criteria: lines(e.target.value) } : x) })} /></label>
            <button type="button" onClick={() => setDraft({ ...draft, inputs: draft.inputs.filter((x) => x.id !== input.id), procedure: draft.procedure.map((a) => ({ ...a, inputIds: a.inputIds.filter((id) => id !== input.id) })) })}>Odebrat vstup z návrhu</button>
          </div>)}
          <button type="button" onClick={() => setDraft({ ...draft, inputs: [...draft.inputs, { id: crypto.randomUUID(), title: "", description: "", criteria: [""] }] })}>Přidat potřebnou informaci</button>
          {draft.procedure.map((action) => <div key={action.id}>
            <label>Název akce<input value={action.title} onChange={(e) => setDraft({ ...draft, procedure: draft.procedure.map((a) => a.id === action.id ? { ...a, title: e.target.value } : a) })} /></label>
            <label>Očekávaný výsledek<textarea value={action.expectedResult} onChange={(e) => setDraft({ ...draft, procedure: draft.procedure.map((a) => a.id === action.id ? { ...a, expectedResult: e.target.value } : a) })} /></label>
            <label>Vysvětlení akce<textarea value={action.explanation ?? ""} onChange={(e) => setDraft({ ...draft, procedure: draft.procedure.map((a) => a.id === action.id ? { ...a, explanation: e.target.value } : a) })} /></label>
            <fieldset><legend>Podklady pro tuto akci</legend>{draft.inputs.map((input) => <label key={input.id}><input type="checkbox" checked={action.inputIds.includes(input.id)} onChange={(e) => setDraft({ ...draft, procedure: draft.procedure.map((a) => a.id === action.id ? { ...a, inputIds: e.target.checked ? [...new Set([...a.inputIds, input.id])] : a.inputIds.filter((id) => id !== input.id) } : a) })} />{input.title || "Nový vstup"}</label>)}</fieldset>
            <button type="button" onClick={() => setDraft({ ...draft, procedure: draft.procedure.filter((a) => a.id !== action.id) })}>Odebrat akci</button>
          </div>)}
          <button type="button" onClick={() => setDraft({ ...draft, procedure: [...draft.procedure, { id: crypto.randomUUID(), title: "", expectedResult: "", explanation: "", inputIds: [] }] })}>Přidat akci</button>
          <button type="button" disabled={!state.goal} onClick={() => state.goal && void run({ action: "savePlan", goalId: state.goal.id, content: draft })}>Uložit návrh plánu</button>
          <button type="button" onClick={() => setPlanEditing(false)}>Zavřít úpravu</button>
        </fieldset></div>
      </section>
      <details><summary>Historie</summary>
        {state.briefHistory?.map((entry) => <details key={`brief-history:${entry.id}`}><summary>Historický podnět: {entry.brief.trigger.description}</summary>
          <p>Historické vazby; nejde o aktuální výběr ani potvrzení doložení.</p>
          <p>{entry.brief.trigger.documentIds.join(", ")}</p>
          {entry.brief.requirements.map((item, index) => <p key={index}>{item.text} — {item.insightIds.join(", ")}</p>)}
          {entry.brief.deadline ? <p>{entry.brief.deadline.text} — {entry.brief.deadline.insightIds.join(", ")}</p> : null}
        </details>)}
        {state.goals.map((g) => <article key={g.id}><strong>{g.title}</strong>{g.reason ? <p>{g.reason}</p> : null}
          {view !== "PLAN" && (g.status === "draft" || (g.status === "active" && !g.confirmed_at)) ? <button type="button" disabled={!canEdit} onClick={() => { setGoalId(g.id); setTitle(g.title); setBriefDraft(g.brief ?? state.brief ?? null); setGoalEditing(true); }}>Upravit návrh cíle</button> : null}</article>)}
        {state.history.map((p) => <article key={p.id}><strong>{p.status === "ACCEPTED" ? "Přijatý" : p.status === "SUPERSEDED" ? "Nahrazený" : "Návrh"}: {p.content.expectedOutput}</strong><ol>{p.content.procedure.map((a, i) => <li key={typeof a === "string" ? `legacy:${i}` : a.id}>{typeof a === "string" ? a : a.title}</li>)}</ol></article>)}
        {state.reviewHistory?.map((entry) => <div key={entry.id}>{entry.changes.map((change, i) => <p key={i}>{change.requirement}: {change.after.value} — {change.after.explanation}</p>)}</div>)}
      </details>
    </>}
  </div>;
}

function BriefSources({ ids, state, onOpenSource }: { ids: string[]; state: PlanningState; onOpenSource: (source: JournalSource) => Promise<boolean> }) {
  return ids.length ? <details><summary>Zdroje požadavku</summary>{[...new Set(ids)].map((id) => {
    const e = state.evidence.find((source) => source.id === id);
    return e?.usable && !state.briefStale ? <button key={id} type="button" onClick={() => void onOpenSource({ documentId: e.documentId, documentName: e.documentName, pinId: e.pinId, insightId: id, startOffset: e.startOffset, endOffset: e.endOffset, quote: e.quote })}>{e.documentName}: {e.quote}</button> : <p key={id}>Původní pasáž vyžaduje nové ověření.</p>;
  })}</details> : null;
}

function BriefSourceSelection({ ids, evidence, onChange }: { ids: string[]; evidence: PlanningState["evidence"]; onChange: (ids: string[]) => void }) {
  const sources = uniqueInsights(evidence).filter((source) => source.usable);
  const selected = [...new Set(ids)].filter((id) => sources.some((source) => source.id === id));
  return <details><summary>Upravit aktuální zdrojové vazby</summary>{sources.map((source) => <label key={source.id}>
    <input type="checkbox" checked={selected.includes(source.id)} onChange={(e) => onChange(e.target.checked ? [...selected, source.id] : selected.filter((id) => id !== source.id))} />
    {source.documentName}: {source.title} — {source.quote}
  </label>)}</details>;
}

function QuestionSources({ sources, onOpenSource, onOpenDocument }: { sources: QuestionSource[]; onOpenSource: (source: JournalSource) => Promise<boolean>; onOpenDocument?: (id: string) => void }) {
  return sources.length ? <details><summary>Zdroje</summary>{sources.map((source) => <p key={source.key}>
    {source.passage ? <button type="button" onClick={() => void onOpenSource(source.passage!)}>{source.label}: {source.quote}</button> : source.documentId ? <button type="button" onClick={() => onOpenDocument?.(source.documentId!)}>{source.label}</button> : <span>{source.label}</span>}
  </p>)}</details> : null;
}
function AnalysisQuestions({ questions, onOpenSource, onOpenDocument }: { questions: AnalysisQuestion[]; onOpenSource: (source: JournalSource) => Promise<boolean>; onOpenDocument?: (id: string) => void }) {
  return <ul>{questions.map((question) => <li key={question.key}><details><summary>{question.title || question.value}</summary>
    {question.value && question.value !== question.title ? <p>{question.value}</p> : null}
    {question.conflict ? <p>Rozpor — je potřeba ověřit.</p> : null}
    <QuestionSources sources={question.sources} onOpenSource={onOpenSource} onOpenDocument={onOpenDocument} />
  </details></li>)}</ul>;
}
