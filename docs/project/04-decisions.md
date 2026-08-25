# BureauCat — Decisions

## Decision log rule

Record only decisions that materially affect product architecture, workflow, information ownership, or development operating rules. When a decision is replaced, keep it and mark it **Superseded**.

## D-001 — GitHub / Replit / Drive roles

**Status:** Superseded by D-022 for documentation ownership; runtime/implementation role remains active.

GitHub is implementation source of truth. Replit is runtime/manual verification. Historically Drive was project-documentation authority; D-022 changes canonical documentation ownership to GitHub.

## D-002 — Rescue branch preservation

**Status:** Active

`rescue/replit-2026-08-18` preserves the verified Replit baseline and must not be discarded or automatically merged to main.

## D-003 — MVP v1.2 is historical

**Status:** Active

`docs/bureaucat-mvp-v1.2.md` and older repository audits are historical references. They do not override current Project State, Architecture or later Decisions.

## D-004 — Do not rewrite BureauCat from scratch

**Status:** Active

Existing Case, Situation, Journal, Documents, pins/bookmarks, Document Insights and Case Context form a useful foundation. Evolve incrementally.

## D-005 — Situation is predecessor of List

**Status:** Superseded by D-011

The proposed List migration was rejected. Situation remains the final bounded working unit.

## D-006 — Timeline becomes first-class

**Status:** Active

Timeline is part of the target product direction and works across the Case while preserving Situation context.

## D-007 — Deadlines are Timeline anchors

**Status:** Active

Deadlines, terms and relevant intervals must be modeled explicitly in Timeline rather than inferred only from free text.

## D-008 — Journal and Documents retain distinct roles

**Status:** Superseded by D-014 in the source-grounded projection detail

Journal is the user-visible working model; Documents are evidence. The broader distinction remains active.

## D-009 — Case Context is a strategic backend abstraction

**Status:** Provisional

Case Context is a strong candidate for canonical context assembly used by AI, audit, briefing, workflow and Timeline reasoning. Formal contract review remains pending.

## D-010 — Two primary work modes

**Status:** Active

Use Designer Mode for product/UX/architecture decisions and Coding Mode for implementation/debugging/testing. Designer may inspect code read-only; Coding starts from actual repository state.

## D-011 — Situation is the bounded working unit

**Status:** Active

Situation is the final bounded working unit inside Case; List is retired. A Situation is one concrete working episode with a clear purpose, beginning and end. Multiple Situations may be open. Supporting Situations may resolve bounded missing inputs. Non-viable Goals lead to preservation/supersession rather than silent history rewrite. No sub-Situation tree or generic dependency graph for the prototype.

## D-012 — Timeline owns temporal semantics

**Status:** Active

Process-relevant dates, deadlines, terms and intervals are canonically represented in Case Timeline. Situation, Goal, Step, Task or Document may be associated with Timeline items but do not inherently own deadlines. Temporal history survives Goal/Situation changes.

## D-013 — Situation Workflow Contract v1

**Status:** Active

Standard adaptive sequence:

`Analysis → Plan → Collection → Input Validation → Production → Output Review → Execution / Completion`

Step is an orchestration context, not a capability. AI may automate low-risk analytical/production work, but the user remains authoritative for consequential Goal, override, approval, execution and completion decisions.

## D-014 — Source-grounded document analysis may auto-project to Journal

**Status:** Active

Document remains evidence. Document Analysis is a visible structured extraction layer. Source-grounded key findings may be projected automatically into compact Journal entries without per-insight approval when they remain traceable and user-correctable. Reliable bookmarks should be attached where possible; failure to resolve a precise range must not itself block projection. AI may not silently overwrite/delete user-authored Journal content. Goal candidates remain non-authoritative until confirmed.

## D-015 — Goal Candidate Resolver and Explain boundary

**Status:** Active

Analysis may generate a small set of context-specific bounded Goal candidates from source-derived signals + a small internal Goal-archetype catalog + LLM reasoning. The user may select/edit/define Goal(s). One confirmed Goal corresponds to one Situation. Multiple selected Goals become an ordered sequence of Situations after user confirmation. Explain is Contextual Assistance, not Goal/Step/Task.

## D-016 — Input Validation is a readiness check

**Status:** Active

Input Validation compares Analysis, authoritative Goal, accepted Plan, Required Input states and overrides. It returns `READY`, `NOT_READY`, or `READY_WITH_OVERRIDE`. It is not broad legal/substantive/professional review. Override changes workflow permission, not factual input state.

## D-017 — Output Review and optional Expert Review

**Status:** Active

Output Review is a mandatory pipeline-integrity Step checking produced output against Goal, Plan, validated inputs and source-grounded context. Separate Expert/Legal Review is optional/on-demand and outside the default workflow.

## D-018 — Required Input carries content criteria

**Status:** Active

Required Input is a Goal-dependent information requirement, not merely file presence. Plan defines required information/criteria; Collection matches those criteria against source-grounded analysis. Result is missing/incomplete/satisfied. Matching is structural/content-presence validation, not broader merits assessment.

## D-019 — Workflow Persistence & State Contract v0.1

**Status:** Active

Detailed contract is `07-workflow-persistence-state-contract.md`.

Prototype states:

- Step: `INACTIVE / ACTIVE / COMPLETED`;
- Required Input: `MISSING / INCOMPLETE / SATISFIED`;
- Task: `PENDING / ACTIVE / COMPLETED`.

Reopen/skipped/blocked are not primary current-state enums. Overrides are separate from factual state. Consequential Step transitions are explicit user actions. Backward inspection does not reopen a Step; workflow-relevant upstream edits may reactivate it while preserving downstream history.

## D-020 — UX shell centers Situation workflow

**Status:** Active

Keep three-region visual language. Left becomes narrow Situation/workflow rail; center becomes selected/active Step workspace; right remains contextual Document/Analysis tools with Timeline planned as peer; chat becomes secondary contextual interaction. Detailed shell contract is `08-ux-shell-direction.md`.

## D-021 — Replit Free-tier operating constraint

**Status:** Active

Development and verification must remain operable with zero Replit Agent credits. GitHub is primary for inspection/diffs/branch state/preservation. Replit Free is runtime/Shell/manual UI verification for evidence GitHub cannot provide. Agent/connector is optional only. Prefer targeted diagnostics over exploratory retry loops.

## D-022 — GitHub is canonical project documentation

**Status:** Active

GitHub `docs/project/` is the canonical, versioned location for normative BureauCat project documentation as well as the implementation repository. Google Drive remains a synchronized human-readable/project-source mirror and may also contain non-canonical audits/working material.

Synchronization of normative documents is one-way by default: **GitHub canonical → Drive mirror**. Drive-only edits to mirrored normative documents are uncommitted working changes until intentionally promoted into GitHub. Initial synchronization is manual/operator-triggered; automation is deferred until the contract is stable.

Implementation remains source of truth for **what exists**; canonical project documents define **intended product direction**. Material mismatch must be surfaced rather than silently resolved.
