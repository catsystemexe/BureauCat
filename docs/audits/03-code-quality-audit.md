# 03 — Code Quality Audit

## Severity scale

- **CRITICAL** — likely data loss/deployment failure or breaks the central product invariant.
- **HIGH** — substantial correctness, maintainability, or user-facing risk.
- **MEDIUM** — localized defect or recurring maintenance cost.
- **LOW** — hygiene/readability issue with limited immediate impact.

## Findings

| ID | Finding | File / approximate location | Severity | Recommendation |
|---|---|---|---|---|
| CQ-01 | Tracked backup copies duplicate live source | `src/components/documents/DocumentViewPanel.tsx.bak` (entire file); `src/app/globals.css.bak-header-cleanup` (entire file) | HIGH | Confirm they are obsolete, remove them from version control, and rely on Git history. They add 4,146 searchable lines and create false positives during audits/refactors. |
| CQ-02 | Monolithic CSS contains extensive repeated selectors and late overrides | `src/app/globals.css`, especially ~657-1012, ~1596-2344, ~2693-3495, ~3589-4904 | HIGH | Before editing behavior, create a selector/visual regression inventory, delete superseded rules, then split styles by workspace/chat/journal/document features. |
| CQ-03 | `DocumentViewPanel` is an oversized component | `src/components/documents/DocumentViewPanel.tsx:94-2052` | HIGH | After scope alignment, extract pure range functions and focused hooks/components for document data, original viewer, highlights, notes, and pins. |
| CQ-04 | Unused Journal refresh state | `src/components/ThreePanelWorkspace.tsx:481,497-499,551-554`; approval callback at `ChatPanel.tsx:245-247` | HIGH | Pass an actual refresh key/callback to a JournalItem loader, or remove the mechanism. Current approval does not refresh visible case-model data. |
| CQ-05 | Unused JournalItem selection state makes Evidence Panel unreachable | `src/components/ThreePanelWorkspace.tsx:482-484,444-451,564`; no call to `setSelectedJournalItem` | HIGH | Wire JournalItem row selection to workspace state and right-panel mode, consistent with the specification. |
| CQ-06 | Canonical Journal services/routes are effectively dead from the main UI | `src/lib/services/journal.ts`; `src/app/api/cases/[caseId]/journal/route.ts`; `src/app/api/journal/[journalItemId]/route.ts` | HIGH | Restore JournalItem rendering/editing rather than deleting these modules; Journal is authoritative per v1.2. |
| CQ-07 | `MeetingPrepButton` appears unused | `src/components/chat/MeetingPrepButton.tsx` | LOW | Remove if obsolete or use it consistently from `ChatPanel`; avoid dormant presentation components. |
| CQ-08 | `isPreparingMeeting` is maintained but no trigger is rendered | `src/components/chat/ChatPanel.tsx:89,182-208`; no call to `handlePrepareMeeting` in returned JSX | HIGH | Add the specified meeting-prep action using the existing component or remove dead state/workflow until implemented. |
| CQ-09 | Suggestion edit-and-approve exists only in backend | `src/lib/validation/suggestions.ts`; `src/lib/services/suggestions.ts`; `src/components/chat/SuggestionPreview.tsx` | MEDIUM | Provide an edit-before-approve UI because the specification explicitly requires both approval modes. |
| CQ-10 | Weak client-side suggestion parsing | `src/components/chat/ChatPanel.tsx:55-70` | MEDIUM | Share/infer a Zod schema for response parsing; checking only field presence accepts invalid enum values and malformed source links. |
| CQ-11 | Duplicate request/loading/error patterns | `CaseList.tsx`, `ChatPanel.tsx`, `JournalPanel.tsx`, `GoalsSection.tsx`, `SituationDocumentsSection.tsx`, `DocumentList.tsx` | MEDIUM | Extract only small reusable fetch/error helpers or feature hooks; avoid introducing a large data framework for MVP. |
| CQ-12 | Duplicate manual JSON-reading/validation-response helpers | multiple API routes, e.g. cases/chat/situations/goals/journal routes | MEDIUM | Introduce a tiny route utility for safe JSON parsing and Zod error responses. |
| CQ-13 | Inconsistent validation style | Zod under `src/lib/validation/*` versus ad hoc checks in document/annotation/pin routes | HIGH | Define Zod schemas for document PATCH, annotations, pins, and route parameters; enforce bounds and cross-field invariants. |
| CQ-14 | Persistence details leak into UI types | `source_links_json` and snake_case Prisma fields throughout `src/components/types.ts` | MEDIUM | Add explicit API DTO mapping at service/route boundaries, especially for parsed source links and statuses. |
| CQ-15 | Two icon libraries are used | Heroicons in workspace/journal; Lucide in `DocumentViewPanel.tsx` | LOW | Standardize on one library after visual review to reduce bundle/style inconsistency. |
| CQ-16 | README is materially stale | `README.md:3,47-66` | MEDIUM | Update current scope, external Python requirements, database setup, and available routes/checks. |
| CQ-17 | Empty `.gitkeep` files remain in populated directories | multiple paths under `src/app/api`, `src/components`, and `src/lib` | LOW | Remove placeholders where directories now contain real files. |
| CQ-18 | Formatting inconsistencies and stray whitespace | e.g. `src/components/types.ts:160-162`, `documents.ts:8,155-157`, `DocumentViewPanel.tsx` import formatting | LOW | Add a formatter/check in a later tooling task; do not mix with behavior refactors. |
| CQ-19 | Status enums are duplicated as strings across schema, TS types, validation, and UI labels | `prisma/schema.prisma`, `src/components/types.ts`, validation files, constants | MEDIUM | Centralize domain constants/types where practical; for Prisma/SQLite retain string fields but validate every write. |
| CQ-20 | CSS removes focus outlines in many places | `globals.css` around ~1304, 1346, 1609, 1645, 1846, 2106, 2649, 2727, 2806, 3971, 4573 | HIGH | Ensure every `outline: none` is replaced by an equally visible custom focus indicator with sufficient contrast. |
| CQ-21 | Goal and Situation naming conflicts with authoritative Journal vocabulary | `JournalPanel.tsx`, `GoalsSection.tsx`, Prisma models/services | HIGH | Resolve product model first. Do not normalize naming around out-of-scope entities before deciding whether to remove them. |
| CQ-22 | `DocumentAnnotation.visual_offset` is present in TypeScript but not current Prisma model | `src/components/types.ts:147-159`; no field in `prisma/schema.prisma:88-104` | HIGH | Remove the mismatched DTO field or add it only through an intentional migration if still in approved scope. |
| CQ-23 | `documentPinSelect` omits `visual_offset` although client types/use expect it | `src/lib/services/documentPins.ts:3-13`; client uses pin visual offsets | HIGH | Include the field consistently if pins remain, and cover it with schema/migration/API tests. |
| CQ-24 | Original uploaded file is not removed when a document row is deleted | `src/lib/services/documents.ts:177-191` | HIGH | Add a file lifecycle operation with clear failure semantics and orphan cleanup. |
| CQ-25 | Stored file can be orphaned if conversion or DB create fails | `src/lib/services/documents.ts:26-55`; `src/lib/documents/storage.ts:14-27` | MEDIUM | On ingestion failure, delete the newly stored file; record processing failures without losing cleanup control. |
| CQ-26 | Catch-all database errors are mislabeled as 404 | document annotation/pin item routes | MEDIUM | Distinguish Prisma not-found errors from validation, schema, and infrastructure errors; log server failures and return 500. |
| CQ-27 | No test code exists | repository-wide | HIGH | Add focused unit tests for schemas/services/range math and integration tests for critical API workflows before major refactors. |
| CQ-28 | No lint/format/static-analysis scripts | `package.json:5-13` | MEDIUM | Add minimal tooling only with clear reason: formatter, ESLint or equivalent, and test runner. |
| CQ-29 | Python dependencies are undeclared | `scripts/convert_with_markitdown.py:16-17,32-33,74,92` | HIGH | Add a pinned Python dependency manifest and document system dependencies such as Poppler. |
| CQ-30 | Case page performs client-side loading instead of using App Router server data flow | `src/app/cases/[caseId]/page.tsx:1-72` | LOW | Consider server-side data loading for simpler initial state and reduced client JS; keep client boundary at the interactive workspace. |

## Duplicate CSS detail

A crude selector inventory found unusually high repetition, including:

- `.document-extracted-text` declared 13 times.
- `.document-note-floating-content` declared 8 times.
- `.document-note-floating-editor` declared 8 times.
- `.document-icon-action` and `.document-validation-toggle` declared 6 times each.
- `.document-note-floating-actions` declared 6 times.
- `.document-pin-floating-editor` declared 5 times.
- Core panel selectors such as `.chat-panel`, `.document-view-panel`, `.right-panel-tab-content`, and `.goals-section` are repeated across widely separated blocks.

Some repetition is valid contextual overriding, but the density and ordering indicate append-only styling. The safe cleanup sequence is: screenshot key states, identify the final computed rules, consolidate exact duplicates, then move feature groups into separate files or CSS Modules.

## Dead and unreachable behavior summary

- Evidence Panel implementation exists, but no JournalItem selection invokes it.
- Journal refresh callback increments discarded state.
- Meeting preparation logic exists, but no visible button invokes it.
- `MeetingPrepButton.tsx` appears unreferenced.
- Canonical JournalItem API/service code has no main UI consumer.
- The backup files are dead copies, not executable imports, but pollute search and maintenance.

## Refactoring opportunities, in safe order

1. Remove proven backup/placeholders and update documentation.
2. Add tests around current suggestion approval, document range operations, and migration smoke deployment.
3. Restore v1.2 JournalItem visibility/selection and remove out-of-scope divergence.
4. Extract pure document range/offset functions without changing UI.
5. Split document persistence hooks from rendering.
6. Consolidate route validation/error helpers.
7. Consolidate CSS only after visual baselines exist.
