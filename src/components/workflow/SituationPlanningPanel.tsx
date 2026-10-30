"use client";

import { useEffect, useRef, useState } from "react";
import type { JournalSource } from "@/lib/journal/overview";
import { uniqueInsights, editPlan } from "@/lib/workflow/planning";
import type { EditablePlan, PlanningCommand, PlanningState } from "@/lib/workflow/planning";
const emptyPlan = () => editPlan(null);
const lines = (value: string) => value.split("\n");
const labels: Record<string, string> = { SATISFIED: "Máme", INCOMPLETE: "Neúplné", MISSING: "Chybí" };
const evidenceLabels: Record<string, string> = { verified: "ověřené", inferred: "odvozené", unverified: "neověřené", conflict: "rozpor" };
type Action = PlanningCommand extends infer C ? C extends PlanningCommand ? Omit<C, "caseId" | "requestKey" | "expectedRevision" | "contextHash"> : never : never;

export function SituationPlanningPanel({ caseId, situationId, view, onOpenSource, refreshKey = 0, onSelectPlan }: {
  onSelectPlan?: () => void; refreshKey?: number; caseId: string; situationId: string; view: "ANALYSIS" | "PLAN" | "COLLECTION";
  onOpenSource: (source: JournalSource) => Promise<boolean>;
}) {
  const [state, setState] = useState<PlanningState | null>(null);
  const [goalEditing, setGoalEditing] = useState(false);
  const [planEditing, setPlanEditing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [goalId, setGoalId] = useState("");
  const [title, setTitle] = useState("");
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

  async function run(action: Action) {
    if (!state || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    const request = ++sequence.current;
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        ...action, caseId, requestKey: crypto.randomUUID(), expectedRevision: state.revision, contextHash: state.contextHash
      }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Změnu se nepodařilo uložit.");
      if (!alive.current || request !== sequence.current) return;
      apply(data.planning, action.action === "reviewCriterion" || action.action === "matchInputs" || action.action === "suggestGoals");
      if (action.action === "confirmGoal") setGoalEditing(false);
      if (["savePlan", "suggestPlan", "acceptPlan"].includes(action.action)) setPlanEditing(false);
      if (action.action === "suggestPlan") onSelectPlan?.();
      const stepKey = action.action === "confirmGoal" || action.action === "savePlan" || action.action === "suggestPlan" ? "PLAN" : action.action === "acceptPlan" ? "COLLECTION" : null;
      window.dispatchEvent(new CustomEvent("bureaucat:workflow-refresh", { detail: { situationId, stepKey } }));
    } catch (e) { if (alive.current && request === sequence.current) setError(e instanceof Error ? e.message : "Změna selhala."); }
    finally { if (alive.current && request === sequence.current) { pending.current = false; setBusy(false); if (queuedRefresh.current) { queuedRefresh.current = false; void refresh(true); } } }
  }
  const canEdit = !busy && !sourcesStale;
  const startPlanEdit = () => { setDraft(editPlan(state?.plan?.content ?? null)); setPlanEditing(true); };
  const brief = (value: string) => value.length > 180 ? `${value.slice(0, 180)}…` : value;
  const coverageLabel = (input: PlanningState["inputs"][number]) => input.criteria.some((c) => c.assessed === false) ? "Dosud nevyhodnoceno" : labels[input.status];
  const information = state?.evidence.filter((e) => !["question", "conflict"].includes(e.type) && e.evidenceState !== "conflict") ?? [];
  const questions = state?.evidence.filter((e) => ["question", "conflict"].includes(e.type) || e.evidenceState === "conflict") ?? [];
  const journalQuestions = state?.preliminary?.filter((e) => e.type === "QUESTION" || e.evidenceState === "conflict") ?? [];
  const suggestPlan = () => state?.goal && void run({ action: "suggestPlan", goalId: state.goal.id });
  return <div className="situation-planning">
    {error ? <p role="alert" className="planning-error">{error} <button disabled={busy} type="button" onClick={() => void refresh(true)}>Zkusit znovu načíst</button></p> : null}
    {busy ? <p role="status">Zpracovávám…</p> : null}
    {!state ? <p>Načítám pracovní stav…</p> : <>
      <section hidden={view === "PLAN"} aria-label="Analýza situace">
        <h2>Cíl situace</h2>
        {state.goal ? <article className="planning-goal-card"><strong>{state.goal.title}</strong>
          <button disabled={!canEdit} type="button" onClick={() => setGoalEditing(true)}>Změnit</button></article> : <>
          <p>Cíl zatím není potvrzený.</p>
          {state.goalSelectionRequired ? <p>Starší cíle vyžadují výslovný výběr.</p> : null}
          {state.goals.filter((g) => g.status === "draft" && g.currentProposal).map((g) => <article className="planning-goal-card" key={g.id}>
            <strong>{g.title}</strong>{g.reason ? <p>{g.reason}</p> : null}
            <button disabled={!canEdit} type="button" onClick={() => void run({ action: "confirmGoal", goalId: g.id, title: g.title })}>Použít</button>
            <button disabled={!canEdit} type="button" onClick={() => { setGoalId(g.id); setTitle(g.title); setGoalEditing(true); }}>Upravit</button>
          </article>)}
          <button disabled={!canEdit} type="button" onClick={() => void run({ action: "suggestGoals" })}>Navrhnout cíle pomocí AI</button>
          <button type="button" disabled={!canEdit} onClick={() => { setGoalId(""); setTitle(""); setGoalEditing(true); }}>Vlastní cíl</button>
        </>}
        <div hidden={!goalEditing}>
          <fieldset disabled={!canEdit}><legend>Formulace cíle</legend>
            <label>Vlastní nebo uložený návrh<select value={goalId} onChange={(e) => { setGoalId(e.target.value); setTitle(state.goals.find((g) => g.id === e.target.value)?.title ?? ""); }}>
              <option value="">Vlastní formulace</option>{state.goals.filter((g) => g.status === "draft" || g.status === "active").map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
            </select></label>
            <label>Čeho chcete dosáhnout?<textarea value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <button type="button" disabled={!title.trim()} onClick={() => void run({ action: "confirmGoal", title, ...(goalId ? { goalId } : {}) })}>Potvrdit cíl</button>
            <button type="button" onClick={() => setGoalEditing(false)}>Zavřít úpravu</button>
          </fieldset>
        </div>
        <h2>K dispozici</h2>
        <p>Uložené informace ze situace. Přítomnost dokumentu nepotvrzuje splnění požadavku; relevance vůči cíli se neodhaduje.</p>
        {information.map((e) => <details key={e.id}><summary>{e.title}: {brief(e.value)}</summary><p>{e.value}</p>
          <p>{e.documentName} — {e.quote}</p><p>{evidenceLabels[e.evidenceState] ?? "Neurčené doložení"}</p>
          {e.usable ? <button type="button" onClick={() => void onOpenSource({ documentId: e.documentId, documentName: e.documentName, pinId: e.pinId, insightId: e.id, startOffset: e.startOffset, endOffset: e.endOffset, quote: e.quote })}>Otevřít zdroj</button> : <p>Pasáž není ověřitelná.</p>}
        </details>)}
        {state.preliminary?.filter((e) => ["FACT", "CLAIM"].includes(e.type) && e.evidenceState !== "conflict").map((e) => <details key={e.id}><summary>{e.title}: {brief(e.value)}</summary><p>{e.value}</p><p>Uložená informace ze zápisníku; relevance vůči cíli není posouzená.</p></details>)}
        {state.plan?.status === "ACCEPTED" ? state.inputs.filter((i) => i.status === "SATISFIED").map((i) => <p key={i.id}>{i.title} — {sourcesStale ? "Ověřuji doložení…" : "Máme"}</p>) : null}
        {!information.length ? <p>Žádné uložené informace k zobrazení; dostupnost zatím není vyhodnocena.</p> : null}
        <h2>Chybí / potřebuje vyjasnit</h2>
        {state.plan?.status !== "ACCEPTED" ? <p>Předběžné otázky a rozpory z podkladů. Požadavky plánu zatím nejsou vyhodnocené.</p> : <>
          {state.inputs.filter((i) => i.status !== "SATISFIED").map((i) => <details key={i.id}><summary>{i.title} — {sourcesStale ? "Ověřuji doložení…" : coverageLabel(i)}</summary>
            {i.criteria.map((c) => <p key={c.id}>{c.requirement_text}: {c.stale ? "Původní doložení již neplatí. " : ""}{c.explanation || "Dostatečnost zatím nebyla posouzena."}</p>)}
          </details>)}
        </>}
        {questions.map((e) => <details key={e.id}><summary>{e.title}: {brief(e.value)}</summary><p>{e.value}</p><p>Uložená otázka / rozpor, relevance vůči cíli není odvozena.</p><p>{e.documentName}: {e.quote}</p></details>)}
        {journalQuestions.map((e) => <details key={e.id}><summary>{e.title}</summary><p>{e.value}</p><p>Uložená otázka / rozpor zápisníku; předběžné, bez automatického posouzení.</p></details>)}
        {!questions.length && !journalQuestions.length && state.plan?.status !== "ACCEPTED" ? <p>Žádné výslovně uložené otázky nebo rozpory. Neznamená to úplnost podkladů.</p> : null}
        {sourcesStale ? <p role="status">Podklady se změnily; ověřuji aktuální doložení…</p> : null}
        <details hidden={state.plan?.status !== "ACCEPTED"}><summary>Posoudit požadavky přijatého plánu</summary>
          <button disabled={!canEdit} type="button" onClick={() => state.plan && void run({ action: "matchInputs", planId: state.plan.id })}>Najít podklady v existujících analýzách pomocí AI</button>
          {state.inputs.map((input) => <section className="planning-coverage" key={input.id}><h4>{input.title} — {sourcesStale ? "Ověřuji aktuální doložení…" : coverageLabel(input)}</h4>
            {input.criteria.map((criterion) => <CriterionReview key={criterion.id} criterion={criterion} evidence={state.evidence} busy={busy} refreshing={sourcesStale}
              onOpenSource={onOpenSource} onSave={(value, insightIds, sufficient, explanation) => run({ action: "reviewCriterion", planId: state.plan!.id, criterionId: criterion.id, value, insightIds, sufficient, explanation })} />)}
          </section>)}
        </details>
        <footer><button disabled={!state.goal || !canEdit || planEditing} type="button" onClick={suggestPlan}>Navrhnout plán</button>
          <button disabled={!state.goal || !canEdit} type="button" onClick={() => { startPlanEdit(); onSelectPlan?.(); }}>Vytvořit plán ručně</button></footer>
      </section>
      <section hidden={view !== "PLAN"} aria-label="Plán situace">
        <header><h2>Plán</h2><strong>Potvrzený cíl: {state.goal?.title ?? "Cíl zatím není potvrzený."}</strong></header>
        {state.plan ? <div hidden={planEditing}>
          <h3>Očekávaný výstup</h3><p>{state.plan.content.expectedOutput}</p>
          <ol>{state.plan.content.procedure.map((action, i) => typeof action === "string" ? <li key={`legacy:${i}`}><strong>{action}</strong><p>Výsledek a vazby nejsou v této starší verzi uložené.</p></li> : <li key={action.id}>
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
        {state.goals.map((g) => <article key={g.id}><strong>{g.title}</strong>{g.reason ? <p>{g.reason}</p> : null}
          {view !== "PLAN" && (g.status === "draft" || (g.status === "active" && !g.confirmed_at)) ? <button type="button" disabled={!canEdit} onClick={() => { setGoalId(g.id); setTitle(g.title); setGoalEditing(true); }}>Upravit návrh cíle</button> : null}</article>)}
        {state.history.map((p) => <article key={p.id}><strong>{p.status === "ACCEPTED" ? "Přijatý" : p.status === "SUPERSEDED" ? "Nahrazený" : "Návrh"}: {p.content.expectedOutput}</strong><ol>{p.content.procedure.map((a, i) => <li key={typeof a === "string" ? `legacy:${i}` : a.id}>{typeof a === "string" ? a : a.title}</li>)}</ol></article>)}
        {state.reviewHistory?.map((entry) => <div key={entry.id}>{entry.changes.map((change, i) => <p key={i}>{change.requirement}: {change.after.value} — {change.after.explanation}</p>)}</div>)}
      </details>
    </>}
  </div>;
}

export function CriterionReview({ criterion, evidence, busy, refreshing = false, onSave, onOpenSource }: {
  criterion: PlanningState["inputs"][number]["criteria"][number]; evidence: PlanningState["evidence"]; busy: boolean; refreshing?: boolean;
  onSave: (value: string, ids: string[], sufficient: boolean, explanation: string) => Promise<void>;
  onOpenSource: (source: JournalSource) => Promise<boolean>;
}) {
  const currentEvidence = uniqueInsights(evidence);
  const [value, setValue] = useState(criterion.value), [ids, setIds] = useState([...new Set(criterion.insightIds)]);
  const [explanation, setExplanation] = useState(criterion.explanation);
  const previousSaved = useRef(criterion);
  const savedIdsKey = JSON.stringify([...new Set(criterion.insightIds)]);
  useEffect(() => {
    const previous = previousSaved.current;
    setValue((current) => current === previous.value ? criterion.value : current);
    setExplanation((current) => current === previous.explanation ? criterion.explanation : current);
    setIds((current) => JSON.stringify(current) === JSON.stringify([...new Set(previous.insightIds)]) ? [...new Set(criterion.insightIds)] : current);
    previousSaved.current = criterion;
  }, [criterion.value, criterion.explanation, savedIdsKey]);
  const availableIdsKey = JSON.stringify(currentEvidence.map((e) => e.id).sort());
  const selectedIds = [...new Set(ids)].filter((id) => currentEvidence.some((e) => e.id === id));
  useEffect(() => { setIds((current) => [...new Set(current)].filter((id) => currentEvidence.some((e) => e.id === id))); }, [availableIdsKey]);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return <fieldset disabled={busy || refreshing}><legend>{criterion.requirement_text} — {refreshing ? "Ověřuji aktuální doložení…" : criterion.assessed === false ? "Dostatečnost dosud neposouzena" : criterion.status === "SATISFIED" ? "Doloženo" : "Nutno doplnit / ověřit"}</legend>
    {criterion.stale ? <p role="status">Původní zdroj byl odebrán nebo změněn. Dřívější potvrzení nyní neplatí.</p> : null}
    {criterion.historicalInsightIds?.some((id) => !currentEvidence.some((e) => e.id === id)) ? <details>
      <summary>Historické vazby na odebrané poznatky</summary>
      {[...new Set(criterion.historicalInsightIds)].filter((id) => !currentEvidence.some((e) => e.id === id)).map((id) => <p key={id}>Poznatek {id} — již není v aktuálních zdrojích.</p>)}
    </details> : null}
    <label>Hodnota / zjištění<textarea value={value} onChange={(e) => setValue(e.target.value)} /></label>
    <label>Co chybí nebo potřebuje vyjasnit<textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} /></label>
    <details><summary>Vybrat konkrétní doložení z aktuální situace</summary>{currentEvidence.map((e) => <label key={e.id}>
      <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={(event) => setIds(event.target.checked ? [...new Set([...selectedIds, e.id])] : selectedIds.filter((id) => id !== e.id))} />
      {e.documentName}: {e.title} — {e.value} ({evidenceLabels[e.evidenceState] ?? "neurčené doložení"}){!e.usable ? " — pasáž není ověřitelná" : ""}
    </label>)}</details>
    {!refreshing && uniqueInsights(criterion.sources).map((e) => <p key={e.id}>{e.documentName}: {e.quote} <button type="button" onClick={async () => {
      const opened = await onOpenSource({ documentId: e.documentId, documentName: e.documentName, pinId: e.pinId, insightId: e.id,
        startOffset: e.startOffset, endOffset: e.endOffset, quote: e.quote });
      if (!opened && alive.current) setExplanation("Zdroj se nepodařilo otevřít. " + explanation);
    }}>Otevřít zdroj</button></p>)}
    <button type="button" onClick={() => void onSave(value, selectedIds, false, explanation)}>Uložit jako neúplné / chybějící</button>
    <button type="button" onClick={() => void onSave(value, selectedIds, true, explanation)}>Potvrdit doložení a dostatečnost</button>
  </fieldset>;
}
