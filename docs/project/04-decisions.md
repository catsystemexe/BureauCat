# BureauCat — Decisions

## Decision log rule

Record only decisions that materially affect product architecture, workflow, information ownership, or development operating rules. When a decision is replaced, keep it and mark it **Superseded**.

## D-001 — GitHub / Replit / Drive roles

**Status:** Superseded by D-022 for documentation ownership and D-024 for execution/runtime allocation.

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

**Status:** Superseded by D-023

The former Designer Mode / Coding Mode split is replaced by three communication/work roles plus a separate Code mode process/safety overlay.

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

**Status:** Superseded by D-024

Development and verification must remain operable with zero Replit Agent credits. GitHub is primary for inspection/diffs/branch state/preservation. Replit Free is runtime/Shell/manual UI verification for evidence GitHub cannot provide. Agent/connector is optional only. Prefer targeted diagnostics over exploratory retry loops.

## D-022 — GitHub is canonical project documentation

**Status:** Active

GitHub `docs/project/` is the canonical, versioned location for normative BureauCat project documentation as well as the implementation repository. Google Drive remains a synchronized human-readable/project-source mirror and may also contain non-canonical audits/working material.

Synchronization of normative documents is one-way by default: **GitHub canonical → Drive mirror**. Drive-only edits to mirrored normative documents are uncommitted working changes until intentionally promoted into GitHub. Initial synchronization is manual/operator-triggered; automation is deferred until the contract is stable.

Implementation remains source of truth for **what exists**; canonical project documents define **intended product direction**. Material mismatch must be surfaced rather than silently resolved.

## D-023 — Three work roles with Code mode overlay

**Status:** Active

BureauCat uses three communication/work roles: **DESIGNER**, **INSTRUCTIONS**, and **IMPLEMENTATION**.

- DESIGNER decides what should change and why; repository inspection may be read-only when implementation reality affects the decision.
- INSTRUCTIONS converts approved design into bounded executor-ready implementation work with explicit scope, acceptance criteria, change radius, verification and environment guidance.
- IMPLEMENTATION executes an approved batch against actual project state, minimizes change radius, verifies the result, preserves meaningful work and updates affected project documentation.

**Code mode** is a separate repository process/safety overlay for repository-changing work. It is not a fourth peer role and does not replace IMPLEMENTATION. Code mode may overlay INSTRUCTIONS or IMPLEMENTATION when repository safety/authorization rules are relevant.

Default implementation cycle:

`INSPECT → PLAN → PATCH → STATIC VERIFY → RUNTIME VERIFY (when required) → PRESERVE → DOC UPDATE`

Runtime verification is conditional. The original Replit Free allocation is superseded by D-024: VS agent owns local runtime/environment/Prisma/log/manual UI evidence unavailable from repository/static checks. Merge, deploy, force-push, branch deletion, destructive reset and history rewrite require explicit authorization.

## D-024 — Local development execution allocation

**Status:** Active — approved for the Windows/local bootstrap batch (2026-10-26)

- ChatGPT owns planning and instructions.
- Codex owns code changes, versioned documentation and static verification.
- VS agent owns local runtime, environment setup and runtime/API/UI verification on Windows/Linux.

This newer allocation supersedes the Replit runtime workflow in D-001/D-021 and the environment allocation originally described under D-023. D-023 work stages and the product architecture remain unchanged. Replit is not required; no data transfer from Replit is implied.

Repository scripts must preserve `DATABASE_URL=file:../data/bureaucat.sqlite`, command arguments and existing startup migration behavior across Windows/Linux without adding a dependency unless necessary. Codex records failed static checks exactly and describes out-of-scope product fixes without applying them.

The original bootstrap and workflow-initialization repair push restrictions were superseded by later explicit user authorizations for their exact commits: bootstrap `07761fb8e31263b3a4b7605742d2e2ee0252ea40` is preserved in draft [PR #37](https://github.com/catsystemexe/BureauCat/pull/37), base `work/workflow-foundation-v01`; repair `4d9a07a002f3e1a1abdcc99a28f1c69c9cc947ad` is preserved in draft [PR #38](https://github.com/catsystemexe/BureauCat/pull/38), base `chore/windows-local-bootstrap`. These authorizations do not authorize later pushes, merge or deployment. Reported Windows results and their remaining limits are recorded under BC-009 and Project State.

On 2026-10-27, ChatGPT synchronized existing Drive mirrors 00–06 from documentation snapshot `681fa5b4f1d938dff8b405edda6577e4f4b5cba0`; readback confirmed exact text equality for all seven, preserving IDs and titles. BC-009 is recorded as Done only for the approved portable local bootstrap scope; this is not application completion and does not close BC-015 or the reported limits. Final closure confirmation awaits alignment and readback of only status mirrors 00, 03 and 04 from this new status commit. That alignment has not been performed; this record does not assert Drive parity with the new commit.

## D-025 — Compact Situation Journal v1

**Status:** Active — approved bounded implementation (2026-10-27)

The Situation Journal must be useful before Goal/Plan: concrete source-grounded requests/findings, deadlines, questions and unresolved variants stay accessible. Preserve the existing AI analysis `content` rather than discarding it; retain detailed analyses. Older entries may display saved values/content/passages without another AI call or persisted backfill. User values, including explicitly empty values, take precedence; recognizably edited entries are not automatically grouped or replaced.

The compact overview is a pure derived view over current-Situation records. It neither merges/deletes source records nor writes during GET, filtering, grouping, source navigation or bookmark measurement. Only reliable shared subject/attribute/context permits grouping; uncertain associations remain separate. Distinct values remain sourced variants, with no automatic winner or preference for the newest document. Identification and supplementary parameters are collapsible; empty categories disappear; manual notes remain editable and original analytical records/user edits remain stored. The approved 2026-10-29 human-review revision makes analytical cards read-only, without source/original-record menus or replacement controls.

Distinguish document issue date, delivery, reaction deadline and planned event. Issue dates alone are not risks; no risk is invented from a hypothetical Plan. Specific document/passage links remain stored even though the 2026-10-29 revision removes their menus from analytical cards. Independent native checkboxes in the existing Situation document list replace the dropdown and select any combination of visible Journal information without unlinking/opening documents or changing AI/workflow context. All start on; newly added documents start on; a single document stays visible without a checkbox; Situation changes/reload reset to all. None shows a short empty state while manual notes remain available. Grouping retains relevant sources and excludes variants supported only by disabled documents. Contextual/all bookmark visibility must preserve PR #39 deletion isolation and PR #40 hover/drag fixes and must not persist offsets outside actual drag.

No Goal Resolver, Plan, workflow transitions, additional AI calls, dependency/schema/migration changes or mass data repair belongs to this block. Conservative implementation matching limits and pending real Windows/browser acceptance are documented in `docs/compact-situation-journal.md`; BC-012/BC-015 remain In Progress. Drive synchronization is pending.

## D-026 — Traceable Analysis ↔ Document indices and derived categories

**Status:** Active — approved bounded follow-up (2026-10-29)

Analysis is structured reading of one concrete document. A numbered analytical reference must use the existing Case number of the actually attached pin and an agreed verified source passage; do not create a parallel numbering system, merge pins or silently repair data. Missing/incompatible links, duplicate numbers, geometric overlap and legitimate sharing are distinct cases. Shared indices require the same pin and exact resolved passage; separate pins remain separately reachable even at equal starts. Without a Windows snapshot, synthetic overlap is not proof of the reported Windows cause.

Indices are display annotations, outside the source text/offset model and copied/AI text. Hover/focus/navigation/measurement/filtering/GET are read-only. Valid analytical indices replace competing sidebar symbols; manual bookmarks retain explicit editing and drag. Verified source navigation must ignore a dragged visual offset, and stale callbacks/responses must not attach to another document.

The six derived detailed-Analysis categories are Identification (explicit sender/recipient roles, contacts and file reference), Key facts, Supporting materials/attachments, Dates/deadlines/events (issue, submission, delivery, response and planned event), Risks/conflicts, and Questions. Omit empty groups, retain each original finding's exact reference and leave uncertain meanings unguessed. A sketch's date is not identification/risk, and a document/submission date is not by itself a risk or response deadline. This batch changes no AI model/prompt, adds no calls/dependencies/migrations and performs no historical pin cleanup/reanalysis. It preserves D-025's simplified Journal. See `docs/analysis-document-references.md`; Windows/browser acceptance and Drive synchronization remain pending.


## D-027 — Bounded Goal, Plan and Required Input coverage MVP

**Status:** Active — approved bounded implementation (2026-10-30)

Use existing Goal rows for editable drafts and explicit confirmed authority. `confirmed_at` distinguishes legacy/unconfirmed active rows; a partial unique index prevents two confirmed active Goals. Do not backfill a legacy choice. Explicit choice/confirmation archives former active Goals, preserves their history, and activates PLAN atomically. Confirmed content cannot be silently edited through legacy Goal CRUD; changes require a new explicit confirmation.

Persist immutable SituationPlan content versions bound to Goal and evidence context, with draft/accepted/superseded states. Expected output, procedure and required information/criteria are content, not additional Steps. Acceptance alone creates plan-bound existing RequiredInputs/criteria and activates COLLECTION. A changed Goal or saved replacement Plan supersedes previous consent, preserving old versions/inputs/reviews.

Situation workflow revisions, evidence hashes and per-Situation idempotency keys guard writes and late AI results. SQLite transaction compare-and-increment serializes consequential decisions; transitions leave exactly one ACTIVE Step. GET/navigation/filtering do not write or confirm. Legacy multiple-active-Step anomalies are not automatically repaired by GET.

Use the existing OpenAI Responses configuration for schema-validated proposals, with no production deterministic mock. Manual Goal/Plan entry and evidence review work without AI. AI evidence matching is conservative: it proposes values/source links and missing/uncertain/conflicting variants, never automatic sufficiency. Explicit review is required for SATISFIED and selected uncertain/conflicting/unresolvable evidence is rejected. All current Situation context participates regardless of Journal visibility. Effective coverage checks source membership, exact saved passage and fingerprint each read; removed/changed evidence cannot remain silently satisfied. This does not decide legal effects or automatically resolve cross-document contradictions.

Approved UI revision (2026-10-30): center is unchanged Journal; right tabs are Dokument / Analýza / Plán, replacing the original central Goal/Plan workspaces. Document detail/source-index navigation remains in Dokument. Situation Analysis orders Goal → available information → gaps/questions; Plan orders confirmed Goal → expected output → concrete numbered actions. Read-first cards, explicit editing/acceptance and collapsed histories replace always-open forms. Tab switches preserve drafts and never change persisted active Step.

New Plan JSON version 2 stores stable independent action IDs, titles, expected results, optional explanation and explicit links to unique input IDs within the version. Server validates identities/references; names and positions are not identifiers. Legacy string procedures load unchanged without invented results/links or writes on GET. The new format is saved only on an explicit proposal/save action. Goal-proposal events store created Goal ID with reason and source insight IDs; old title-only reasons remain unassigned. Preliminary gaps come only from saved questions/conflicts, with no new relevance inference; accepted requirements use existing effective coverage.

Scope stops at Collection coverage. No Input Validation transition, Production, sending, completion, override or full Timeline. The additive migration is tested on disposable SQLite only; no user database/credentials/uploads are changed. Actual Windows/browser/live-AI acceptance and Drive synchronization remain pending. See `docs/situation-goal-plan.md`.
