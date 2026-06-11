# 08 — Cleanup Roadmap

## Guiding constraints

- The authoritative target is BureauCat MVP v1.2.
- Journal remains the authoritative case model.
- AI-created Journal changes always pass through `AISuggestion` and user approval.
- Chat remains a workspace, not memory.
- No new domain features should be inferred from existing experimental code.
- Database repairs and destructive removals require explicit backup/data decisions.

Effort estimates assume one experienced engineer familiar with Next.js/Prisma. They include implementation and focused review, not product decision latency.

## Phase 1 — Safe Cleanup

Low-behavior-change work that improves confidence before refactoring.

| Priority | Task | Effort | Expected benefit | Risk level |
|---:|---|---:|---|---|
| 1 | Establish a clean migration smoke test against a temporary SQLite DB and document current failure | 0.5–1 day | Makes the release blocker reproducible and prevents further hidden drift | Low |
| 2 | Inventory existing databases and `_prisma_migrations`; decide disposable baseline vs preserved-data repair | 0.5–1 day | Prevents accidental data loss while repairing migrations | Medium |
| 3 | Remove tracked `.bak` files after confirming Git contains their history | 0.25 day | Removes 4,146 lines of dead search surface | Low |
| 4 | Remove obsolete `.gitkeep` files in populated directories | 0.25 day | Repository hygiene and clearer inventory | Low |
| 5 | Update README to current architecture, setup, Python requirements, and limitations | 0.5 day | Reduces onboarding and deployment errors | Low |
| 6 | Add explicit text-size limits and Zod schemas to document PATCH, annotation, and pin routes | 1–2 days | Immediate correctness/security protection | Low–Medium |
| 7 | Add subprocess timeout/output cap and stable processing errors | 1–2 days | Reduces upload denial-of-service and hung requests | Medium |
| 8 | Add upload-root path containment and original-file cleanup on delete/failure | 1 day | Prevents arbitrary-path trust and sensitive orphan files | Medium |
| 9 | Add minimal security headers compatible with document preview | 0.5–1 day | Baseline browser hardening | Low–Medium |
| 10 | Document/enforce deployment trust model: loopback-only or authenticated perimeter | 0.5–3 days | Closes the largest security gap | Medium; depends on chosen model |
| 11 | Add formatter/lint/test scripts with minimal dependencies and no mass reformat in the same change | 0.5–1 day | Repeatable quality gate without noisy behavioral diff | Low |
| 12 | Add focused tests for suggestion approval validation and document range pure behavior as-is | 1–2 days | Protects central AI gate and fragile annotation logic before refactor | Low |

### Phase 1 exit criteria

- Clean migration failure is understood and a reviewed repair strategy exists.
- No backup files remain in active source paths.
- Sensitive routes have explicit input bounds.
- Document processing cannot run indefinitely or emit unbounded output.
- Deployment exposure is explicit and enforced.
- Baseline automated checks exist.

## Phase 2 — Refactor

Behavior-preserving or scope-reducing changes after safety nets exist.

| Priority | Task | Effort | Expected benefit | Risk level |
|---:|---|---:|---|---|
| 1 | Resolve authoritative scope: JournalItem vs Situation/Goal/notes/pins. Produce a signed-off keep/remove map against v1.2 | 0.5–1 day | Prevents polishing the wrong architecture | Low implementation risk; high product importance |
| 2 | Restore JournalItem section list, selection, edit, status, and evidence state in left panel | 3–5 days | Re-establishes the core product model and makes approved suggestions visible | Medium–High |
| 3 | Wire JournalItem selection to Evidence Panel and source document opening | 1–2 days | Restores required three-panel workflow | Medium |
| 4 | Replace discarded Journal refresh state with explicit Journal data invalidation | 0.5–1 day | Correct suggestion-approval behavior and fewer wasted renders | Low |
| 5 | Add Edit + Approve UI using existing backend contract | 1–2 days | Completes required suggestion workflow | Medium |
| 6 | Render the meeting-prep trigger and remove unused button/state duplication | 0.5–1 day | Completes specified workflow and removes dead code | Low |
| 7 | Remove/hide unfinished Analysis and Procedure right-panel tabs until specified behavior exists | 0.25 day | Less confusing, more honest UI | Low |
| 8 | Remove/defer out-of-scope notes, manual highlights, and pins, or isolate them behind a non-MVP branch | 2–5 days | Large reduction in code, schema, security, and performance risk | Medium–High; data migration decision required |
| 9 | Extract document text range calculations into pure tested functions | 1–2 days | Makes remaining citation highlighting deterministic and testable | Medium |
| 10 | Split `DocumentViewPanel` into data hook, text renderer, original viewer, and minimal citation layer | 3–5 days | Lower rerender cost and safer maintenance | Medium |
| 11 | Consolidate route JSON/Zod/error helpers | 1 day | Consistent API behavior with less duplication | Low |
| 12 | Consolidate shared API DTOs/source-link schema | 1–2 days | Removes heuristic parsing and DB contract leakage | Medium |
| 13 | Consolidate CSS by active feature after visual regression baselines | 3–5 days | Removes override debt and accessibility regressions | Medium–High |
| 14 | Standardize icon library and common button/focus styles | 0.5–1 day | Visual consistency and smaller dependency surface | Low |

### Phase 2 exit criteria

- The visible UI and database concepts match MVP v1.2.
- Approved suggestions appear in Journal immediately.
- Evidence Panel is reachable from Journal selection.
- Document viewer has only approved MVP responsibility.
- CSS and API validation have clear ownership.

## Phase 3 — Architecture Improvements

Larger structural work that should follow scope alignment, not precede it.

| Priority | Task | Effort | Expected benefit | Risk level |
|---:|---|---:|---|---|
| 1 | Execute reviewed Prisma migration repair/baseline and add drift checks | 2–5 days | Reproducible deployments and known data integrity | High |
| 2 | Migrate/remove Situation, Goal, SituationDocument, Annotation, and Pin data according to approved v1.2 map | 2–7 days | One authoritative case model and smaller schema | High |
| 3 | Introduce bounded document-processing adapter/job lifecycle | 3–6 days | Responsive uploads, timeouts, retryable status, safer parser boundary | Medium–High |
| 4 | Add original file hash, processing version, and validation provenance | 1–3 days | Better evidence integrity without a full version-history feature | Medium |
| 5 | Define a small workspace state/reducer around selected JournalItem/document and invalidation | 2–3 days | Predictable cross-panel coordination without a heavy state library | Medium |
| 6 | Add bounded chat/document collection APIs and incremental UI loading | 2–4 days | Stable performance as cases grow | Medium |
| 7 | Add API integration tests for case, document, chat, suggestion, Journal, and meeting-prep workflows | 3–5 days | Protects architectural invariants and refactors | Low–Medium |
| 8 | Add accessibility test pass and keyboard interaction coverage | 2–4 days | Usable evidence/Journal workflows and regression protection | Medium |
| 9 | Replace mock AI with an adapter only after schema validation, context caps, and failure behavior are tested | 3–6 days | Production AI integration while preserving Journal approval gate | Medium–High |
| 10 | Add observability for processing failures and API errors without logging sensitive content | 1–2 days | Faster diagnosis with lower privacy risk | Low–Medium |

## Recommended sequencing

```text
Migration/trust-model diagnosis
        ↓
Safety bounds + tests
        ↓
Authoritative scope decision
        ↓
Restore Journal/Evidence/Suggestion workflows
        ↓
Remove out-of-scope complexity
        ↓
Repair schema/migrations and migrate data
        ↓
Decompose document/UI architecture
        ↓
Production AI and operational hardening
```

## Tasks explicitly not recommended now

- Switching away from SQLite solely for hypothetical scale.
- Adding Redux or another global state dependency before simplifying workspace state.
- Building a timeline, knowledge graph, workflow engine, notifications, sharing, or mobile layout.
- Adding precise citation coordinates/page mapping.
- Building full JournalItem version history.
- Refactoring all CSS and `DocumentViewPanel` before deciding whether notes/pins/manual ranges remain in scope.
- Generating migrations opportunistically during unrelated cleanup.

## Highest-value first milestone

A practical first milestone is:

1. make clean deployment reproducible,
2. enforce the deployment security boundary,
3. restore JournalItem rendering/selection,
4. make approval update Journal visibly,
5. make Evidence Panel reachable,
6. hide or remove unfinished/out-of-scope controls.

This milestone fixes the core product loop before investing in secondary document interactions.
