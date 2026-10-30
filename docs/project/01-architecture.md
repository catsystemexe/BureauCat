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

The bounded MVP stores proposals in existing `Goal` rows (`draft`) and explicit authority through `confirmed_at` plus `active`. Legacy active rows without confirmation are not authoritative; multiple legacy choices require explicit selection. A partial unique database index covers newly confirmed active authority without rewriting legacy data. Material changes create a new Goal and archive the old one, preserving its Plans.

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

`SituationPlan` stores immutable content versions bound to Goal, revision and evidence snapshot, with `DRAFT / ACCEPTED / SUPERSEDED`. Content contains expected output, procedure and information requirements/criteria; procedure items are not new Steps. Explicit acceptance instantiates existing RequiredInput/RequiredInputCriterion rows for that version and activates Collection. Goal/Plan replacement preserves history and revokes previous consent. See D-027.

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

Compact Journal v1 is a derived Situation-local view under D-025, available without an established Goal or Plan. Grouping and document filtering change presentation only; original records, user edits, variants and concrete evidence links are retained. Analytical cards expose statements without source/edit menus; manual-note controls remain available. Native multi-document visibility checkboxes live in the existing Situation document list and do not select/unlink documents or change AI/workflow context. Existing saved content/passages support older records without reanalysis. Explicit editing is separate from read-only projection; document issue dates are not inferred risks. This view does not introduce Timeline persistence or workflow transitions.

Legacy Journal `GOAL` items are not the authoritative Goal persistence model.

## Documents and Document Analysis

Documents are evidence sources. Current capabilities include normalized text/Markdown, original access, validation state, annotations, pins/bookmarks, analysis documents and structured Document Insights.

Document Analysis describes what a source contains. Required Input criteria describe what the current Goal needs. Collection performs the Goal-dependent matching between them.

Under D-026, Analysis/Document indices use the same actually attached `DocumentPin.case_bookmark_number` and a verified source document/quote/range. Link errors, duplicate Case numbers, geometric overlap and legitimate shared passages are separate diagnoses; no read/view action repairs or renumbers stored pins. Display-only indices must preserve source text, offsets, selection, annotations and clipboard content. Detailed Analysis categories are a bounded derived view of existing findings: identification with explicit roles, key facts, supporting materials/attachments, dates/deadlines/events, risks/conflicts and questions. This changes neither the persistence model/prompt nor the simplified Journal's controls. Actual browser/clipboard acceptance remains separate from controlled component regressions.

## Case Context

Case Context is a reusable assembly layer for Case/Situation context. The active branch exposes authoritative Goal plus workflow Steps, Required Inputs/criteria, Tasks and active overrides alongside Journal, Documents, pins and approved insights.

Consumers may include Situation Controller, AI capabilities, audit/briefing views, Timeline reasoning and output generation.

Current MVP coverage uses all current Situation findings and Journal knowledge, independent of visibility checkboxes. AI provides schema-validated evidence proposals through the existing Responses API/configuration; it does not grant sufficiency. Explicit review records value, source snapshots and explanation; uncertain/conflicting selected evidence cannot become SATISFIED. Effective GET coverage revalidates source membership, quote/range and fingerprint without writes, so removed/changed sources invalidate prior support. Workflow and Case Context expose this current coverage, while older plan-bound input rows remain historical. This is structural evidence review, not a semantic or legal resolver.

## Timeline

Timeline is a planned first-class Case-level temporal/process layer. It owns structured process-relevant dates, deadlines, terms and intervals.

Timeline items are Case-owned records with optional associations to Situation, Goal, Step, Task, Document or other process objects. Deadline is not an inherent property of Goal or Situation. Changed Goals or superseded Situations must not erase historical temporal records.

## Situation Controller and authority

Situation Controller is the orchestration layer that derives/recommends current Step, transition readiness, blocking issues and recommended actions from current Situation context.

BureauCat may automate low-risk analysis, extraction, matching, readiness checks, draft generation and Output Review. The user remains authoritative for consequential decisions, including Goal selection/material change, Plan acceptance, overrides, final output approval, real-world execution and Situation completion/supersession.

## UI architecture

The target UI preserves the existing three-region language:

- **Left:** narrow Situation/workflow rail with compact Situation selector, selected Goal and ordered Steps.
- **Center:** the existing Situation Journal, with its content and controls unchanged.
- **Right:** Document (including detailed document analysis and linked source indices), Situation Analysis, and Plan. This approved 2026-10-30 allocation supersedes the former central Goal/Plan workspaces; no duplicate forms or new Timeline are introduced.
- **Chat/assistant:** secondary contextual interaction surface.

Situation Analysis displays Goal, available stored knowledge, then gaps/questions. Before an accepted Plan, gaps are explicitly preliminary; unassessed information is not classified as missing. After acceptance the same effective RequiredInput coverage is used, without another state ledger or relevance heuristic. Plan is read-first: confirmed Goal, expected output, numbered actions with expected results and expandable per-action input links. Edits and histories are hidden until requested; tab navigation is read-only and does not discard drafts.

New Plan content uses version 2 with independent action/input IDs and validated references local to that version. Old string procedures remain readable/acceptable unchanged; missing results/links are not guessed or filled on GET. Goal proposal events explicitly associate created Goal IDs, reasons and insight IDs; legacy title-only reasons are not attached by inference. Detailed shell contract is in `08-ux-shell-direction.md`.

## AI boundary

BureauCat must remain usable for core case/workflow/evidence navigation without AI. AI is an analytical assistant, not the source of truth. Structured AI output should be schema-validated.

## Technical principles

- Prefer simple TypeScript service boundaries.
- Keep API contracts explicit and validated.
- Prefer incremental evolution over broad refactors.
- Add automated tests around domain services and migrations before structural changes.
- GitHub is implementation truth for what exists.
- `docs/project/` is canonical product/project documentation for intended direction.
- Execution allocation follows D-024: ChatGPT planning/instructions, Codex code/versioned docs/static verification, VS agent local runtime/environment/API/UI verification. This changes development operations, not product architecture.
