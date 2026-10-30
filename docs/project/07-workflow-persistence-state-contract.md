# BureauCat — Workflow Persistence & State Contract v0.1

## Status

Approved prototype baseline. This is the detailed contract for workflow persistence/state semantics. It is intentionally minimal and is not a generic workflow-engine specification.

## 1. Core workflow model

A Situation contains one authoritative Goal and an adaptive ordered sequence of Steps.

Standard sequence:

`Analysis → Plan → Collection → Input Validation → Production → Output Review → Execution / Completion`

Work inside a Step may proceed automatically. Consequential transitions between Steps are explicit user actions.

Minimum conceptual persistence:

- Situation;
- Goal;
- Steps;
- Required Inputs;
- Required Input criteria;
- Tasks;
- user overrides;
- append-only transition/history records.

## 2. Step contract

Prototype states:

- `INACTIVE` — not current working Step;
- `ACTIVE` — current working context;
- `COMPLETED` — explicitly completed through transition/user confirmation.

Do not add `PENDING`, `REOPENED`, `SKIPPED`, or `BLOCKED` as primary Step states for the prototype.

A completed Step may become `ACTIVE` again when the user makes a workflow-relevant change in that Step. Reopening is represented in history/audit, not as a permanent enum value.

Viewing a completed Step does **not** reopen it.

## 3. Required Input contract

Required Input is a Goal-dependent information requirement, commonly represented by a document or other information source.

A file's existence alone does not satisfy an input. Each Required Input may carry acceptance criteria describing information that must be present/derivable, such as identifiers, values, dates, required statements/wording or simple freshness constraints.

States:

- `MISSING` — no usable source is available;
- `INCOMPLETE` — source exists but one or more criteria are not satisfied;
- `SATISFIED` — required criteria are satisfied.

Override is **not** a Required Input status. Progression by override leaves factual state unchanged.

## 4. Required Input criteria and Document Analysis matching

Roles remain distinct:

- Document Analysis describes what the source contains.
- Plan defines what information the Goal requires.
- Collection matches Required Input criteria against structured source-grounded analysis.

Preferred automatic path:

`document/source → Document Analysis → relevant Required Input → criteria matching → Required Input status`

If only part of the criteria is present, state becomes `INCOMPLETE` and missing criteria must be explainable.

Matching is structural/content-presence validation only, not broad legal/substantive/professional assessment.

## 5. Task contract

Tasks are small operational actions used when a Required Input or another Step-local objective needs active work.

States:

- `PENDING`;
- `ACTIVE`;
- `COMPLETED`.

No `SKIPPED` or `BLOCKED` Task state is required for the prototype unless implementation evidence later proves it necessary.

Task ≠ Required Input. Required Input defines **what must be available**; Task defines **an action used to obtain/resolve it**.

## 6. Override principle

Core invariant:

> User override changes workflow permission, not reality.

Examples:

- `MISSING` remains `MISSING` after progression is authorized;
- `INCOMPLETE` remains `INCOMPLETE`;
- Input Validation may return `READY_WITH_OVERRIDE` while underlying states remain unchanged.

Overrides must remain visible and auditable.

## 7. Situation Controller minimum contract

Controller should derive at minimum:

- `currentStep`;
- `canAdvance`;
- `nextStep`;
- `reason`;
- `blockingIssues`;
- `recommendedAction`.

It uses active Situation, authoritative Goal, current Step, accepted Plan, Required Input states/criteria, Tasks, relevant Journal/Document Analysis context and overrides.

Controller recommends/prepares transitions but must not silently make consequential user decisions.

## 8. General transition rule

A user transition normally performs atomically:

- current Step → `COMPLETED`;
- next Step → `ACTIVE`.

Do not require a separate complete action followed by a second open-next action.

## 9. Transition gates

### Analysis → Plan

Condition: enough situational understanding exists to offer Goal candidates or the user explicitly states a candidate Goal.

User gate: user selects/edits/confirms Goal; Plan becomes active.

### Plan → Collection

Condition: authoritative Goal exists and Plan defines working route + Required Inputs + relevant criteria.

User gate: user accepts Plan (e.g. `Použít tento plán`).

### Collection → Input Validation

Condition: all Required Inputs have evaluable current states (`SATISFIED / INCOMPLETE / MISSING`). Not all must be satisfied.

User gate: user proceeds to Input Validation.

### Input Validation → Production

Condition: Validation returns `READY` or explicit override produces `READY_WITH_OVERRIDE`.

User gate: user confirms progression.

### Production → Output Review

Condition: concrete output artefact exists.

User gate: user proceeds to Output Review.

### Output Review → Execution / Completion

Condition: integrity checks complete and blocking issues are repaired or explicitly accepted.

User gate: user approves output or consciously accepts unresolved issues.

### Execution → Waiting / Completion

Depends on Goal and real-world result.

User gate: user confirms real-world action/result and consequential completion/waiting/supersession.

## 10. Backward navigation and reopening

The user may inspect earlier Steps without changing workflow state.

Workflow-relevant edits to a completed upstream Step reactivate it. Downstream work is **not deleted**. History remains, but downstream results that depended on changed upstream information must no longer be treated as current until reconciled.

Use the smallest mechanism that preserves history and prevents stale output from being treated as current. Do not add extra Step enum states unless evidence requires them.

## 11. Explicit user authority

Required for:

- Goal confirmation/material change;
- Plan acceptance;
- consequential Step transition;
- Validation override;
- final output approval / conscious acceptance of unresolved review issues;
- confirmation of real-world Execution;
- completion, cancellation or supersession of Situation.

These gates should normally appear as natural workflow actions, not repetitive confirmation dialogs.

## 12. Automatic behavior allowed

BureauCat may normally perform without individual confirmation:

- document analysis / structured extraction;
- source-grounded Journal projection under D-014;
- detection of existing Required Inputs;
- matching Documents/Insights to Required Input criteria;
- Required Input state updates when evidence is clear;
- Task suggestions;
- readiness checks;
- Output Review checks;
- recommendation of next Step.

## 13. Non-goals

This contract does not define:

- generic workflow engine;
- arbitrary Step graphs;
- sub-Situations/general dependency graph;
- complex Task state machine;
- final Template model;
- detailed Production taxonomy;
- Expert/Legal Review contract;
- detailed Timeline model.

## 14. Implementation invariant notes

Foundation invariants are implemented for the bounded Goal/Plan/Collection slice under D-027:

- `Goal.status=draft` is a saved proposal; `active` plus non-null `confirmed_at` is explicit authority. A partial unique index enforces one new confirmed active Goal, while legacy rows remain unchanged until explicit selection. Readers do not pick an arbitrary legacy Goal.
- `SituationPlan` stores immutable versions, bound to Goal and evidence hash. DRAFT is not acceptance; ACCEPTED creates existing RequiredInputs/criteria with `plan_id`. Replacement supersedes previous versions without deleting their inputs or reviews.
- `Situation.workflow_revision`, source-context hashes and unique `(situation_id, request_key)` WorkflowEvents provide optimistic concurrency, stale-result rejection and idempotency. Goal confirmation/Plan acceptance and Step updates are one write transaction. They leave exactly one ACTIVE Step; GET does not repair historical anomalies.
- Criterion MISSING/SATISFIED persistence remains unchanged. A proposed or partial value can produce input INCOMPLETE while criterion remains MISSING. AI proposals never assert sufficiency. Explicit review with usable, non-conflicting sources is required for SATISFIED. Historical criterion support is fingerprinted; effective read-only coverage invalidates removed/changed sources and exposes the need to reverify.
- Manual edits remain in immutable Plan versions or criterion-review history/events; repeated automated matching does not overwrite explicit reviews. Context never depends on Journal visibility checkboxes.

Situation lifecycle semantics and consequential progression beyond Collection coverage remain later work. This MVP does not implement Collection → Input Validation or overrides.

Any deviation from this contract must be surfaced as an explicit design revision rather than silently redefining workflow semantics.


## 15. Approved Plan content and screen revision (2026-10-30)

Plan content version 2 adds stable action IDs, title, expected result, optional explanation and explicit input-ID references. Input IDs must be unique within the version, action IDs unique within their list, and references must resolve to inputs in that same version. Server rejects duplicate/unknown references; title or position is never a join key. These actions do not become WorkflowSteps and have no automatic execution. Legacy `procedure: string[]` stays readable and may retain its previous acceptance; GET neither converts nor fills missing fields. Explicit new saves require version 2. Editing a legacy Plan supplies new local IDs and blank results/links for user completion, never guessed content.

Goal proposal metadata is stored in existing WorkflowEvents with explicit Goal ID/reason/insight-ID association. Older unlinked reasons are not inferred from matching titles. This content/UI revision needs no further schema migration or user data backfill. The approved screen moves Goal/Plan to the right while retaining all consequential transition gates and one authoritative RequiredInput coverage projection. See D-027 and `08-ux-shell-direction.md`.
