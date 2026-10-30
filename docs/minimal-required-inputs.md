# Minimal K doplnění — current contract and VS handoff

Date: 2026-10-31. Branch `feat/situation-goal-plan`, existing draft PR #43. Baseline `44fb847fe25183ad81d1d64d33acdf47ff5954c6`. This supersedes earlier criterion-labelled/universal-upload/detail-rich Analysis forms; it does not change Journal or Document.

## Current behavior

- Each current version-3 RequiredInput is one information row: native checkbox, concrete stored title and inline value field. Control sentences remain criteria in the model/Plan, never field names. Multiple checks of the same information share only that information's explicit displayed value/confirmation. Different inputs have independent rows/IDs. Unequal stored values are not merged; they require explicit resolution. USER edits stay direct assertions with no fake insight/bookmark.
- Tasks are existing WorkflowTask records created only from explicitly declared accepted Plan actions. They have separate draft checkboxes, no information field. Saving an address or dimensions never completes sending. Task Save reports performed work only; it does not execute anything, prove timeliness, transition Steps or complete the Situation.
- Task deadline metadata copies an existing verified confirmed-brief value and exact source fingerprints. No arbitrary date, relative-date calculation or Timeline. Removed/changed support hides the formerly verified deadline and signals re-verification; a prior completed-task report stays historical fact rather than falsely proving compliance with the deadline.
- Version-3 inputs explicitly declare `attachmentRequired`. Only true shows an accessible paperclip; its click opens a hidden native file input. Neither the title nor a regex controls this. Existing upload/link endpoints attach to the current Situation without analysis; the item dependency remains a draft until Save and file presence never grants sufficiency.
- One Uložit atomically saves changed information and/or task checkboxes under existing revision/context/idempotency guards. Failed saves retain drafts. The form stays mounted across right tabs and revision refreshes. Editing a value clears prior confirmation and moves old insight associations to audit when saved as a direct assertion; valid source/attachment checks are never bypassed.
- Analysis no longer renders Zdroje a podrobnosti, provenance selectors, source IDs, additional questions or History. Their persisted data/validation remain. History is still available in Plan. Situace/Cíl retain their existing source navigation and explicit editing.

## Versioning and legacy data

New proposals/editor saves use Plan JSON version 3: information title, separate criteria, explicit attachment flag, unconfirmed suggested value/current insight IDs and nullable explicit task metadata on actions. Suggested AI values must exactly match selected existing stored values; different variants cannot be silently selected as a winner. Model output quality/naming is still a live-AI acceptance question, not a semantic resolver in production code.

Older string/v2 Plans and approvals are read unchanged. Legacy-client v2 writes remain compatible, but Analysis requests an explicit new-version edit instead of guessing information/task/file semantics. Editing copies the old structure without splitting it, inventing tasks or transferring confirmations; the user must explicitly add/separate information and accept the new Plan. New RequiredInput/criterion IDs and Task bindings arise only at acceptance. Old Plan JSON, criterion values/evidence and consent remain historical. No user DB was migrated or mass-repaired.

## Codex validation

Targeted regressions cover the real service/HTTP handler on disposable SQLite and actual controlled form/panel callbacks: separate address/dimensions in newly accepted v3 data; information names versus check sentences; optional paperclips; stored values without automatic sufficiency; explicit WorkflowTask creation/deadline provenance; information versus task-only Save; atomic rollback for invalid tasks; no Step/Situation completion; source removal/read-only GET; old combined Plan/consent preservation; pending refresh/tab drafts; failed Save/reload. Existing source, duplicate, hover, Journal and deletion checks remain.

| Check | Result / exit |
| --- | --- |
| Planning/minimal form/task regressions | 44 pass / 0 |
| Analysis/document references | 33 pass / 0 |
| Compact Journal | 24 pass / 0 |
| Hover/bookmarks | 12 pass / 0 |
| Situation-local deletion | 10 pass / 0 |
| Typecheck without incremental cache | pass / 0 |
| Build | pass / 0; existing NFT warning |
| Full diff check including new handoff | pass / 0 |

Initial typecheck exit 2: `planning.ts(44,5): TS2322` (legacy/new union ID narrowed to unknown) and `situationPlanning.ts(275,23): TS2322`, `(276,143)/(276,228): TS2339` (legacy input versus v3 prefill fields). Explicit type/format guards now preserve both old reads and new fields. Initial regression exit 1 targeted removed textarea/detail/universal-file controls (`TypeError: Cannot read properties of undefined (reading 'props')`, e.g. `situation-goal-plan.test.cjs:951:11`); fixtures now assert current native fields and explicit file flags. Final checks/exit codes are in the implementation response. An initial diff check also reported `SituationPlanningPanel.tsx:224: new blank line at EOF`; that formatting issue is removed. The existing NFT build warning remains. Controlled hooks/geometry and synthetic upload responses are not browser PASS.

## VS agent — pending Windows/browser/AI checks

Use disposable SQLite/synthetic documents, inspect branch/HEAD first, and avoid repository startup migration launchers against user DB. Existing API key stays in local VS runtime under REUSE EXISTING; no key/new paid request was used by Codex. Drive sync remains pending.

1. Open an old combined Plan with confirmed values. Analysis must offer explicit new-version editing, not relabel/split it or duplicate its checkbox state. Open Plan edit: old structure is copied unchanged, no inferred task/file flag. Add separate information titles, checks and explicit tasks/attachments, save a new version and accept. Compare old raw Plan/criterion/audit records; preserve old consent historically and do not transfer it to new rows.
2. On a new accepted v3 Plan verify address and dimensions are separate information fields, while “is complete” sentences remain checks in Plan only. Several validation checks for one information still give one field. Unequal values do not become an invented combined value or winner. Available selected values prefill unchecked; typing/checking alone does not persist.
3. Sending is a separate task row without a text field. Complete information and Save: sending remains unchecked. Check sending and Save (also try task-only Save): WorkflowTask changes, but Situation and ACTIVE Step do not. Inspect acceptance event's exact Task/action/Plan identity binding; no title matching/reuse of unknown legacy tasks.
4. Deadline comes only from the accepted sourced brief. Try absent/stale support and arbitrary deadline metadata: reject unsupported acceptance without partial new inputs/tasks. Remove/change the source after acceptance: no verified date remains in the task row. Its execution checkbox is not proof of on-time performance. Verify the source passage/date meaning manually; no date arithmetic/legal effect is implemented.
5. No K doplnění source/provenance/history/additional-question controls appear in Analysis; data/audit are still available through existing read APIs/Plan history. Situace/Cíl/Journal/Document navigation stays intact. Ensure no hidden source ID traps prevent direct USER correction after removal.
6. Ordinary information has no paperclip or file input. A genuinely explicit file requirement has one accessible office-paperclip button and hidden native picker. Test pointer, Space/Enter, cancel, attach and upload/link failure. Uploaded file is bound to only that information on Save, never auto-analysed or auto-confirmed. A label containing “attachment” without an explicit flag must not produce a picker.
7. Type several values, toggle information/task checkboxes, switch Document/Analysis/Plan, hold refresh pending, delete a source and finish GET. Preserve drafts/valid choices and reject stale submissions. Force Save failure and retry: no lost content or false success. Native focus/layout/compact row behavior, including narrow viewports, still require browser checks.
8. With the existing local key run an actual new Plan proposal: concrete information names, separate checks/actions, no deadline invented, file flags only from genuine requirements and stored values without confirmation. Check mixed/ambiguous/indivisible information rather than only the example. Unknown/foreign IDs stay rejected. The prior Goal-AI unknown-insight FAIL is still open; this batch makes no live-quality PASS claim.
9. Recheck references/index hover/drag, Journal visibility, removal isolation and reload. GET, navigation, field edits and picker opening do not write completion state. Real upload itself stores the file/document and Situation link; explicit item completion is separate.

No merge, deployment, Drive write, schema migration, dependency change or user DB/uploads modification by Codex.
