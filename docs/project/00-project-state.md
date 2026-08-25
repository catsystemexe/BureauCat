# BureauCat — Project State

## Status

Canonical project-state document under D-022. GitHub `docs/project/` is the normative, versioned documentation location. Google Drive mirrors these documents for reading, sharing, and ChatGPT Project access.

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

## Implemented on the active working branch

- Prisma + SQLite baseline with replayable migrations.
- Case and Situation persistence/workspace.
- Goal persistence.
- Journal and document/evidence capabilities.
- Document Analysis / Document Insights.
- Pins/bookmarks and evidence linkage.
- Workflow persistence for:
  - `WorkflowStep`;
  - `RequiredInput`;
  - `RequiredInputCriterion`;
  - `WorkflowTask`;
  - `WorkflowOverride`;
  - append-only `WorkflowEvent`.
- Seven canonical workflow Steps initialized for Situations.
- Situation workflow read service/API.
- Case Context expanded with authoritative Goal and workflow state.
- UX shell foundation:
  - compact left Situation/workflow rail;
  - selected Goal summary;
  - Step navigation;
  - center Step workspace;
  - existing right Document/Analysis panel preserved.

Runtime verification on Replit Free confirmed the new workflow rail loads after regenerating Prisma Client and Step selection changes only UI selection, not persisted active workflow state.

## Incomplete / not yet implemented

- Full Goal Candidate Resolver and Goal confirmation workflow.
- D-014 automatic source-grounded Document Analysis → Journal projection semantics.
- Plan acceptance and Required Input orchestration end-to-end.
- Collection matching end-to-end.
- Input Validation readiness contract.
- Full Situation Controller / transition logic.
- Production and mandatory Output Review.
- Execution / completion lifecycle.
- Timeline persistence/UI.
- Final production assistant/chat interaction model.
- Automated test suite / CI.

## Important current implementation gaps

Before dependent workflow implementation, explicitly address the minimum invariant strategy for:

- one authoritative active Goal per Situation;
- one `ACTIVE` WorkflowStep per Situation;
- Situation lifecycle semantics needed for waiting/completed/superseded/blocked behavior.

Do not introduce generic workflow-engine complexity unless implementation evidence requires it.

## Current priorities

1. Complete documentation consolidation and canonical GitHub → Drive mirror workflow.
2. Continue BC-012 vertical workflow slice from the verified persistence/context/UX foundation.
3. Implement BC-013 Input Validation after the preceding workflow slice is coherent.
4. Define Timeline product/deadline model before Timeline persistence.
5. Add Production / Output Review incrementally after earlier Steps work in practice.

## Authority

For intended product direction, use this Project State together with `01-architecture.md` and active Decisions. For what currently exists, inspect the actual GitHub implementation. Historical `docs/bureaucat-mvp-v1.2.md` and older audits are not authoritative.
