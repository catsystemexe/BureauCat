# BureauCat — Backlog

## Rules

Statuses: `Proposed`, `Ready`, `In Progress`, `Blocked`, `Done`, `Superseded`.

Priorities: `P0` critical baseline, `P1` next product foundation, `P2` important follow-up, `P3` later improvement.

A backlog item becomes Ready only after its product decision is sufficiently clear for Coding Mode. Coding Mode marks an item Done only after implementation is preserved, appropriate verification passes, and affected documentation is current.

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
- Goal Candidate Resolver and user Goal confirmation;
- accepted Plan;
- Required Input criteria orchestration;
- Collection matching and Task creation/resolution;
- transition/controller behavior needed by the slice.

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

Designer decisions create/revise backlog items. Coding completion updates status and only the project documents affected by the change. Minor visual patches do not trigger broad documentation churn.
