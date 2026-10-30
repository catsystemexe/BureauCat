# K doplnění — implementation and VS handoff

Branch `feat/situation-goal-plan`, existing draft PR #43. Baseline `337c9ee2b84345cd62497327eb407e1311b0b7ea`. This approved revision supersedes the separate open-criteria list and assessment form. Situace, Cíl, Journal, Document and Plan structure stay unchanged.

## Behavior and persistence

- One form shows every criterion of the accepted Plan exactly once. Each row has its own checkbox, exact information name, inline field and Přiložit soubor. Old combined requirements are preserved verbatim. Confirmed rows stay checked/compact and reopen via Upravit. Sources, attachment bindings and technical details are expandable; additional questions and history remain closed initially.
- Text, source changes and checkboxes are drafts until the single Uložit. Editing a value/explanation/dependency clears draft confirmation. One guarded `reviewInputs` request commits changed rows atomically; double clicks/retries do not duplicate effects. A failed request preserves all text/checkboxes and does not show success. Forms remain mounted across tabs and revision refreshes; foreign scopes/old Plans cannot receive stale responses.
- Direct values use origin USER, visibly Zadal uživatel. Explicit sufficiency can be saved without insight IDs, with a fingerprint of the confirmed value. Origin can also be explicitly selected in the source/detail disclosure when adopting an existing value as a user statement; that change requires a new checkbox confirmation. This never creates a fake insight/bookmark or represents the statement as document-verified. DOCUMENT-origin review still requires real usable sources. Supplied insight IDs retain membership, exact-passage, fingerprint and conflict safeguards, even when origin is USER. AI never confirms a row or overwrites an explicit review.
- Přiložit soubor uses the existing Case upload followed by current-Situation link endpoints, without an analysis call. Row association is an explicit pending document ID, persisted only by Uložit. Upload alone never checks/confirms a row. Conversion/extraction is the existing upload behavior. A failed link leaves no criterion association; it does not silently delete the already uploaded Case file. Retrying a failed upload/link may require choosing the file again.
- Existing criterion evidence JSON stores origin, confirmed value hash, document identities/fingerprints and historical document IDs alongside existing insight references. Legacy JSON remains readable; no backfill/schema/migration/dependency is needed. Removing/changing a bound source invalidates effective confirmation on GET without writes; explicit replacement or source-free USER reconfirmation preserves old references in history. Unrelated upload does not revoke an independent manual assertion.
- RequiredInput/criteria remain the only status store. Case Context uses the same effective projection and includes origin/attachment information. Explicit saves aggregate effective coverage, not stale raw SATISFIED flags. No workflow transition is performed by completion Save.
- New Plan proposals request separately fillable information when actually separable (e.g. address, width, depth). No lexical production split is added. Existing compound criteria only split through explicit new-version Plan editing followed by new acceptance; old content/inputs/reviews stay historical. Actual AI proposal quality is pending VS verification.

## Codex checks

The focused suite exercises the real service/HTTP handler on migrated disposable SQLite and controlled component callbacks: USER-without-insight/reload, no fabricated sources, explicit attachments without automatic sufficiency, Case Context provenance, stale-source invalidation/read-only GET, scope rejection, strict document-source validation, concurrent Save, retries, full rollback, explicit new-Plan criteria/consent, compact editing, save errors, source siblings and parent/child refresh/tab draft retention. Upload requests are controlled stubs, not real upload/browser PASS.


| Check | Result / exit |
| --- | --- |
| Planning/form/service regressions | 41 pass / 0 |
| Analysis/document references | 33 pass / 0 |
| Compact Journal | 24 pass / 0 |
| Hover/bookmarks | 12 pass / 0 |
| Situation-local deletion | 10 pass / 0 |
| Typecheck without incremental cache | pass / 0 |
| Build | pass / 0; existing NFT warning |
| Full staged diff check, including new files | pass / 0 |

Initial static diagnosis: typecheck exit 2, `situationPlanning.ts(272,104): error TS2769: No overload matches this call` (unknown documentIds) and `(278,40): error TS2322: Type 'unknown' is not assignable to type '"USER" | "DOCUMENT" | undefined'`. Command changes are now normalized to explicit `InputReview[]`. Initial regression exit 1 reflected fixtures for removed CriterionReview/old headings (`AssertionError` and `TypeError: ... undefined ... props`); they were replaced by actual single-form parent/child tests rather than retaining obsolete production UI. Final results/exit codes are recorded in the task response. Existing NFT build warning remains.

## VS agent — pending Windows/browser checks

Use disposable local SQLite and synthetic files; do not run migration/start launchers against user DB. Reuse the existing runtime key only for the explicitly separate live-AI scenario; no new key/copy is needed. No real API call was made by Codex. Drive synchronization remains pending.

1. Verify one K doplnění form, one Uložit, no K ověření headings or second assessment panel. Check every accepted criterion appears once, including confirmed rows. Additional questions/history start collapsed. Compound legacy address-and-dimensions criterion stays one row.
2. With no documents/insights, type an address. Before checkbox/Save it must not become SATISFIED. Check its checkbox, Save, reload: checked compact row with exact value and Zadal uživatel. Verify no insight/pin was created and Case Context reports USER origin, not document verification.
3. Reopen a confirmed row, edit its value: checkbox clears. Save unconfirmed value and reload; it stays unconfirmed. Check again and Save: only then does it compact/confirm. Try checkbox before typing, typing after checking, unchecking and reverting; no earlier consent should silently cover changed content.
4. Attach a synthetic TXT/PDF/DOCX to one row using the native picker. Verify existing upload + Situation-link requests, no automatic analysis, no checked state and no criterion association before Save. Save an unchecked row with attachment, reload and inspect explicit row binding; mere file presence must not satisfy it. Add the value and explicitly confirm: USER label remains truthful. Check upload/conversion failures, link failure, cancel and repeated file choice; no fake success/hidden association.
5. Remove or edit the attached source through existing Document/Journal controls. Refresh must withhold old proof, preserve typed drafts, remove invalid choices and invalidate only dependent confirmation. Source-independent manual rows remain confirmed. Save without source or select replacement and reconfirm; history retains old values/refs. A foreign/unknown insight or document ID and an unusable/conflicting selected insight must fail even for USER origin.
6. Type in several rows and switch Dokument/Analýza/Plán repeatedly. Hold refresh GET pending, remove a source, finish GET, then Save. Preserve text/explanation/valid selections and avoid a revision-key remount. Switch Case/Situation or replace Plan during upload/Save; old responses must not populate the new scope.
7. Force a save/network error: keep every typed value and checked draft, show no Uloženo/false compact confirmation, and allow retry. Double-click Save and send concurrent requests: one atomic consistent outcome, stale request rejected. In a disposable DB simulate second-row failure and verify first row/revision/history rollback.
8. Explicitly edit a new Plan version to split a compound criterion, Save and accept it. Before acceptance no new current inputs; afterward only new criteria are fillable and none inherit old consent. Old Plan JSON, inputs and history remain intact. With the existing local AI key test a real new proposal for separable versus indivisible information; no paid test was run by Codex and the prior Goal unknown-insight FAIL remains open.
9. Recheck keyboard labels/focus/native checkbox/file control, compact rows, small viewport, source navigation/index hover/drag, Journal visibility and deletion isolation. UI geometry/native upload/conversion are not covered by controlled tests. GET, navigation, row expansion and local edits never write statuses; only explicit Save does.

No merge, deployment, Drive write, bulk data repair or user DB/uploads modification by Codex.
