# BureauCat — Project State

## Status

Canonical project-state document under D-022. GitHub `docs/project/` is the normative, versioned documentation location. Google Drive mirrors these documents for reading, sharing, and ChatGPT Project access.

The canonical documentation bootstrap, operating-rule consolidation and historical first manual GitHub → Drive mirror synchronization are complete. The mirror mapping/procedure is maintained in `09-drive-sync.md`. On 2026-10-27, ChatGPT synchronized the existing Drive mirrors 00–06 from snapshot `681fa5b4f1d938dff8b405edda6577e4f4b5cba0`; readback of all seven documents confirmed exact text equality, with IDs and titles preserved. This is a separate, snapshot-specific synchronization record. After this new status commit, only mirrors 00, 03 and 04 require alignment; that new alignment has not been performed, so parity with this new commit is not yet established.

## Product identity

BureauCat is a case-management and analytical application for relatively bounded administrative matters. It maintains a working model of a Case, bounded Situations, Goals / Steps / Tasks, documents/evidence, events and deadlines, while using AI as an assistant rather than authority.

## Current domain model

```text
Case
└── Situation
    ├── Goal
    └── adaptive ordered Steps
        └── Tasks
```

Alongside this workflow structure:

- Journal — user-visible working model;
- Documents / Evidence — evidentiary sources;
- Document Analysis / Insights — structured analytical layer over evidence;
- Case Context — reusable context assembly layer;
- Timeline — planned first-class Case-level temporal/process layer.

`Situation` is the final bounded working unit. The proposed `List` concept is retired.

## Situation Workflow Contract v1

Standard sequence:

`Analysis → Plan → Collection → Input Validation → Production → Output Review → Execution / Completion`

The sequence is adaptive orchestration, not a rigid state machine. Steps may be revisited or reopened; consequential transitions remain user-authoritative according to the workflow contract.

## Repository and development baseline

Repository: `catsystemexe/BureauCat`.

Preserved technical baseline: `rescue/replit-2026-08-18` at the verified rescue lineage. It must remain preserved and must not be automatically merged to `main`.

Active development branch: `work/workflow-foundation-v01`.

`main` is not assumed to represent the latest working implementation.

Local portability batch: `chore/windows-local-bootstrap`, based on verified `work/workflow-foundation-v01` at `1a2de452581104f48b87d2193465785e00f12853`. Under D-024, ChatGPT handles planning/instructions, Codex code/versioned docs/static verification, and VS agent local runtime/environment/API/UI checks. This supersedes the former Replit workflow. Subsequent explicit user authorization superseded the original push restrictions for both published commits:

- Bootstrap `07761fb8e31263b3a4b7605742d2e2ee0252ea40`: draft [PR #37](https://github.com/catsystemexe/BureauCat/pull/37), base `work/workflow-foundation-v01`.
- Workflow-initialization repair `4d9a07a002f3e1a1abdcc99a28f1c69c9cc947ad` on `fix/situation-workflow-initialization`: draft [PR #38](https://github.com/catsystemexe/BureauCat/pull/38), base `chore/windows-local-bootstrap`.

The documentation-only Windows report update was published as `681fa5b4f1d938dff8b405edda6577e4f4b5cba0` on the repair branch; the reported Windows verification covers `4d9a07a002f3e1a1abdcc99a28f1c69c9cc947ad`. BC-009 is recorded as Done for the approved portable local bootstrap scope. Final closure confirmation awaits alignment and readback of status mirrors 00, 03 and 04 from this new status commit. This does not mean BureauCat is complete: the product gaps below and all reported limits remain; BC-015 stays In Progress with the 544×234 navigation issue open. Neither PR has been merged or deployed by this work.

## Implemented on the active working branch

- Approved right-panel revision on `feat/situation-goal-plan`, baseline `6699f1c55125223e418d2fc2ef68127d5fe9b19a`: center is unchanged Journal; right tabs are Dokument (including detailed document analysis), Situation Analýza, and Plán. Goal/Plan are single, read-first right-side surfaces with explicit edit/confirmation, collapsed history and drafts preserved on tab changes. Version-2 Plan actions/input IDs and references are server-validated; legacy string procedures and acceptance remain unchanged on GET. Goal reasons/sources are explicitly joined to created Goal IDs, never titles. Preliminary questions/conflicts are distinguished from effective accepted-plan coverage, with no new relevance heuristic. See D-027 and `docs/situation-right-panels.md`. Known user-reported FAIL for Goal AI proposals containing unknown insight IDs remains open: the server rejects them, and this block does not fix the provider's output quality. Windows/browser/live-AI acceptance and Drive synchronization remain pending.
- Goal → Plan → Collection MVP on `feat/situation-goal-plan`, baseline `5595ad8fab84eec6d9040b6d4111145a471f2997`: editable AI Goal proposals remain `Goal` drafts until explicit confirmation activates PLAN. Confirmed authority is unique, legacy goals require explicit choice, and versioned draft/accepted Plans instantiate existing Required Inputs/criteria only on acceptance, atomically activating COLLECTION. Read-only coverage revalidates current Situation source passages; AI proposes evidence without declaring sufficiency, and explicit user review cannot accept selected conflict/question/claim or unverified/unresolvable evidence. Goal/Plan changes preserve historical rows and cancel old consent. Revision/snapshot guards and idempotency protect concurrent/repeated/stale commands. Case Context exposes current planning and effective coverage independently of Journal visibility checkboxes. A new additive migration is exercised only on temporary SQLite; no user data migration was run. See D-027 and `docs/situation-goal-plan.md` for checks and pending Windows/browser/live-AI acceptance. Existing OpenAI credentials remain only in VS runtime; no live/paid API call or Drive write occurred.
- Analysis ↔ Document reference follow-up on `feat/analysis-document-references`, baseline `340fc410ee3a7a8c66ff38c12c6fb1929b0527dd` from PR #41: both panels derive compact indices from the actually linked pin's stored Case number and verified passage. A SELECT-only reference endpoint diagnoses missing/bad links and duplicate numbers without allocating or repairing pins. Inline display-only indices keep same-line/same-start references individually accessible; matching hover/focus and click navigation retain source ranges rather than dragged visual positions. Detailed Analysis now derives six categories with explicit sender/recipient subgroups, supporting materials, distinct temporal roles, risks/conflicts and questions, without prompt/model changes or reanalysis. The simplified Journal and its fixes remain intact. Targeted regressions, typecheck and build pass; real Windows/browser/clipboard acceptance and Drive synchronization remain pending. No Windows data snapshot was available, so synthetic overlap is not a confirmed diagnosis of those data. See `docs/analysis-document-references.md`, its read-only audit SQL and D-026.
- Compact Situation Journal v1 on `feat/compact-situation-journal`, baseline `79ef398b1ef72af575a2ea07a74c6539ed83ca02` (draft PR #40 lineage): the existing AI analysis now retains `DocumentInsight.content`. A derived, read-only overview exposes concrete saved findings, requests, temporal meanings and unresolved variants before Goal/Plan. Stable identification and explicit shared contexts can group sources without merging records; uncertain matches remain separate. Identification/supplementary details are collapsible, manual notes retain their existing editor, and original document analyses remain available. After the 2026-10-29 human review, analytical cards show statements/variants without source or original-record menus and without replacement controls; saved originals, edits and evidence links remain intact. Native checkboxes in the existing Situation document list select any combination for Journal visibility only, initially all on; none shows a short empty state alongside manual notes. New documents start on, a single document has no checkbox and stays visible, and Situation changes/reload reset selection to all. This selection does not change application context. Document bookmarks can show contextual or all pins without changing saved offsets. PR #39 deletion isolation and PR #40 hover/drag measurement fixes are retained. Focused temporary-SQLite, pure-view and controlled component regressions, Prisma checks, typecheck and build pass; actual Windows/browser acceptance and Drive synchronization remain pending. See `docs/compact-situation-journal.md` and D-025. This is a bounded Journal improvement, not completion of BC-012/BC-015, Goal Resolver or Timeline.
- Prisma + SQLite baseline with replayable migrations.
- Case and Situation persistence/workspace.
- Goal persistence.
- Journal and document/evidence capabilities.
- Document Analysis / Document Insights.
- Pins/bookmarks and evidence linkage.
- Human-review repair on `fix/review-bookmarks-situation-ui` (baseline `3c300fde09050c741c09a47c2fc398c878a258f6`): document removal is scoped to the selected Situation and atomically removes its related Journal findings/bookmark links without distinguishing authorship or edits. Shared document-owned records needed elsewhere are preserved. Selected Situation numbers are black on light blue; unselected numbers remain dark on white, including hover/focus-visible. Static/regression verification is recorded in `docs/review-bookmarks-situation-ui.md`; browser/reload/keyboard verification by VS agent and synchronization of these new documentation changes remain pending.
- Follow-up on `fix/insight-hover-bookmark-positions`, based on `8ad5a37aad218e18ae15f30dcac5f764fab5aa87` from draft PR #39: prepared repair for bookmark clustering after insight hover. Measurements read committed pins after rendering; stale hover timers, queued scrolls and pin-fetch responses are guarded or cancelled. A deterministic component-callback regression reproduces baseline positions `0,0,0` and passes after the repair; actual browser verification remains pending. See `docs/insight-hover-bookmark-positions.md`. PR #39 is preserved; Drive synchronization of this new documentation is pending.
- Workflow persistence for:
  - `WorkflowStep`;
  - `RequiredInput`;
  - `RequiredInputCriterion`;
  - `WorkflowTask`;
  - `WorkflowOverride`;
  - append-only `WorkflowEvent`.
- Seven canonical workflow Steps initialized atomically for new Situations through both Case creation and standalone Situation creation. The shared helper uses the caller's Prisma transaction; existing Situations are not repaired on read.
- Situation workflow read service/API.
- Case Context expanded with authoritative Goal and workflow state.
- UX shell foundation:
  - compact left Situation/workflow rail;
  - selected Goal summary;
  - Step navigation;
  - center Step workspace;
  - existing right Document/Analysis panel preserved.
- Canonical project documentation under `docs/project/` with manual one-way Drive mirror workflow.

Historical Replit Free verification confirmed the workflow rail loads after regenerating Prisma Client and Step selection changes only UI selection, not persisted active workflow state. It does not establish current Windows verification or Drive mirror parity.

## Windows verification reported by VS agent

These results are taken from VS agent reports supplied for the documentation update, not from new Windows checks run by Codex:

- Lockfile-based Windows installation, Prisma Client generation and typecheck without incremental cache passed.
- Both Situation creation paths initialize seven Steps; only `ANALYSIS` is `ACTIVE`.
- Ordinary mouse selection passed at 1440×900. Keyboard activation via focus and Enter passed at 544×234, where pointer interaction was blocked by layout clipping. Neither selection changed the persisted active Step.
- Python `3.12.10` in an isolated venv outside the repository converted TXT, MD, DOCX and text-based PDF fixtures successfully.
- The actual `convertDocumentWithMarkItDown()` was verified from Node through `MARKITDOWN_PYTHON`: `ok=true`, expected marker present, `error=null`, exit `0`. The test environment setting was not persisted; normal startup must supply it to the process launching the application.

Evidence limits and open items:

- OCR is unavailable because `rapidocr_onnxruntime` is missing. Short PDFs can attempt OCR fallback and suppress its exception; this does not prove OCR works.
- Open UX issue: at `544×234`, navigation has zero height. No CSS change is included; tracked under BC-009/BC-015.
- Literal `Ctrl+C` was not verified.
- Existing Replit data was not imported.
- End-to-end document upload through the application was not tested.

## Incomplete / not yet implemented

- Full Goal Candidate Resolver/archetype orchestration beyond the bounded, explicit-confirmation MVP.
- D-014 automatic source-grounded Document Analysis → Journal projection semantics.
- Broader Required Input/task orchestration and automated validated matching beyond the MVP evidence-review coverage.
- Input Validation readiness contract.
- Full Situation Controller / transition logic.
- Production and mandatory Output Review.
- Execution / completion lifecycle.
- Timeline persistence/UI.
- Final production assistant/chat interaction model.
- Broad automated test suite / CI (a focused temporary-SQLite regression check is available via `node --test scripts/workflow-initialization.test.cjs`).
- Automated GitHub → Drive documentation synchronization (manual sync is operational; automation is intentionally deferred).

## Important current implementation gaps

The bounded Goal/Plan MVP now enforces unique confirmed active Goal authority and transactionally selects one ACTIVE Step, with revision/snapshot checks and idempotent commands. Legacy ambiguity is not resolved automatically. Situation lifecycle semantics needed for waiting/completed/superseded/blocked behavior and progression beyond Collection coverage remain later work.

Do not introduce generic workflow-engine complexity unless implementation evidence requires it.

## Current priorities

1. Continue BC-012 vertical workflow slice from the verified persistence/context/UX foundation.
2. Implement BC-013 Input Validation after the preceding workflow slice is coherent.
3. Define Timeline product/deadline model before Timeline persistence.
4. Add Production / Output Review incrementally after earlier Steps work in practice.
5. Add minimal automated tests/CI when they provide leverage without blocking product learning.

## Authority

For intended product direction, use this Project State together with `01-architecture.md` and active Decisions. For what currently exists, inspect the actual GitHub implementation. Historical `docs/bureaucat-mvp-v1.2.md` and older audits are not authoritative.


### One Situation Goal, trigger and document overview (2026-10-30)

Follow-up from `396b4861416e950aa98b0ac1bb286d27a24dfe3f`, same branch/draft PR #43: one citizen-side umbrella Goal is the AI default, with separate editable trigger, requirements and sourced explicit deadline. Analysis now lists available documents once instead of atomic insights; accepted context is preserved in existing events and Plan proposals receive it. Legacy Plans display without the missing-link commentary or stored-content changes. Controlled tests cover this contract and existing safeguards; real AI quality (including the reported unknown-insight FAIL), Windows/browser acceptance and Drive sync remain pending. See D-027 and `docs/situation-right-panels.md`.


PR #43 brief-source repair separates historical confirmation references from current editable selection. After source removal/refresh, users can clear or replace requirement/deadline references and explicitly reconfirm the Goal. Deadline text without current confirmed support is marked unverified. Event history and read-only GET are preserved; foreign IDs still fail. Controlled parent/editor/service regression covers removal, pending refresh, unsaved text, empty-source save and explicit replacement. Windows/browser verification and Drive synchronization remain pending.


PR #43 Analysis presentation now uses only Situace / Cíl / K doplnění a ověření. Stored trigger/requirements/deadline remain a compact sourced block; the repeated document list is removed without narrowing context. Accepted Plan open items are criterion-level, with SATISFIED excluded and uncertain preliminary questions collapsed. Exact duplicate questions retain all sources; different/conflicting values stay distinct. MISSING does not prove absence: current unassessed/partial/stale items conservatively display K ověření. This pure presentation creates no additional AI call or sufficiency ledger. Source repair/draft regressions remain covered; actual Windows/browser acceptance and Drive sync are pending.
