# BureauCat — Project State

## Status

Canonical project-state document under D-022. GitHub `docs/project/` is the normative, versioned documentation location. Google Drive mirrors these documents for reading, sharing, and ChatGPT Project access.

The canonical documentation bootstrap, operating-rule consolidation and first manual GitHub → Drive mirror synchronization are complete. The mirror mapping/procedure is maintained in `09-drive-sync.md`. Synchronization of the current local-development changes is **pending**; the historical first sync does not establish parity for this batch.

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

The documentation-only Windows report update is prepared for review on the repair branch. BC-009 remains In Progress; documentation closeout and Drive synchronization are pending. Neither PR has been merged or deployed by this work.

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
- Broad automated test suite / CI (a focused temporary-SQLite regression check is available via `node --test scripts/workflow-initialization.test.cjs`).
- Automated GitHub → Drive documentation synchronization (manual sync is operational; automation is intentionally deferred).

## Important current implementation gaps

Before dependent workflow implementation, explicitly address the minimum invariant strategy for:

- one authoritative active Goal per Situation;
- one `ACTIVE` WorkflowStep per Situation;
- Situation lifecycle semantics needed for waiting/completed/superseded/blocked behavior.

Do not introduce generic workflow-engine complexity unless implementation evidence requires it.

## Current priorities

1. Continue BC-012 vertical workflow slice from the verified persistence/context/UX foundation.
2. Implement BC-013 Input Validation after the preceding workflow slice is coherent.
3. Define Timeline product/deadline model before Timeline persistence.
4. Add Production / Output Review incrementally after earlier Steps work in practice.
5. Add minimal automated tests/CI when they provide leverage without blocking product learning.

## Authority

For intended product direction, use this Project State together with `01-architecture.md` and active Decisions. For what currently exists, inspect the actual GitHub implementation. Historical `docs/bureaucat-mvp-v1.2.md` and older audits are not authoritative.
