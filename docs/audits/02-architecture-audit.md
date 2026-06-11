# 02 — Architecture Audit

## Executive assessment

The repository has a recognizable layered shape—App Router handlers, Zod validation, service modules, Prisma persistence, and feature-oriented React components—but the product architecture is currently split between two competing domain models:

1. The authoritative MVP v1.2 model, where the **Journal/JournalItem is the case model and primary navigation**.
2. A later situation-centric model, where `Situation`, `Goal`, linked documents, notes, and pins dominate the visible workspace.

That split is the main architectural risk. The database and backend still contain Journal APIs and AI suggestion approval into `JournalItem`, while the left panel does not render those items. Consequently, the system can persist authoritative case knowledge that the primary UI cannot display or select.

## Specification alignment

### Aligned foundations

- Cases start with status `draft`.
- Documents are persisted as case evidence.
- Chat messages are persisted separately from JournalItems.
- AI suggestions are persisted as `AISuggestion` and require explicit approval before a JournalItem is created.
- Chat context includes case data, compact JournalItems, document summaries, and the last 10 messages.
- Meeting preparation is generated, not persisted as a dedicated entity.
- The UI is desktop-first and uses a three-panel shell.

### Material deviations

| Deviation | Evidence | Impact |
|---|---|---|
| Journal is not the visible authoritative model | `JournalPanel.tsx:172-217,221-353` renders situation/goal/document layers and AI placeholders, not JournalItems | Approved AI suggestions become effectively invisible in the primary navigation |
| New domain entities exceed MVP v1.2 | `prisma/schema.prisma:26-59,106-136` defines `Situation`, `Goal`, `DocumentPin`, `SituationDocument` | Scope and data ownership become ambiguous |
| `Situation.description` acts as a description field | `prisma/schema.prisma:26-35`; situation validation/service/UI | Conflicts with the rule that Description is a collection of JournalItems, not a field |
| Goal exists separately from JournalItem GOAL | `Goal` model plus `JournalItem` supports `GOAL` | Two sources of truth for goals |
| Notes/pins are first-class persistence models | annotation/pin models and APIs | Beyond the specified optional simple citation highlighting; increases complexity substantially |
| Supported upload types expanded | `.md`, `.rtf`, `.jpeg` are accepted | Scope drift from PDF/DOCX/TXT/JPG/PNG |
| OCR implementation differs | local RapidOCR/MarkItDown rather than GPT Vision | Operational behavior and trust semantics differ from specification |
| Case activation after intake is absent | no intake workflow or status transition linked to suggestion approval | Draft cases can remain draft indefinitely |

## Separation of concerns

### Strengths

- Most API handlers delegate persistence to `src/lib/services`.
- Core legacy request bodies use Zod schemas in `src/lib/validation`.
- Prisma is isolated behind a singleton in `src/lib/prisma.ts`.
- Suggestion approval validates both the approval payload and suggested JournalItem before transactionally creating the JournalItem.
- Situation-document linking checks that both records belong to the same case.

### Weaknesses

- `DocumentViewPanel.tsx` mixes rendering, data fetching, persistence, text-offset algorithms, DOM Range APIs, drag behavior, resize behavior, hover tooltips, original-file viewing, and validation status.
- `ThreePanelWorkspace.tsx` mixes shell composition with source-link parsing and Evidence Panel implementation.
- Several route handlers perform custom validation and workflow logic instead of using reusable schemas/services.
- API response types are duplicated manually in components rather than generated/shared as contracts.
- Services return Prisma-shaped records directly, coupling UI/API contracts to database naming and storage details such as `source_links_json`.
- Filesystem and database changes are not coordinated transactionally.

## Component boundaries

### Appropriate boundaries

- Chat presentation has been divided into `MessageList`, `MessageComposer`, `SuggestionPreview`, and `MeetingPrepCard`.
- Journal subfeatures have separate goals, pager, and linked-document components.
- Document upload and document list are separate from document viewing.

### Oversized responsibilities

#### `DocumentViewPanel.tsx` — critical boundary problem

This component owns at least nine independently testable concerns:

1. Document state and validation.
2. Processed-text editing.
3. Original-file modal/window.
4. Original-window dragging and resizing.
5. Text selection capture.
6. Highlight range segmentation and rendering.
7. Note marker/editor behavior.
8. Pin placement, numbering, dragging, and editing.
9. API synchronization and error state.

Any change to one interaction can rerender or destabilize all others. The component should be decomposed around domain hooks and rendering layers, but only after the authoritative scope decision removes out-of-scope functionality.

#### `ThreePanelWorkspace.tsx` — high boundary problem

The workspace owns right-panel tabs, document upload/list overlay, document selection, evidence parsing, and evidence rendering. Cross-panel state is appropriate here, but source-link parsing and the full Evidence Panel should be extracted. More importantly, JournalItem selection must be wired before refining abstractions.

#### `ChatPanel.tsx` — medium boundary problem

Chat message loading, message submission, suggestion actions, and meeting preparation are separate workflows. They can share a case ID but should not share one broad error/loading state surface.

## API design

### Strengths

- Routes generally use resource-oriented URLs.
- HTTP status usage is mostly sensible (`400`, `404`, `409`, `201`).
- Suggestion approval explicitly supports an edited payload in backend validation/services.
- Case-specific collection routes check case existence.

### Risks and inconsistencies

| Finding | Severity | Details |
|---|---|---|
| No authorization boundary | Critical for any non-single-user deployment | Every route trusts possession of an ID; the specification excludes multi-user, but deployment must still be explicitly local/single-user or protected at the perimeter |
| Mixed validation approach | High | Older routes use Zod; document PATCH, annotations, and pins use hand-written type checks with weak bounds |
| Unscoped child-resource routes | High | `/api/goals/:id`, `/api/documents/:id`, `/api/document-annotations/:id`, and `/api/document-pins/:id` do not carry or verify case context |
| Overloaded annotation POST | Medium | One endpoint switches between create/apply/erase/hard-delete modes based on body fields |
| Inconsistent error handling | Medium | Some handlers catch and return details, some throw, and some convert any database error into 404 |
| No request-size policy for JSON routes | Medium | Text, notes, selected text, and processed document text have no explicit maximum |
| API beyond documented v1.2 surface | Medium | Situation, goal, annotation, and pin routes are not in the authoritative API list |
| UI cannot use edit-and-approve | Medium | Backend supports it; `SuggestionPreview` only offers approve/reject |

## Service layer

### Positive observations

- Domain queries are centralized rather than duplicated across routes.
- Suggestion approval and case creation use Prisma transactions.
- Context assembly performs independent queries concurrently.
- Situation-document linking enforces case consistency.

### Missing or incomplete abstractions

1. **Authorization/access policy:** even a single-user MVP needs an explicit boundary (local-only, authenticated proxy, or application auth) rather than implicit openness.
2. **Document ingestion job boundary:** upload, conversion, OCR, and DB persistence currently occur in one request.
3. **File lifecycle service:** database deletion does not delete the original file; DB failure after storage also leaves an orphan.
4. **Shared API error layer:** repeated `readJson`, validation response, not-found response, and Prisma error mapping.
5. **Shared API contracts:** component-side response assertions are handwritten and often weaker than server schemas.
6. **Canonical source-link type:** source links are stored as arbitrary JSON strings and parsed heuristically in the UI.
7. **Canonical case-model repository:** JournalItems, situation goals, and situation descriptions currently overlap conceptually.
8. **Annotation range engine:** range segmentation/merging/erasing belongs outside React rendering and needs deterministic unit tests.
9. **Document processor adapter:** Python executable, timeout, output limit, dependency/version metadata, and processing result should be encapsulated.

## State management

Local React state is reasonable for an MVP, but state ownership and refresh semantics are inconsistent:

- The workspace maintains `setJournalRefreshKey` but discards the value and does not pass it to `JournalPanel` (`ThreePanelWorkspace.tsx:480-499`). Approving a suggestion causes only a parent rerender, not a Journal refetch.
- `selectedJournalItem` has a setter that is never called (`ThreePanelWorkspace.tsx:484`), making Evidence Panel mode unreachable.
- Documents exist in several independent state stores: case document list, situation document list, selected document, and current document internal state. Refresh counters manually synchronize only parts of this graph.
- `DocumentViewPanel` copies the incoming document into local state, then synchronizes on whole-object identity. This creates two sources for the current document.
- Optimistic note/pin updates can race with blur-triggered persistence requests.

A global state library is not required. A small set of case-workspace hooks or a reducer/context can centralize selected resource IDs and explicit invalidation while preserving simple React architecture.

## Technical debt register

| Risk | Severity | Recommendation |
|---|---|---|
| Competing Journal vs Situation/Goal domain models | Critical | Make a product decision against v1.2; remove or quarantine non-authoritative entities before further feature work |
| Fresh migration chain is invalid and incomplete | Critical | Repair migration history in a deliberate database task before deployment; see database audit |
| Approved suggestions are not visible in Journal UI | High | Restore JournalItem list/selection/editing as the left panel’s authoritative model |
| Document viewer monolith | High | First trim scope, then split data hooks, range engine, layers, editors, and original viewer |
| Missing auth/deployment trust boundary | High | Document and enforce local-only or add authentication/per-case authorization |
| No automated tests | High | Add focused service/validation/range tests and API smoke tests before refactors |
| CSS override accumulation | High | Remove backups, identify active cascade, then modularize by feature |
| Synchronous document processing | High | Move conversion/OCR behind a bounded processor/job interface |
| Stale README and empty placeholders | Low | Update documentation and remove obsolete placeholders after architecture is stabilized |

## Recommended target architecture within MVP v1.2

```text
UI (three panels)
├── JournalPanel (JournalItem list, sections, selection, user edits)
├── ChatPanel (messages + pending AISuggestions)
└── RightPanel
    ├── HelpState
    ├── EvidencePanel (selected JournalItem)
    └── DocumentView (selected Document; optional simple citation highlights)

API routes
└── Zod validation + consistent error mapping

Services
├── CaseService
├── JournalService + EvidenceStateService
├── DocumentService + bounded DocumentProcessor
├── ChatService + AI adapter
├── SuggestionService
└── MeetingPrepService

Persistence
└── Case, Document, JournalItem, ChatMessage, AISuggestion
```

This target intentionally does not introduce additional entities beyond the authoritative specification.
