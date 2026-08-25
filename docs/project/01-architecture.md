# BureauCat — Architecture

## Architecture status

This document defines the current target architecture. It supersedes historical MVP v1.2 assumptions where they conflict with current Decisions. Implementation should evolve incrementally from the existing codebase rather than through a rewrite.

## Core model

```text
Case
├── Situation
│   ├── Goal
│   ├── Steps
│   │   └── Tasks
│   ├── Journal
│   ├── Documents / Evidence
│   └── Context
└── Timeline
```

### Case

Top-level administrative matter. A Case may contain a small number of bounded Situations, including more than one open Situation at the same time.

### Situation

Final bounded working episode inside a Case. The proposed `List` concept is retired. A Situation has a clear practical purpose, beginning and end.

A supporting Situation may arise while another Situation is being worked. If its result merely supplies a missing input and the original Goal survives, it is a detour. If changed conditions make the original Goal non-viable, preserve the old Situation as blocked/superseded and continue through a new Situation. Do not introduce sub-Situations or a general dependency graph for the prototype.

### Goal

Goal expresses the desired outcome of a Situation. Analysis may propose candidates, but the actual Goal is established by user decision. One confirmed Goal corresponds to one Situation for the prototype. Multiple materially distinct Goals should become multiple Situations after user confirmation/order.

Goal describes **what** should be achieved, not **when**. Deadlines belong to Timeline.

## Situation Workflow Contract v1

Standard sequence:

`Analysis → Plan → Collection → Input Validation → Production → Output Review → Execution / Completion`

This is adaptive orchestration, not a rigid state machine. A Step is an orchestration context, not a capability.

### Analysis

Interprets current input without deciding the desired outcome. It may extract source-grounded facts, claims, identifiers, risks, terms, deadlines, legal references and questions. It may propose Goal candidates as a separate non-authoritative output.

Source-grounded Document Analysis may project compact traceable findings into Journal under D-014. It may not silently overwrite or delete user-authored Journal content.

### Plan

Decision layer after Goal confirmation. Defines the working route plus Goal-dependent Required Inputs and their acceptance criteria. Required Inputs describe what information must be available; Tasks represent operational actions needed to obtain or resolve it.

### Collection

Matches Required Input criteria against available evidence, preferably reusing Document Analysis / Document Insights. Required Input state is `MISSING`, `INCOMPLETE`, or `SATISFIED`.

### Input Validation

Narrow readiness check over Analysis, authoritative Goal, accepted Plan, Required Input states and explicit overrides. Returns `READY`, `NOT_READY`, or `READY_WITH_OVERRIDE`. Override changes workflow permission, not factual input state.

### Production

Transforms authoritative Goal + accepted Plan + validated inputs + overrides into a concrete artefact. It must not silently redefine Goal or invent missing facts.

### Output Review

Mandatory pipeline-integrity check against Goal, Plan, validated inputs and source-grounded context. It is not a broad legal/professional merits review.

### Execution / Completion

Records real-world execution when applicable. The user confirms consequential real-world actions and completion/waiting/supersession outcomes.

## Persistence contract

Current persistence is Prisma + SQLite.

Existing core persistence includes Case, Situation, Goal, Document, DocumentAnnotation, DocumentPin, DocumentInsight, SituationDocument, JournalItem, ChatMessage and AISuggestion.

Workflow foundation on the active branch adds:

- `WorkflowStep`;
- `RequiredInput`;
- `RequiredInputCriterion`;
- `WorkflowTask`;
- `WorkflowOverride`;
- append-only `WorkflowEvent`.

Detailed state/transition semantics live in `07-workflow-persistence-state-contract.md`.

## Journal

Journal is the user-visible compact working model. Documents are evidence. Source-grounded analytical projection may add traceable compact Journal entries under D-014, but AI must not silently overwrite or delete authoritative user-authored Journal content.

Legacy Journal `GOAL` items are not the authoritative Goal persistence model.

## Documents and Document Analysis

Documents are evidence sources. Current capabilities include normalized text/Markdown, original access, validation state, annotations, pins/bookmarks, analysis documents and structured Document Insights.

Document Analysis describes what a source contains. Required Input criteria describe what the current Goal needs. Collection performs the Goal-dependent matching between them.

## Case Context

Case Context is a reusable assembly layer for Case/Situation context. The active branch exposes authoritative Goal plus workflow Steps, Required Inputs/criteria, Tasks and active overrides alongside Journal, Documents, pins and approved insights.

Consumers may include Situation Controller, AI capabilities, audit/briefing views, Timeline reasoning and output generation.

## Timeline

Timeline is a planned first-class Case-level temporal/process layer. It owns structured process-relevant dates, deadlines, terms and intervals.

Timeline items are Case-owned records with optional associations to Situation, Goal, Step, Task, Document or other process objects. Deadline is not an inherent property of Goal or Situation. Changed Goals or superseded Situations must not erase historical temporal records.

## Situation Controller and authority

Situation Controller is the orchestration layer that derives/recommends current Step, transition readiness, blocking issues and recommended actions from current Situation context.

BureauCat may automate low-risk analysis, extraction, matching, readiness checks, draft generation and Output Review. The user remains authoritative for consequential decisions, including Goal selection/material change, Plan acceptance, overrides, final output approval, real-world execution and Situation completion/supersession.

## UI architecture

The target UI preserves the existing three-region language:

- **Left:** narrow Situation/workflow rail with compact Situation selector, selected Goal and ordered Steps.
- **Center:** selected/active Step workspace, not a permanent chat panel.
- **Right:** contextual Document/Analysis evidence/tools surface; Timeline may become a peer tab.
- **Chat/assistant:** secondary contextual interaction surface.

Detailed shell contract is in `08-ux-shell-direction.md`.

## AI boundary

BureauCat must remain usable for core case/workflow/evidence navigation without AI. AI is an analytical assistant, not the source of truth. Structured AI output should be schema-validated.

## Technical principles

- Prefer simple TypeScript service boundaries.
- Keep API contracts explicit and validated.
- Prefer incremental evolution over broad refactors.
- Add automated tests around domain services and migrations before structural changes.
- GitHub is implementation truth for what exists.
- `docs/project/` is canonical product/project documentation for intended direction.
- Replit is runtime/Shell/manual UI verification only.
