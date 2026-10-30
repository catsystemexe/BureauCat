# Situation right panels — approved screen and VS handoff

Date: 2026-10-30. Branch: `feat/situation-goal-plan`, existing draft PR #43. Baseline `6699f1c55125223e418d2fc2ef68127d5fe9b19a`. This approved allocation supersedes the earlier central Goal/Plan workspaces in the first D-027 implementation.

## Result and data ownership

- Center always renders the existing Journal, with unchanged content/controls and document visibility checkboxes. `StepWorkspace` no longer renders Goal, Plan, document analysis or placeholder business surfaces. Left workflow navigation structure is unchanged; selecting a Step/tab is read-only and cannot change stored ACTIVE status.
- Right tabs are **Dokument / Analýza / Plán**. Dokument retains source text, indices, bookmarks and the existing detailed analysis component, now inside that tab. Source/detail navigation is local to Dokument; opening a different source clears an unrelated retained detail. Closing detail cancels stale reference navigation. Existing exact-passage navigation and actual manual drag behavior remain.
- One Situation planning component remains mounted across right-tab changes, including Dokument. Analysis and Plan views are hidden rather than destroyed. Scope keys reset on Case/Situation change, not tab/Step/revision. Draft Goal/Plan fields and criterion reviews remain local drafts until explicit actions. Criterion identity, refresh guards, current/historical source separation and insight-ID uniqueness from the prior repairs are retained. No duplicate center copy exists.
- Analýza orders **Řešíme → Cíl situace → Požadavky → K dispozici → Chybí / potřebuje vyjasnit**. Before confirmation the latest current proposal batch supplies short cards with Goal, reason (when reliably linked), Použít/Upravit and own wording. Použít explicitly confirms; editing never does. After confirmation one compact card and Změnit remain, and the editor closes. Older proposals/history stay collapsed. The legacy-multiple-Goal explicit-choice gate remains server-enforced.
- K dispozici lists each linked Situation document once with an open action, irrespective of Journal visibility checkboxes; atomic details stay in Dokument. Requirements and an explicit sourced deadline are separate from the Goal and do not assert absence or sufficiency. No new Goal-relevance heuristic was added. Preliminary gaps use only explicit saved questions/conflicts, never absence of an assessment. After Plan acceptance the existing effective RequiredInput projection supplies statuses/explanations; criteria without a saved assessment display Dosud nevyhodnoceno instead of treating initial MISSING as a confirmed gap. This assessment marker is read-only metadata derived from saved evidence JSON, not a new state ledger; there is no second coverage ledger. Detailed evidence review remains collapsed and uses the same persisted criteria. The bottom Navrhnout plán action needs a confirmed Goal, not satisfied inputs; manual Plan creation is available without AI.
- Plán defaults to **confirmed Goal heading → expected output → numbered actions**. New actions show title and expected result; their optional explanation and input links are expandable. Draft controls are Použít plán / Upravit; accepted control is Změnit plán. Editing fields appear only on request, and saving creates a draft requiring new acceptance. History is collapsed; normal views show no reload control, technical revisions or long operating instructions. Load-error recovery has a retry action. No action execution, new workflow Steps or Timeline are implemented.

## Version-2 Plan content and compatibility

`SituationPlan.content_json` now supports version 2:

```json
{
  "version": 2,
  "expectedOutput": "Concrete output",
  "procedure": [
    {"id": "action-uuid", "title": "Concrete action", "expectedResult": "Observable result", "explanation": "Optional context", "inputIds": ["input-uuid"]}
  ],
  "inputs": [
    {"id": "input-uuid", "title": "Required information", "description": "Context", "criteria": ["Sufficiency criterion"]}
  ]
}
```

Action IDs and input IDs are independent stored identities; changing labels/order does not change references. New manual definitions get UUIDs at explicit editing; new AI output must supply independent IDs and valid references. The server validates unique action/input IDs, unique references and membership in the same version. Unknown/other-version references fail validation. RequiredInput/criterion instantiation still happens only on acceptance, with the existing transaction/idempotency/concurrency gates. Procedure actions never create WorkflowStep records.

Legacy `procedure: string[]` loads unchanged and can retain or explicitly receive acceptance. GET does not write, generate persisted identities, add results or invent links. The read view omits missing legacy results/links without an explanatory annotation or inferred replacement. Explicit legacy editing creates local draft identities and blank results/links for completion; explicit new saves require valid version 2. Historical Plan content and old acceptance are unchanged by display alone. No new Prisma schema or migration is needed for this JSON evolution.

## Goal proposal metadata and known AI FAIL

New `PLANNING_suggestGoals` events explicitly store `{goalId, reason, insightIds}` for each created Goal, in the same transaction. The read DTO joins only by the recorded Goal ID. The current proposal batch follows monotonic workflow revision and the matching evidence snapshot. Old title-only event reasons are not attached by title/position inference; those Goals remain usable/editable through the collapsed history/Goal selector without a reason. Goal remains the sole authority store.

**Known FAIL remains open:** the user-reported real Goal AI proposal failed because its response referenced an unknown insight ID. The follow-up improves the prompt with actual allowed insight IDs and their distinct meaning, but does not claim verified provider output quality or a successful live request, nor silently drop foreign IDs. The API still returns `409: AI návrh odkazoval na neznámý poznatek.` with no draft writes; a controlled regression explicitly exercises this rejection. New ID-bound reason metadata does not fix that failure. No actual OpenAI request was made; REUSE EXISTING remains final, with the key only in VS runtime.

## Verification by Codex

| Check | Result / exit |
| --- | --- |
| `node scripts/situation-goal-plan.test.cjs` | 33 tests including parents / 0 |
| `node scripts/analysis-document-references.test.cjs` | 33 / 0 |
| `node scripts/compact-situation-journal.test.cjs` | 24 / 0 |
| `node scripts/insight-hover-bookmark-positions.test.cjs` | 12 / 0 |
| `node scripts/situation-document-removal.test.cjs` | 10 / 0 |
| `npm run typecheck -- --incremental false` | pass / 0 |
| `npm run build` | pass / 0, existing NFT warning |
| `git diff --check` including new files | pass / 0 |

New/updated regressions cover legacy read/acceptance without content writes, explicit new version save, action/input identity and invalid links, ID-bound reasons and unlinked legacy reasons, known unknown-insight rejection, read-first Plan editing and composed workspace/right-panel/Goal-Plan callbacks across tabs, with no navigation writes. Previous concurrency, Case/Situation isolation, historical source removal, stale fingerprints, duplicate insight IDs and parent-refresh draft retention remain covered. Controlled hooks/reconciliation are not React DOM or browser layout PASS.

Initial checks retained exact diagnostics: typecheck exit 2, `SituationPlanningPanel.tsx(153,103): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string'.` The legacy/new union's input-ID guard was made explicit. An initial composed fixture selected a stub by component name and failed with `TypeError: Cannot read properties of undefined (reading 'props')`; it now selects the actual workspace props and inspects actual right-panel child presence. An initial legacy read-only query-trace assertion exited 1 (`assert.ok(!queries.some((q) => /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(q)))`); the fixture now drains pending setup query notifications before starting capture and still compares saved content/status after reads. A temporary label-helper edit produced `TS7023` (typecheck exit 2) and `RangeError: Maximum call stack size exceeded` (regression exit 1); its recursive fallback was corrected to the status-label lookup. Final checks pass. Existing deletion rollback deliberately reports a foreign-key failure while its regression passes. Build retains `./next.config.ts — Encountered unexpected file in NFT list` tracing warning.

## VS agent — pending Windows/browser checks

Use a disposable SQLite DB and synthetic sources; do not migrate/write the user's DB or uploads. Existing npm startup scripts force repository SQLite and run migrations, so use bare Prisma/Next CLI with the same absolute temporary `DATABASE_URL` as in the preceding handoff. Use the existing local runtime key only; do not create/copy/log credentials.

1. Confirm branch/HEAD and tabs exactly Dokument / Analýza / Plán. Center stays the same Journal during left-Step clicks, tab changes, Goal confirmation, Plan acceptance and document-analysis navigation. Compare document checkboxes/manual notes and stored ACTIVE Step before/after navigation; GET/tab changes must not write.
2. In Analýza verify exact section order. Current Goal proposals are short cards with specific title/reason and explicit Použít/Upravit. Upravit and typing must not confirm; Použít confirms once, closes the editor and displays one compact Goal card with Změnit. Multiple legacy Goals require explicit choice; an old proposal without linked reason remains editable/confirmable without an invented reason. History stays closed initially.
3. K dispozici shows each document once and opens it; no atomic insight list. Before acceptance, explicit questions/conflicts are labelled preliminary and unevaluated knowledge is not marked missing. After acceptance verify the same effective criteria/statuses against API and Case Context. Turn Journal checkboxes off: planning context must remain all current Situation knowledge. Verify missing information is not a negative fact and conflicts retain both variants.
4. A confirmed Goal enables Navrhnout plán even with missing inputs. Inspect a real AI proposal locally: valid action/input IDs and references, concrete titles/results and no automatic acceptance. If Goal AI returns an unknown insight ID, capture the known FAIL/error without claiming it fixed; verify no draft writes. Repeat manual Goal/Plan entry with AI unavailable.
5. Plán opens in read view, with compact confirmed Goal, expected output and numbered actions. Each action's input links/explanation appear only when expanded. Before acceptance use Použít plán / Upravit; afterward Změnit plán. Explicit saved edits create a new draft and require acceptance again; no old consent silently applies to the new content. Confirm history remains and no additional WorkflowStep records were created.
6. Load a legacy string-procedure Plan with existing acceptance; compare content/status before/after GET, display, reload and tabs. Missing results/links remain absent, without the removed commentary. Start editing: new local IDs must be stable through tab changes, with blank missing result/link fields. Complete and save explicitly; inspect version 2, unique IDs and references. Tamper a request with duplicate input/action IDs, duplicate references or a foreign version's input ID: reject with no partial write.
7. Type Goal text, Plan output/action/result/criteria, and a criterion review without saving. Switch Dokument → Analýza → Plán repeatedly and use left navigation; return and verify drafts and valid selected IDs remain. Hold an evidence-refresh GET pending: forms remain mounted/disabled, old proof is not affirmed, text survives completion and invalid selections are removed. Saving one criterion must not clear another draft. Switch Case/Situation and ensure old asynchronous responses do not populate the new scope.
8. Dokument must retain its source and detailed analysis access. Test source index → exact insight, insight index → verified source passage, focus/hover, expansion, multiple same-line indices, source/detail subview toggles, selection/copy and real manual drag. A different document must not expose the previous document's retained detail as its own. Native geometry/scroll/keyboard/clipboard still require real browser evidence.
9. Repeat source removal → refresh → save without source → replacement → explicit sufficiency, duplicate AI/manual source IDs, legacy duplicate refs and two distinct insight IDs on one passage. Inspect real sibling-key warnings and source identity. Compare the effective coverage to read-only API; no bulk historical cleanup.
10. Record Windows/browser versions, viewport, commands/exit codes, screenshots, request outcomes without secrets and DB assertions. Keep BC-012/BC-015, live AI quality and browser acceptance open until verified. Existing OCR, small-viewport and upload limitations are not closed by this batch.

No new schema/migration/dependency, user DB change, automatic action execution, merge, deployment or Drive write. Changed canonical mirrors 00/01/03/04/07/08 await synchronization; document 09, README and handoffs have no mapped mirror. The previously generated local `next-env.d.ts` is preserved outside the implementation commit.


### One Situation Goal, trigger and document overview (2026-10-30)

Follow-up from `396b4861416e950aa98b0ac1bb286d27a24dfe3f`, same branch/draft PR #43: AI now receives explicit allowed insight/document IDs and Case intent context. It defaults to one citizen-side umbrella Goal; requirements and explicit deadline are separate from the trigger and Goal, with no latest-document priority or scenario-specific production rule. `suggestGoals` events save the brief alongside exact Goal-ID proposal metadata; explicit `confirmGoal` events preserve the accepted/edited brief, Case context and context hash, including edited Goals and custom Actions without documents. Old events remain readable with no inferred brief or GET writes. Changed context is marked historical; server still rejects unknown/foreign IDs, including brief references. This is minimal event-JSON extension, not a schema change or second sufficiency ledger.

Analysis orders Řešíme → Cíl situace → Požadavky → K dispozici → Chybí / potřebuje vyjasnit → Plan controls. K dispozici lists unique current Situation documents, not atomic findings. Requirements alone do not imply missing information. Accepted Plans retain the same effective RequiredInput assessment and manual sufficiency confirmation. Plan proposals receive the accepted brief and effective coverage; already evidenced data must not automatically become acquisition tasks. Legacy string procedure rows no longer show the missing-result/link commentary; saved content/acceptance and GET behavior are unchanged.

Controlled regressions cover the application/sketch/request scenario, one Goal with sourced requirements/deadline, explicit ambiguity/custom Action, unknown/foreign IDs, document-only overview and legacy Plan presentation, plus prior concurrency, duplicate/removal/refresh protections. These are controlled outputs, not evidence of real AI reasoning quality. The reported live unknown-insight FAIL remains open pending VS runtime verification despite the clearer ID contract; validation has not been weakened. Windows/browser/live-AI acceptance and Drive synchronization remain pending. See `docs/situation-right-panels.md`.


VS handoff — one Goal/trigger follow-up:

1. On a disposable local case, attach an already sent application, supporting sketch (with width/depth), and a request for postal address/dimensions by an explicit date. Use unrelated filenames/IDs; give the sketch the newest date. With the existing runtime key only, request AI: default one citizen-side response Goal, request as trigger, separate address/dimensions requirements and sourced deadline. A newer attachment must not automatically win. This live AI quality check is PENDING; deterministic replies only were used by Codex.
2. Use Upravit: change trigger description/document checkboxes; confirm explicitly. Try ambiguity and a custom Action with no document. Reload: verify accepted brief still belongs to the confirmed Goal, including after title edits. Inspect that AI proposes no official's permit-issuing action.
3. Verify exact Analysis section order. K dispozici shows each linked document once, opens its Document tab, and contains no long insight list. Existing Journal checkboxes must not restrict this context. No required dimension is labelled missing merely because the request asks for it.
4. Suggest a Plan: follows confirmed Goal/requirements, uses known sketch data or explicitly verifies it, rather than blindly reacquiring it; includes citizen-side preparation/checking/sending/evidence retention where appropriate. No automatic execution or legal deadline calculation. Verify manual planning with AI unavailable.
5. Read an old accepted Plan: original strings only, no “Výsledek a vazby…” annotation, and unchanged raw JSON/status/acceptance. Editing still needs explicit new v2 save and acceptance.
6. With read-only request inspection, compare allowedInsightIds to findings[].id; documentIds use allowedDocumentIds. The former live unknown-ID FAIL is not a claimed runtime PASS. An invalid/cross-Situation insight or trigger document must still return 409 and produce no Goal/revision/Step change.
7. Type Goal trigger/Plan/criterion drafts, change all right tabs and refresh sources; preserve typed text, prune invalid criterion choices and withhold old proof while loading. Remove a brief source: warn historical context, never silently label old support current. Recheck previous source indices/manual drag, deletion isolation and Journal behavior.

Validation for this follow-up: planning/UI regressions 33 tests (including parents), reference regressions 33, Journal 24, hover 12, deletion 10; typecheck, build and diff check. Exact final exit codes are reported in the implementation response. Existing NFT build warning remains. Initial changed-label fixture failure: exit 1, TypeError at `situation-goal-plan.test.cjs:475:108` (old AI-button label); the fixture now uses the current visible label. This was not a browser observation.
