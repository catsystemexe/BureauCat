"use client";

import { useEffect, useRef, useState } from "react";
import type { JournalSource } from "@/lib/journal/overview";
import type { PlanContent, PlanningCommand, PlanningState } from "@/lib/workflow/planning";
const emptyPlan = (): PlanContent => ({ expectedOutput: "", procedure: [""], inputs: [{ title: "", description: "", criteria: [""] }] });
const lines = (value: string) => value.split("\n");
const labels: Record<string, string> = { SATISFIED: "Máme", INCOMPLETE: "Neúplné", MISSING: "Chybí" };
const evidenceLabels: Record<string, string> = { verified: "ověřené", inferred: "odvozené", unverified: "neověřené", conflict: "rozpor" };
type Action = PlanningCommand extends infer C ? C extends PlanningCommand ? Omit<C, "caseId" | "requestKey" | "expectedRevision" | "contextHash"> : never : never;

export function SituationPlanningPanel({ caseId, situationId, view, onOpenSource, refreshKey = 0 }: {
  refreshKey?: number; caseId: string; situationId: string; view: "ANALYSIS" | "PLAN" | "COLLECTION";
  onOpenSource: (source: JournalSource) => Promise<boolean>;
}) {
  const [state, setState] = useState<PlanningState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [goalId, setGoalId] = useState("");
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState<PlanContent>(emptyPlan);
  const sequence = useRef(0), pending = useRef(false), queuedRefresh = useRef(false);
  const [sourcesStale, setSourcesStale] = useState(false);
  const alive = useRef(true);
  const endpoint = `/api/situations/${situationId}/planning`;
  function apply(next: PlanningState, preserveDraft = false) {
    setState(next);
    if (!preserveDraft || state?.goal?.id !== next.goal?.id || state?.plan?.id !== next.plan?.id) {
      setDraft(next.plan?.content ?? emptyPlan());
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
      apply(data.planning);
      const stepKey = action.action === "confirmGoal" || action.action === "savePlan" || action.action === "suggestPlan" ? "PLAN" : action.action === "acceptPlan" ? "COLLECTION" : null;
      window.dispatchEvent(new CustomEvent("bureaucat:workflow-refresh", { detail: { situationId, stepKey } }));
    } catch (e) { if (alive.current && request === sequence.current) setError(e instanceof Error ? e.message : "Změna selhala."); }
    finally { if (alive.current && request === sequence.current) { pending.current = false; setBusy(false); if (queuedRefresh.current) { queuedRefresh.current = false; void refresh(true); } } }
  }
  const modified = JSON.stringify(draft) !== JSON.stringify(state?.plan?.content);
  const unsavedEdits = state?.plan ? modified : Boolean(draft.expectedOutput || draft.procedure.some(Boolean) || draft.inputs.some((input) => input.title || input.description || input.criteria.some(Boolean)));
  return <div className="situation-planning" aria-label={view === "ANALYSIS" ? "Cíl situace" : view === "PLAN" ? "Pracovní plán" : "Potřebné vstupy"}>
    <div className="planning-toolbar"><h3>{view === "ANALYSIS" ? "Cíl situace" : view === "PLAN" ? "Plán" : "Potřebné vstupy"}</h3>
      <button type="button" disabled={busy} onClick={() => void refresh()}>Načíst uložený stav</button></div>
    {error ? <p role="alert" className="planning-error">{error}</p> : null}
    {busy ? <p role="status">Zpracovávám…</p> : null}
    {!state ? <p>Načítám pracovní stav…</p> : <>
      {state.goal ? <p><strong>Potvrzený cíl:</strong> {state.goal.title}</p> : <p>Cíl zatím není výslovně potvrzený.</p>}
      {view === "ANALYSIS" ? <fieldset disabled={busy}>
        <legend>Návrh a potvrzení cíle</legend>
        {state.goalSelectionRequired ? <p>Starší cíle nejsou automaticky autoritativní. Výslovně vyberte cíl, který chcete potvrdit; ostatní se zachovají v historii.</p> : null}
        <button type="button" onClick={() => void run({ action: "suggestGoals" })}>Navrhnout cíle pomocí AI</button>
        <label>Návrh nebo stávající cíl<select value={goalId} onChange={(e) => {
          setGoalId(e.target.value); setTitle(state.goals.find((g) => g.id === e.target.value)?.title ?? "");
        }}><option value="">Vlastní formulace</option>{state.goals.filter((g) => g.status === "draft" || g.status === "active").map((g) =>
          <option key={g.id} value={g.id}>{g.status === "draft" ? "Návrh: " : g.confirmed_at ? "Potvrzený: " : "Starší: "}{g.title}</option>)}</select></label>
        <label>Čeho chcete v této situaci dosáhnout?<textarea value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <p>Návrh ani jeho úprava nejsou potvrzením. Změna cíle zneplatní dosavadní přijetí plánu; historie zůstane zachována.</p>
        <button type="button" disabled={!title.trim()} onClick={() => void run({ action: "confirmGoal", title, ...(goalId ? { goalId } : {}) })}>Potvrdit cíl a otevřít Plán</button>
      </fieldset> : null}
      {view === "PLAN" && !state.goal ? <p>V Analýze nejprve výslovně vyberte nebo zadejte a potvrďte cíl.</p> : null}
      {view === "PLAN" && state.goal ? <fieldset disabled={busy}>
        <legend>{unsavedEdits ? "Upravený návrh — neuložený, nepřijatý" : state.plan?.status === "ACCEPTED" ? "Přijatý plán" : "Návrh plánu — dosud nepřijatý"}</legend>
        <button type="button" disabled={unsavedEdits} onClick={() => void run({ action: "suggestPlan", goalId: state.goal!.id })}>Navrhnout plán pomocí AI</button>
        <label>Očekávaný výstup<textarea value={draft.expectedOutput} onChange={(e) => setDraft({ ...draft, expectedOutput: e.target.value })} /></label>
        <label>Pracovní postup (jeden bod na řádek)<textarea value={draft.procedure.join("\n")} onChange={(e) => setDraft({ ...draft, procedure: lines(e.target.value) })} /></label>
        {draft.inputs.map((input, index) => <div className="planning-input-definition" key={index}>
          <label>Potřebná informace<input value={input.title} onChange={(e) => setDraft({ ...draft, inputs: draft.inputs.map((i, n) => n === index ? { ...i, title: e.target.value } : i) })} /></label>
          <label>Co je třeba zjistit<textarea value={input.description} onChange={(e) => setDraft({ ...draft, inputs: draft.inputs.map((i, n) => n === index ? { ...i, description: e.target.value } : i) })} /></label>
          <label>Kritéria dostatečnosti (jedno na řádek)<textarea value={input.criteria.join("\n")} onChange={(e) => setDraft({ ...draft, inputs: draft.inputs.map((i, n) => n === index ? { ...i, criteria: lines(e.target.value) } : i) })} /></label>
          <button type="button" disabled={draft.inputs.length === 1} onClick={() => setDraft({ ...draft, inputs: draft.inputs.filter((_, n) => n !== index) })}>Odebrat vstup z návrhu</button>
        </div>)}
        <button type="button" onClick={() => setDraft({ ...draft, inputs: [...draft.inputs, { title: "", description: "", criteria: [""] }] })}>Přidat potřebnou informaci</button>
        <p>Uložení změny vytvoří novou verzi a vyžádá nové přijetí. Samotné otevření kroku nic nepotvrzuje.</p>
        <button type="button" onClick={() => void run({ action: "savePlan", goalId: state.goal!.id, content: draft })}>Uložit návrh plánu</button>
        <button type="button" disabled={!state.plan || modified || state.plan.status === "ACCEPTED"} onClick={() => void run({ action: "acceptPlan", planId: state.plan!.id })}>Použít tento plán</button>
        {modified ? <p>Upravovaný obsah nejprve uložte jako návrh, než požádáte o další AI návrh nebo přijetí.</p> : null}
      </fieldset> : null}
      {view === "COLLECTION" && state.plan?.status !== "ACCEPTED" ? <p>Nejprve potvrďte cíl a přijměte aktuální plán v kroku Plán.</p> : null}
      {sourcesStale ? <p role="status">Podklady se změnily; ověřuji aktuální doložení…</p> : null}
      {view === "COLLECTION" && state.plan?.status === "ACCEPTED" ? <>
        <p>Soubor sám informaci nesplňuje. AI navrhne doložení; dostatečnost konkrétních zdrojů potvrzujete vy. Nejisté a rozporné podklady zůstávají neúplné.</p>
        <button disabled={busy} type="button" onClick={() => void run({ action: "matchInputs", planId: state.plan!.id })}>Najít podklady v existujících analýzách pomocí AI</button>
        {state.inputs.map((input) => <section className="planning-coverage" key={input.id}><h4>{input.title} — {sourcesStale ? "Ověřuji aktuální doložení…" : labels[input.status]}</h4>
          {input.criteria.map((criterion) => <CriterionReview key={criterion.id} criterion={criterion} evidence={state.evidence} busy={busy} refreshing={sourcesStale}
            onOpenSource={onOpenSource} onSave={(value, insightIds, sufficient, explanation) => run({ action: "reviewCriterion", planId: state.plan!.id, criterionId: criterion.id, value, insightIds, sufficient, explanation })} />)}
        </section>)}
      </> : null}
      {state.history.length ? <details><summary>Historie verzí plánu ({state.history.length})</summary>{state.history.map((p) => <div key={p.id}>
        <strong>Verze {p.revision} — {p.status === "ACCEPTED" ? "přijatá" : p.status === "SUPERSEDED" ? "nahrazená" : "návrh"}</strong>
        <p>{p.content.expectedOutput}</p><ol>{p.content.procedure.map((line, i) => <li key={i}>{line}</li>)}</ol>
        {p.content.inputs.map((input, i) => <p key={i}>{input.title}: {input.criteria.join("; ")}</p>)}
      </div>)}</details> : null}
      {state.reviewHistory?.length ? <details><summary>Historie doložení a ručních úprav</summary>{state.reviewHistory.map((entry) => <div key={entry.id}>
        <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString("cs-CZ")}</time>{entry.changes.map((change, index) => <p key={index}>
          {change.requirement ?? "Kritérium"} — {change.after.reviewed ? "Ruční posouzení" : "AI návrh"}: {change.before.value ? `Původně: ${change.before.value}. ` : ""}{change.after.value || "Bez doložené hodnoty"} — {change.after.explanation}
        </p>)}
      </div>)}</details> : null}
      {state.goals.some((g) => g.status === "archived") ? <details><summary>Dřívější cíle</summary>{state.goals.filter((g) => g.status === "archived").map((g) => <p key={g.id}>{g.title}</p>)}</details> : null}
    </>}
  </div>;
}
export function CriterionReview({ criterion, evidence, busy, refreshing = false, onSave, onOpenSource }: {
  criterion: PlanningState["inputs"][number]["criteria"][number]; evidence: PlanningState["evidence"]; busy: boolean; refreshing?: boolean;
  onSave: (value: string, ids: string[], sufficient: boolean, explanation: string) => Promise<void>;
  onOpenSource: (source: JournalSource) => Promise<boolean>;
}) {
  const [value, setValue] = useState(criterion.value), [ids, setIds] = useState(criterion.insightIds);
  const [explanation, setExplanation] = useState(criterion.explanation);
  const previousSaved = useRef(criterion);
  const savedIdsKey = JSON.stringify(criterion.insightIds);
  useEffect(() => {
    const previous = previousSaved.current;
    setValue((current) => current === previous.value ? criterion.value : current);
    setExplanation((current) => current === previous.explanation ? criterion.explanation : current);
    setIds((current) => JSON.stringify(current) === JSON.stringify(previous.insightIds) ? criterion.insightIds : current);
    previousSaved.current = criterion;
  }, [criterion.value, criterion.explanation, savedIdsKey]);
  const availableIdsKey = JSON.stringify(evidence.map((e) => e.id).sort());
  const selectedIds = ids.filter((id) => evidence.some((e) => e.id === id));
  useEffect(() => { setIds((current) => current.filter((id) => evidence.some((e) => e.id === id))); }, [availableIdsKey]);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return <fieldset disabled={busy || refreshing}><legend>{criterion.requirement_text} — {refreshing ? "Ověřuji aktuální doložení…" : criterion.status === "SATISFIED" ? "Doloženo" : "Nutno doplnit / ověřit"}</legend>
    {criterion.stale ? <p role="status">Původní zdroj byl odebrán nebo změněn. Dřívější potvrzení nyní neplatí.</p> : null}
    {criterion.historicalInsightIds?.some((id) => !evidence.some((e) => e.id === id)) ? <details>
      <summary>Historické vazby na odebrané poznatky</summary>
      {criterion.historicalInsightIds.filter((id) => !evidence.some((e) => e.id === id)).map((id) => <p key={id}>Poznatek {id} — již není v aktuálních zdrojích.</p>)}
    </details> : null}
    <label>Hodnota / zjištění<textarea value={value} onChange={(e) => setValue(e.target.value)} /></label>
    <label>Co chybí nebo potřebuje vyjasnit<textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} /></label>
    <details><summary>Vybrat konkrétní doložení z aktuální situace</summary>{evidence.map((e) => <label key={e.id}>
      <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={(event) => setIds(event.target.checked ? [...selectedIds, e.id] : selectedIds.filter((id) => id !== e.id))} />
      {e.documentName}: {e.title} — {e.value} ({evidenceLabels[e.evidenceState] ?? "neurčené doložení"}){!e.usable ? " — pasáž není ověřitelná" : ""}
    </label>)}</details>
    {!refreshing && criterion.sources.map((e) => <p key={e.id}>{e.documentName}: {e.quote} <button type="button" onClick={async () => {
      const opened = await onOpenSource({ documentId: e.documentId, documentName: e.documentName, pinId: e.pinId, insightId: e.id,
        startOffset: e.startOffset, endOffset: e.endOffset, quote: e.quote });
      if (!opened && alive.current) setExplanation("Zdroj se nepodařilo otevřít. " + explanation);
    }}>Otevřít zdroj</button></p>)}
    <button type="button" onClick={() => void onSave(value, selectedIds, false, explanation)}>Uložit jako neúplné / chybějící</button>
    <button type="button" onClick={() => void onSave(value, selectedIds, true, explanation)}>Potvrdit doložení a dostatečnost</button>
  </fieldset>;
}
