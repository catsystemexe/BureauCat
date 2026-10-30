# BureauCat — Backlog

## Rules

Statuses: `Proposed`, `Ready`, `In Progress`, `Blocked`, `Done`, `Superseded`.

Priorities: `P0` critical baseline, `P1` next product foundation, `P2` important follow-up, `P3` later improvement.

A backlog item becomes Ready only after its product decision is sufficiently clear for IMPLEMENTATION. Meaningful implementation is Done only after the change is preserved, appropriate verification passes, and affected documentation is current.

# P0 — Baseline / documentation authority

## BC-001 — Rescue baseline verification

**Status:** Done  
**Priority:** P0

Verified `rescue/replit-2026-08-18` with Prisma validation, typecheck, production build, runtime smoke and fresh migration bootstrap. Known Turbopack/NFT warning is non-blocking.

## BC-002 — Establish current documentation authority

**Status:** Done  
**Priority:** P0

Created the BureauCat Project State, Architecture, Roadmap, Backlog, Decisions, Workflow and GPT Project Instructions in Drive as the initial active project corpus.

## BC-003 — Retire MVP v1.2 authority rule

**Status:** Done  
**Priority:** P0

Repository `AGENTS.md` and `README.md` now explicitly classify `docs/bureaucat-mvp-v1.2.md` as historical/non-authoritative. Preserved on `work/workflow-foundation-v01` in commits `bd16d62` and `783d2ff`. Static compare confirmed only those two documentation files changed.

## BC-004 — Prisma migration baseline consolidation

**Status:** Done  
**Priority:** P0

Historical non-replayable migration chain replaced by `0_baseline_20260818`; working DB and fresh bootstrap verified; preserved in rescue commit `41648b5`.

## BC-005 — Canonical project docs in GitHub

**Status:** Done  
**Priority:** P0

Canonical versioned project documentation now exists under `docs/project/` as documents `00`–`08`: Project State, Architecture, Roadmap, Backlog, Decisions, Workflow, GPT Project Instructions, Workflow Persistence & State Contract, and UX Shell Direction. Bootstrap reconciled audited state drift instead of copying stale Drive state verbatim. `AGENTS.md` and README now point directly to the canonical corpus. Static compare from post-BC-003 state confirms exactly 9 added canonical files plus those 2 authority-link updates; no runtime verification required.

**Dependency:** D-022, BC-003.

## BC-006 — GitHub → Drive documentation sync

**Status:** Done  
**Priority:** P0

Established `docs/project/09-drive-sync.md` with stable mappings from canonical GitHub Markdown `00`–`08` to the existing Drive document IDs, one-way GitHub → Drive authority, conflict policy, manual sync procedure and deferred automation policy. Performed the first full manual mirror synchronization into the existing Drive documents while preserving their IDs/titles and verified key mirrors (`00`, `03`, `06`, `08`) against canonical content. No Replit Agent, paid API, CI credential or runtime verification was required.

**Dependency:** BC-005.

## BC-007 — Development workflow consolidation

**Status:** Done  
**Priority:** P0

Consolidated repository/project operating instructions around GitHub-first inspection/preservation, Replit Free runtime verification, deterministic fallback after connector failure, post-branch-switch bootstrap including Prisma generate when relevant, repository npm scripts for SQLite/env invariants, and explicit STATIC VERIFY vs RUNTIME VERIFY boundaries. Static compare from the BC-005 closeout state confirms exactly three documentation/instruction files changed: `AGENTS.md`, `docs/project/05-workflow.md`, and `docs/project/06-gpt-project-instructions.md`. No runtime verification required.

**Dependency:** Audit 2, D-021, D-022.

## BC-008 — Three-role instruction consolidation

**Status:** Done  
**Priority:** P0

Replaced the obsolete Designer/Coding two-mode terminology with D-023: DESIGNER → INSTRUCTIONS → IMPLEMENTATION, with Code mode as a separate repository process/safety overlay. Canonical Workflow/GPT Project Instructions, repo-local `AGENTS.md`, Drive mirrors and the actual GPT Project instruction field now resolve to the same role model, GitHub-first authority and conditional Replit-Free runtime workflow. Cross-source Phase 6 verification passed; no application functionality changed.

**Dependency:** D-023, D-021, D-022.

## BC-009 — Portable local development bootstrap

**Status:** Done

**Priority:** P0

Bootstrap implementation on `chore/windows-local-bootstrap`, based on verified `work/workflow-foundation-v01` at `1a2de452581104f48b87d2193465785e00f12853`, is preserved on GitHub at `07761fb8e31263b3a4b7605742d2e2ee0252ea40` in draft [PR #37](https://github.com/catsystemexe/BureauCat/pull/37). Its original no-push restriction was superseded by explicit user authorization for that exact commit/branch and draft PR:

- Changed only the two internal Replit tarball URLs to public npm URLs; package versions, integrity and dependency graph are unchanged.
- Renamed `ma:validate` to `ma-validate.log` byte-for-byte; remaining tracked paths have no Windows-invalid names or case collisions.
- Replaced POSIX environment assignments with a dependency-free Node launcher; preserved SQLite URL, CLI arguments and startup migration behavior.
- Updated operating instructions to D-024: ChatGPT planning/instructions, Codex code/versioned docs/static verification, VS agent local runtime/environment/UI verification.
- Linux static checks with Node `24.19.0` / npm `11.9.0`: clean `npm ci`, installed version inspection, Prisma validate/generate, typecheck and build all exit `0`. Actual Prisma/client `6.19.3`, Next `16.2.7`, React `19.2.7`, TypeScript `6.0.3`. Build retains one Turbopack/NFT warning about unexpected tracing through `next.config.ts` / document conversion. No product TypeScript repair was required or applied.

Follow-up repair on `fix/situation-workflow-initialization`, baseline `07761fb8e31263b3a4b7605742d2e2ee0252ea40`, is preserved at `4d9a07a002f3e1a1abdcc99a28f1c69c9cc947ad` in draft [PR #38](https://github.com/catsystemexe/BureauCat/pull/38), base `chore/windows-local-bootstrap`. Subsequent explicit authorization superseded the original local-commit-only/no-push restriction for that exact repair commit:

- Fixed the default `Situace 1` creation path in `createCase()`, which previously created no workflow Steps after the historical backfill migration.
- Both creation paths now call a shared `initializeSituationWorkflow(transaction, situationId)` helper using `WORKFLOW_STEP_DEFINITIONS` within the caller's existing transaction: exactly seven Steps, canonical keys/order, only `ANALYSIS` active.
- No read-time ensure/backfill: GET workflow remains read-only, and existing Situations, Steps and active state are preserved.
- Regression command: `node --test scripts/workflow-initialization.test.cjs`. It applies the unchanged migrations only to a temporary SQLite DB, exercises both real services and the actual GET handler, and injects a Step-insert failure to verify full rollback of both creation paths. Before the fix it reproduced the missing Steps and missing rejection in `createCase()`; after the fix all six subtests pass (seven tests including the parent).
- Linux validation with Node `24.19.0` / npm `11.9.0`: lockfile-based `npm ci`, Prisma validate/generate, typecheck and build all exit `0`; the build retains the existing Turbopack/NFT tracing warning. Initial temporary-DB setup failed with `Schema engine error` (exit `1`); explicitly creating its empty SQLite file before applying the unchanged migrations resolved test setup. Regression against the unfixed baseline exits `1` as expected; the fixed regression exits `0`. No dependency, schema, migration, UI or existing-data repair is included.

Windows results taken from the VS agent reports supplied for this documentation update (not rerun by Codex):

- Lockfile-based installation, Prisma Client generation and typecheck without incremental cache passed.
- Both Situation creation paths initialized seven Steps; only `ANALYSIS` was `ACTIVE`.
- Ordinary mouse selection passed at 1440×900. Keyboard activation via focus and Enter passed at 544×234, where pointer interaction was blocked by layout clipping. Neither selection changed the persisted active Step.
- Python `3.12.10` in an isolated venv outside the repository: TXT, MD, DOCX and text-based PDF conversion passed.
- Actual `convertDocumentWithMarkItDown()` from a Node process via `MARKITDOWN_PYTHON`: `ok=true`, expected marker present, `error=null`, exit `0`. This environment setting was temporary, not persisted for application startup.

Limits/open items: OCR is unavailable because `rapidocr_onnxruntime` is missing; short PDFs can attempt OCR fallback and suppress its exception. At `544×234`, navigation has zero height (open UX issue, also recorded under BC-015; no CSS fix). Literal `Ctrl+C` was not verified. Existing Replit data was not imported. End-to-end document upload through the application was not tested.

Documentation publication and synchronization record — **2026-10-27**: Windows results for `4d9a07a002f3e1a1abdcc99a28f1c69c9cc947ad` were published in documentation commit `681fa5b4f1d938dff8b405edda6577e4f4b5cba0`. ChatGPT synchronized the existing Drive mirrors 00–06 from that documentation snapshot. Readback of all seven confirmed exact text equality, with IDs and titles preserved. This completed event supersedes the earlier pending-sync status; the historical first synchronization is retained as a separate event.

Done applies only to the approved portable local bootstrap scope. Final closure confirmation awaits alignment and readback of status mirrors 00, 03 and 04 from this new status commit; that alignment has not been performed. This is not completion of the application or BC-015: the 544×234 navigation issue remains under BC-015, which stays In Progress, and all evidence limits above remain recorded. No merge or deployment was performed. Prior BC-007/BC-008 closeouts are historical; D-024 supersedes their Replit execution allocation.

**Dependency:** D-024; runtime handoff must preserve the existing database and stop if migration/schema changes would be required.

# P1 — Situation workflow

## BC-010 — Situation domain model

**Status:** Done  
**Priority:** P1

Situation retained as final bounded working unit; List retired. Target: Situation contains Goal + adaptive ordered Steps; Steps contain operational Tasks. See D-011.

## BC-011 — Situation Workflow Contract v1

**Status:** Done  
**Priority:** P1

Approved standard sequence: `Analysis → Plan → Collection → Input Validation → Production → Output Review → Execution/Completion`. Adaptive orchestration, not rigid state machine. See D-013 and `07-workflow-persistence-state-contract.md`.

## BC-012 — Situation workflow vertical slice

**Status:** In Progress  
**Priority:** P1

Implemented foundation on `work/workflow-foundation-v01`:

- workflow persistence (`WorkflowStep`, Required Inputs/criteria, Tasks, Overrides, Events);
- seven-Step initialization/backfill;
- workflow read service/API;
- Case Context authoritative Goal + workflow exposure;
- first UX workflow shell.

Still required for the slice:

- D-014 automatic source-grounded Journal projection;
- Goal archetype/resolver extensions beyond the bounded MVP;
- broader Required Input orchestration and Task creation/resolution;
- transition/controller behavior needed by the slice.

Bounded Journal follow-up on `feat/compact-situation-journal`, baseline `79ef398b1ef72af575a2ea07a74c6539ed83ca02`: retain existing AI `content` on creation and derive a concrete Situation overview before Goal/Plan, with conservative source-preserving grouping, distinct temporal meanings, unresolved value variants, preserved original/user-edited records and editable manual notes. No new AI calls, read-time writes, data backfill or workflow transitions. Focused regressions and static checks pass; Windows/browser acceptance is pending. This advances D-014 presentation/content preservation without claiming the full projection semantics or BC-012 complete. See D-025 and `docs/compact-situation-journal.md`.

Goal/Plan follow-up (2026-10-30), `feat/situation-goal-plan`, baseline `5595ad8fab84eec6d9040b6d4111145a471f2997`: implemented saved editable Goal proposals/manual confirmation, legacy-choice handling, unique confirmed authority, immutable Plan versions and explicit acceptance, current RequiredInput/criterion coverage with concrete evidence review, stale-source invalidation, idempotency and transactional Step transitions. AI reuses existing configuration; core manual entry works without it. Temporary-SQLite migration/concurrency/rollback, controlled API/component regressions and static checks are documented in `docs/situation-goal-plan.md`. Actual Windows/browser and live-AI verification remain pending; no credential was copied or live call made. BC-012/BC-015 remain In Progress; this block ends at Collection coverage, with no Input Validation, Production, execution, override or Timeline. Affected Drive mirrors remain pending.

Right-panel follow-up (2026-10-30), baseline `6699f1c55125223e418d2fc2ef68127d5fe9b19a`: approved screen keeps Journal centered and moves single Situation Analysis/Plan views to the right beside Document/detail analysis. Read-first cards, explicit gates, version-2 action/input identities and validated references, legacy read compatibility and tab-preserved drafts are implemented. No second coverage ledger or relevance inference; previous source/refresh/duplicate-ID repairs remain. Known user-reported Goal AI FAIL for unknown insight IDs remains open; rejection is tested, not claimed fixed. See `docs/situation-right-panels.md`; Windows/browser/live-AI and Drive sync remain pending. BC-012/BC-015 are not Done.

## BC-013 — Input Validation readiness slice

**Status:** Ready  
**Priority:** P1

Implement `READY / NOT_READY / READY_WITH_OVERRIDE` over Analysis, authoritative Goal, accepted Plan, Required Input states and explicit overrides. Do not repeat Collection matching or perform broad merits assessment.

**Dependency:** BC-012 and workflow persistence contract.

## BC-014 — Production and Output Review slice

**Status:** Proposed  
**Priority:** P1

Implement minimum Production → mandatory Output Review without prematurely defining a universal Template system. Production consumes authoritative Goal, accepted Plan, validated inputs and overrides; Output Review checks pipeline integrity. Optional Expert/Legal Review remains separate and on-demand.

**Dependency:** BC-013.

## BC-015 — UX shell foundation

**Status:** In Progress  
**Priority:** P1

Implemented compact left Situation/workflow rail, Goal summary, seven-Step navigation and center Step workspace while preserving the right Document/Analysis panel. Replit Free runtime now loads the workflow after regenerating Prisma Client; desktop manual verification confirms Step switching works and does not change the persisted active Step. Remaining UX acceptance includes broader device/responsive validation and later Step-specific working surfaces.

VS agent reports supplied with the BC-009 update: Ordinary mouse selection passed at 1440×900. Keyboard activation via focus and Enter passed at 544×234, where pointer interaction was blocked by layout clipping. Neither selection changed the persisted active Step. Open UX issue: navigation has zero height at viewport `544×234`. No CSS repair is included in the documentation update.

Human-review follow-up on `fix/review-bookmarks-situation-ui`, baseline `3c300fde09050c741c09a47c2fc398c878a258f6`: the document delete action now removes the document and all related findings/bookmark links from the selected Situation in one transaction, preserves other Situations and unrelated content, and refreshes the UI after success. The Situation selector uses black on light blue for selection and dark on white otherwise, with hover/focus-visible preserved. Targeted isolated-SQLite regressions, Prisma checks, typecheck and build pass; see `docs/review-bookmarks-situation-ui.md` for evidence and VS agent handoff. Actual browser/reload/isolation/keyboard verification and Drive synchronization of these new documentation changes are pending. BC-015 remains In Progress; this repair does not resolve the previously reported `544×234` navigation clipping.

Insight-hover follow-up on `fix/insight-hover-bookmark-positions`, baseline `8ad5a37aad218e18ae15f30dcac5f764fab5aa87` (draft PR #39 preserved): prepared fix for stale pin measurements and uncancelled 280 ms source-scroll timers. The regression executes the actual component callbacks with controlled hooks, clocks and geometry: nine subtests pass, while the baseline reproduces clustering at `0,0,0`. Typecheck/build pass; this does not establish real browser layout. VS agent must verify multiple expanded insights, repeated hover/leave, smooth scrolling, document switching, pin refresh and drag with unchanged stored offsets outside actual drag. See `docs/insight-hover-bookmark-positions.md`; browser acceptance and Drive synchronization of these new documentation changes remain pending. BC-015 stays In Progress.

Compact Journal v1 retains collapsible identification/parameters, unresolved value variants and contextual/all document bookmark controls. The 2026-10-29 human review removes analytical-card source/original-record menus without replacement buttons/icons and replaces the document dropdown with independent native checkboxes in the existing Situation document list. Any combination filters only the Journal view and its relevant sources/variants; none retains manual notes plus an empty state. All documents start on, new documents start on, a single document stays visible without a checkbox, and Situation changes/reload reset selection. Saved originals, user edits and source links are preserved; manual-note controls are unchanged. PR #39/#40 behavior is retained and covered by the extended regressions; real browser layout, keyboard/source navigation, reload/isolation and hover/drag acceptance are pending with VS agent. See `docs/compact-situation-journal.md`. BC-015 remains In Progress, including the existing `544×234` navigation issue; Drive synchronization of these changes is pending.

Analysis/reference follow-up under BC-015 on `feat/analysis-document-references` (baseline `340fc410ee3a7a8c66ff38c12c6fb1929b0527dd`): compact matching indices in Analysis/Document now derive from verified stored pin numbers/ranges, with distinct diagnostics for link/number defects versus overlap/shared sources. Six derived Analysis categories separate roles, attachments, temporal meanings and actual risks without reanalysis or schema/prompt changes. Original Journal, hover/drag and Situation deletion regressions pass alongside new reference/clipboard-model tests, typecheck and build. A concrete Windows/browser handoff and SELECT-only link audit are in `docs/analysis-document-references.md`; no Windows snapshot was available to confirm that data's reported cause. Browser layout/clipboard acceptance and Drive sync remain pending; BC-015 stays In Progress.

# P1 — Timeline

## BC-020 — Timeline product model

**Status:** Ready for Designer  
**Priority:** P1

Define Case-level event semantics, ordering, event types, associations and interaction with Journal/Documents.

## BC-021 — Deadline / term model

**Status:** Ready for Designer  
**Priority:** P1

Define dates/deadlines/terms, evidence, status, urgency and visual priority. Deadline is not an inherent Goal/Situation field.

## BC-022 — Timeline persistence

**Status:** Blocked  
**Priority:** P1

Prisma/service/API foundation for approved Timeline model.

**Dependency:** BC-020, BC-021.

## BC-023 — Timeline UI foundation

**Status:** Blocked  
**Priority:** P1

Case-level Timeline view with optional Situation/Goal/Step/Task/Document associations and deadline/time-interval anchors.

**Dependency:** BC-022.

# P1 — Context and AI

## BC-030 — Canonical Case Context contract

**Status:** Proposed  
**Priority:** P1

Stabilize whole-Case and Situation-scoped context contracts and separate persistence shape from compact AI-facing context. Current implementation already exposes authoritative Goal and workflow state.

## BC-031 — Production chat AI adapter

**Status:** Blocked  
**Priority:** P1

Replace deterministic mock with production provider integration only after canonical context/orchestration contract is stable.

**Dependency:** BC-030.

## BC-032 — Insight promotion rules

**Status:** Proposed  
**Priority:** P1

Complete promotion rules beyond D-014: temporal findings → Timeline, non-source-grounded AI findings, and analysis-only outputs.

# P2 — Engineering hardening

## BC-040 — Minimal automated tests

**Status:** Proposed  
**Priority:** P2

Domain service, migration and API smoke tests for workflow, Journal, evidence, Timeline and context assembly.

## BC-041 — Repository hygiene cleanup

**Status:** Proposed  
**Priority:** P2

Remove/archive backup and runtime artifacts only after preservation is verified.

## BC-042 — Workspace component decomposition

**Status:** Proposed  
**Priority:** P2

Reduce oversized workspace/Journal/document component responsibilities after domain stabilization.

## BC-043 — Shared API contracts and validation

**Status:** Proposed  
**Priority:** P2

Reduce handwritten response typing and inconsistent validation.

## Maintenance rule

Designer decisions create or revise backlog items. IMPLEMENTATION completion updates status and only the project documents affected by the change. Minor visual patches do not trigger broad documentation churn.


### One Situation Goal, trigger and document overview (2026-10-30)

BC-012/BC-015 remain In Progress. PR #43 now separates case intent, editable Situation trigger, one default umbrella Goal, requirements and explicit deadline; available documents replace atomic-insight lists. Existing RequiredInput sufficiency remains authoritative after acceptance. Controlled AI/service/UI regressions pass; live proposal quality, the prior unknown-ID FAIL, Windows/browser checks and affected Drive mirrors remain open. Concrete acceptance scenarios: `docs/situation-right-panels.md`.
