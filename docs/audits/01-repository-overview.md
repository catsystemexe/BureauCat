# 01 — Repository Overview

## Audit scope and method

This report inventories the repository as of 2026-06-10. The authoritative baseline is `docs/bureaucat-mvp-v1.2.md`; findings do not treat later architecture notes as permission to expand MVP scope. The audit was static and read-only with respect to application source, schema, migrations, and data. No migration, application server, or automated refactor was run.

Metrics were collected with `find`, `git ls-files`, `wc`, `rg`, and a small read-only Python heuristic. “Complexity” below is a comparative heuristic based on branch/conditional operators, not a formal cyclomatic-complexity score.

## Executive snapshot

| Area | Observation |
|---|---|
| Framework | Next.js App Router, React 19, TypeScript |
| Persistence | Prisma 6 + SQLite |
| Validation | Zod at most domain boundaries; several newer document routes use ad hoc checks |
| UI shape | Desktop-first three-panel case workspace |
| AI | Mock chat implementation; suggestion validation/approval flow exists |
| Document pipeline | Local filesystem upload, Python MarkItDown/OCR subprocess, extracted/processed text |
| Repository size | Approximately 12,700 lines of TS/TSX/CSS under `src` |
| Main hotspots | `globals.css` (4,904 lines), `DocumentViewPanel.tsx` (2,052 lines) |
| Test posture | No test files or test script; only typecheck/build/Prisma scripts are declared |
| Highest immediate risk | Prisma schema and migration history do not describe the same database |

## Project structure

```text
BureauCat/
├── docs/
│   ├── bureaucat-mvp-v1.2.md       # authoritative product specification
│   ├── architecture/               # later v2/refactor design documents
│   ├── design/                     # visual-system documentation/reference image
│   └── audits/                     # these audit reports
├── prisma/
│   ├── schema.prisma               # current data model
│   └── migrations/                 # seven migration directories plus lock file
├── scripts/
│   └── convert_with_markitdown.py  # document conversion/OCR subprocess
├── src/
│   ├── app/
│   │   ├── api/                    # App Router API handlers
│   │   ├── cases/                  # case list and case workspace pages
│   │   ├── globals.css             # all application styling
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── chat/
│   │   ├── documents/
│   │   ├── journal/
│   │   ├── CaseList.tsx
│   │   ├── ThreePanelWorkspace.tsx
│   │   └── types.ts
│   └── lib/
│       ├── ai/
│       ├── constants/
│       ├── documents/
│       ├── services/
│       ├── validation/
│       └── prisma.ts
├── data/uploads/.gitkeep           # runtime upload target is otherwise ignored
├── package.json
├── next.config.ts
└── tsconfig.json
```

## Major modules

### Application shell and routing

- `src/app/page.tsx` redirects to the case list.
- `src/app/cases/page.tsx` renders `CaseList`.
- `src/app/cases/[caseId]/page.tsx` is a client-side loader for the workspace.
- `src/components/ThreePanelWorkspace.tsx` owns cross-panel selection and refresh state and renders Journal, Chat, and right-context panels.

### Journal / notebook

- `JournalPanel.tsx` currently presents situations, situation-level goals, linked documents, and placeholder AI sections.
- `GoalsSection.tsx` implements goal CRUD-like interactions.
- `SituationDocumentsSection.tsx` lists/unlinks situation-document associations.
- `SituationPager.tsx` provides situation navigation.
- The actual `JournalItem` API/service remains present, but no visible JournalItem list/editor is wired into `JournalPanel`.

### Chat and suggestions

- `ChatPanel.tsx` loads messages, sends chat requests, displays suggestions, approves/rejects suggestions, and requests meeting preparation.
- Smaller presentation components render messages, composer, suggestions, and meeting-prep output.
- `src/lib/services/chat.ts` assembles context and persists user/assistant messages and suggestions.
- `src/lib/ai/mockChatAI.ts` is a deterministic mock, not a production AI adapter.

### Documents, notes, highlights, and pins/bookmarks

- `DocumentUpload.tsx` uploads and optionally links a document to a selected situation.
- `DocumentList.tsx` lists case documents.
- `DocumentViewPanel.tsx` combines document rendering, text editing/validation, original-file preview, highlights, notes, pins, floating editors, drag/resize behavior, and API calls.
- `src/lib/documents/*` stores files, performs basic text extraction, and spawns the Python conversion pipeline.
- Annotation and pin services persist document-relative selections and metadata.

### API layer

The repository implements route handlers for:

- Cases and case detail.
- Situations, goals, and situation-document links.
- Documents, original-file streaming, annotations, and pins.
- Chat messages and meeting preparation.
- Journal items.
- AI suggestion listing, approval, and rejection.

The handlers generally follow `route -> validation -> service -> Prisma`, but newer document annotation/pin handlers contain substantial inline validation and orchestration.

### Persistence and domain services

- `prisma/schema.prisma` defines 10 models: `Case`, `Situation`, `Goal`, `Document`, `DocumentAnnotation`, `DocumentPin`, `SituationDocument`, `JournalItem`, `ChatMessage`, and `AISuggestion`.
- `src/lib/services` contains one service module per main model/workflow.
- Most services return selected Prisma records directly, so API DTOs and persistence records are effectively the same contract.

## Component inventory

| Component | Responsibility | Approx. lines | Notes |
|---|---:|---:|---|
| `ThreePanelWorkspace` and local subcomponents | Cross-panel composition, right panel, evidence rendering | 570 | Evidence state is currently unreachable because Journal selection is not wired |
| `DocumentViewPanel` | Entire document interaction workspace | 2,052 | Largest and highest-complexity component |
| `JournalPanel` | Situations/notebook composition | 353 | Does not render canonical JournalItems |
| `GoalsSection` | Situation-level goals | 320 | Duplicates several CRUD-state patterns |
| `ChatPanel` | Messages, suggestions, meeting prep | 301 | Multiple workflows in one stateful component |
| `SituationDocumentsSection` | Linked-document list and unlink | 183 | Situation-specific extension |
| `CaseList` | Case loading and creation | 131 | Client-side initial data fetch |
| `DocumentUpload` | Upload + situation linking | 128 | Two-step non-atomic workflow |
| `DocumentList` | Case document list | 108 | Separate fetch/cache state |
| `SuggestionPreview` | Suggestion cards/actions | 108 | No edit-before-approve UI |
| `SituationPager` | Situation pagination/navigation | 66 | Uses memoization for a cheap filter/sort-sized workload |
| `MeetingPrepCard` | Meeting preparation result | 52 | Presentation only |
| `MessageList` | Message rendering | 44 | Presentation only |
| `MessageComposer` | Composer form | 39 | Presentation only |
| `MeetingPrepButton` | Standalone button | 18 | Apparently unused by `ChatPanel` |

## Largest files

Measured by line count:

| Rank | File | Lines | Share / concern |
|---:|---|---:|---|
| 1 | `src/app/globals.css` | 4,904 | Monolithic stylesheet with many repeated selectors and overrides |
| 2 | `src/components/documents/DocumentViewPanel.tsx` | 2,052 | Multiple interaction systems and persistence workflows |
| 3 | `src/components/ThreePanelWorkspace.tsx` | 570 | Composition plus parsing/evidence/right-panel behavior |
| 4 | `src/components/journal/JournalPanel.tsx` | 353 | Situation UI and placeholders |
| 5 | `src/components/journal/GoalsSection.tsx` | 320 | Full state machine for one nested resource |
| 6 | `src/components/chat/ChatPanel.tsx` | 301 | Chat, suggestion, and meeting-prep orchestration |
| 7 | `src/lib/services/suggestions.ts` | 212 | Suggestion validation and transactional approval |
| 8 | `src/lib/services/meetingPrep.ts` | 208 | Context formatting/report generation |
| 9 | `src/lib/services/chat.ts` | 204 | Context assembly and persistence |
| 10 | `src/lib/services/documents.ts` | 192 | Upload, processing, linking, validation, deletion |

Two tracked backups add another 4,146 lines of stale code/CSS:

- `src/app/globals.css.bak-header-cleanup` — 2,383 lines.
- `src/components/documents/DocumentViewPanel.tsx.bak` — 1,763 lines.

## Highest-complexity files

Read-only heuristic ranking:

| File | Heuristic score | Primary reasons |
|---|---:|---|
| `DocumentViewPanel.tsx` | 305 | 49 hooks/references, 11 fetch calls, selection math, range rendering, drag/resize, floating editors |
| `ThreePanelWorkspace.tsx` | 72 | source-link parsing, three local panels, overlay behavior, cross-panel state |
| `ChatPanel.tsx` | 49 | initial loading, send/reload, suggestion actions, meeting prep |
| `JournalPanel.tsx` | 41 | nested local components, situation loading/creation/editing/navigation |
| `GoalsSection.tsx` | 41 | list/create/edit/archive states and repeated optimistic/local updates |
| `CaseList.tsx` | 28 | fetch/create/navigation/error state |
| annotations API route | 28 | multiple operation modes and manual validation in one POST handler |
| `SituationDocumentsSection.tsx` | 25 | loading, refresh, unlink, selection state |

## Dependency overview

### Runtime dependencies

| Dependency | Purpose | Audit note |
|---|---|---|
| `next` | App Router/web framework | Core |
| `react`, `react-dom` | UI runtime | Core |
| `@prisma/client` | SQLite ORM client | Core |
| `zod` | Request and AI-output validation | Correct choice, but not applied consistently |
| `@heroicons/react` | Icons in workspace/journal | One of two icon libraries |
| `lucide-react` | Icons in document viewer | Duplicates icon-system responsibility |

### Development dependencies

- TypeScript and React/Node type packages.
- Prisma CLI.
- No ESLint, formatter, unit-test runner, component-test framework, end-to-end framework, accessibility checker, or complexity/static-analysis tool is declared.

### External runtime requirements not represented in `package.json`

The Python script imports `markitdown`, `rapidocr_onnxruntime`, `pdf2image`, and `striprtf`, and may require Poppler for PDF rasterization. These are environmental dependencies with no Python lockfile or requirements manifest in the repository.

## Repository hygiene observations

- `README.md` still describes an early scaffold and says domain models/API routes are deferred, which is materially stale.
- Empty `.gitkeep` placeholders remain in many now-populated directories.
- Two large backup files are tracked alongside live source.
- No test files were found.
- `package-lock.json` exists, but `node_modules` was absent during this audit.
- Architecture/design documents describe a v2 direction that conflicts with parts of the authoritative MVP v1.2 specification; the code appears to be following portions of that later direction.
