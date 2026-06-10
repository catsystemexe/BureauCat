# 01 — Repository Overview

> Read-only audit, generated 2026-06-10. No source files were modified.

## What BureauCat is

BureauCat (MVP v1.2) is a desktop-first case-management workspace built around a
three-panel layout: **Journal** (situations, goals, journal items) | **Chat**
(assistant conversation, AI suggestions, meeting prep) | **Documents** (upload,
converted-document viewer with highlights/annotations, notes, and pins/bookmarks).
Documents are converted to Markdown via a Python `markitdown` pipeline.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js ^16.2.7 (App Router), React ^19.2.7 |
| Language | TypeScript ^6.0.3 (strict project, `tsc --noEmit` available) |
| Database | Prisma ^6.19.0 + SQLite (`data/bureaucat.sqlite`) |
| Validation | Zod ^4.4.3 |
| Icons | `@heroicons/react` ^2.2.0 **and** `lucide-react` ^1.17.0 (both installed) |
| Styling | Single global stylesheet `src/app/globals.css` (no Tailwind, no CSS modules) |
| Document conversion | Python script `scripts/convert_with_markitdown.py` invoked from Node |
| Deployment hint | `replit.nix` present (Replit-style single-instance hosting) |

There is **no test framework, no linter config (ESLint/Prettier), no CI** in the
repository. The only checks are `npm run typecheck` and `prisma validate`.

## Project structure

```
BureauCat/
├── data/uploads/              # uploaded originals (runtime data inside repo tree)
├── docs/                      # product/architecture/design docs (v2 refactor notes)
├── prisma/
│   ├── schema.prisma          # 9 models
│   └── migrations/            # 7 migrations (naming inconsistencies — see 06)
├── scripts/convert_with_markitdown.py
└── src/
    ├── app/
    │   ├── api/               # 23 REST route handlers (App Router route.ts)
    │   ├── cases/             # /cases list page + /cases/[caseId] workspace page
    │   ├── globals.css        # 4,904 lines — the entire design system
    │   ├── globals.css.bak-header-cleanup   # stale backup, checked in
    │   ├── layout.tsx, page.tsx
    ├── components/
    │   ├── ThreePanelWorkspace.tsx          # workspace shell + shared state (570 lines)
    │   ├── CaseList.tsx
    │   ├── types.ts                         # shared client-side types
    │   ├── chat/        # ChatPanel, MessageList, MessageComposer,
    │   │                # MeetingPrepButton/Card, SuggestionPreview
    │   ├── documents/   # DocumentList, DocumentUpload,
    │   │                # DocumentViewPanel.tsx (2,052 lines) + .bak copy
    │   ├── journal/     # JournalPanel, GoalsSection, SituationPager,
    │   │                # SituationDocumentsSection
    │   └── layout/ meeting-prep/ right-panel/ shared/ suggestions/   # empty (.gitkeep only)
    └── lib/
        ├── ai/mockChatAI.ts   # mock AI backend (no real LLM integration yet)
        ├── documents/         # storage.ts, extraction.ts, markitdown.ts
        ├── prisma.ts          # Prisma client singleton
        ├── services/          # 11 service modules (cases, chat, documents, journal,
        │                      # situations, goals, suggestions, meetingPrep,
        │                      # documentAnnotations, documentPins, evidenceStateService)
        └── validation/        # 8 Zod schema modules mirroring the API surface
```

## Size metrics

- **~13,000 LOC** total in `src/`, `prisma/`, `scripts/` (excluding `.bak` files).
- 19 `.tsx` files, 49 `.ts` files.
- 12 files carry `"use client"` — effectively the entire workspace UI is
  client-rendered, including the page component `src/app/cases/[caseId]/page.tsx`.

### Largest files

| File | Lines | Notes |
|---|---|---|
| `src/app/globals.css` | 4,904 | 38% of the codebase; whole design system in one file |
| `src/components/documents/DocumentViewPanel.tsx` | 2,052 | god-component: viewer + highlights + notes + pins + drag + toolbar |
| `src/components/ThreePanelWorkspace.tsx` | 570 | workspace shell + cross-panel state + panel resizing |
| `src/components/journal/JournalPanel.tsx` | 353 | |
| `src/components/journal/GoalsSection.tsx` | 320 | |
| `src/components/chat/ChatPanel.tsx` | 301 | |
| `src/lib/services/suggestions.ts` | 212 | |
| `src/lib/services/meetingPrep.ts` | 208 | |
| `src/lib/services/chat.ts` | 204 | |

### Highest-complexity files (qualitative)

1. **`DocumentViewPanel.tsx`** — by far the most complex unit: text-offset
   mapping for highlights, DOM measurement for pin positions, drag handlers,
   multiple interaction modes, ~30+ pieces of local state. Primary refactor target.
2. **`ThreePanelWorkspace.tsx`** — central state hub; most cross-panel data flows
   through it via props.
3. **`globals.css`** — not "logic" but the highest-entropy file; appended-to
   historically (a `.bak-header-cleanup` copy exists), with duplicated and dead rules.
4. **`mockChatAI.ts` / `suggestions.ts` / `meetingPrep.ts`** — the simulated AI
   flow (suggestion JSON stored as strings, approve/reject lifecycle).

## Component inventory

| Area | Components |
|---|---|
| Shell | `ThreePanelWorkspace`, `CaseList`, pages (`/`, `/cases`, `/cases/[caseId]`) |
| Journal | `JournalPanel`, `SituationPager`, `GoalsSection`, `SituationDocumentsSection` |
| Chat | `ChatPanel`, `MessageList`, `MessageComposer`, `SuggestionPreview`, `MeetingPrepButton`, `MeetingPrepCard` |
| Documents | `DocumentList`, `DocumentUpload`, `DocumentViewPanel` (contains viewer, annotation toolbar, notes sidebar, pin layer — all inline) |
| Placeholders | `components/layout`, `meeting-prep`, `right-panel`, `shared`, `suggestions` are empty |

## API surface (23 route handlers)

```
/api/cases                                  GET, POST
/api/cases/[caseId]                         GET, PATCH, DELETE
/api/cases/[caseId]/documents               GET, POST (upload)
/api/cases/[caseId]/journal                 GET, POST
/api/cases/[caseId]/messages                GET
/api/cases/[caseId]/chat                    POST (mock AI turn)
/api/cases/[caseId]/meeting-prep            POST
/api/cases/[caseId]/situations              GET, POST
/api/cases/[caseId]/suggestions             GET
/api/situations/[situationId]               PATCH, DELETE
/api/situations/[situationId]/goals         POST
/api/situations/[situationId]/documents     GET, POST
/api/situations/[situationId]/documents/[documentId]  DELETE
/api/goals/[goalId]                         PATCH, DELETE
/api/journal/[journalItemId]                PATCH, DELETE
/api/documents/[documentId]                 GET, DELETE
/api/documents/[documentId]/original        GET (serve original file)
/api/documents/[documentId]/annotations     GET, POST
/api/documents/[documentId]/pins            GET, POST
/api/document-annotations/[annotationId]    PATCH, DELETE
/api/document-pins/[pinId]                  PATCH, DELETE
/api/suggestions/[suggestionId]/approve     POST
/api/suggestions/[suggestionId]/reject      POST
```

Note the three different flat/nested conventions for sub-resources
(`/api/documents/[id]/annotations` to create vs `/api/document-annotations/[id]`
to mutate) — covered in the architecture audit.

## Dependency overview

Runtime dependencies are minimal (7 packages), which is a strength:

- `next`, `react`, `react-dom` — framework.
- `@prisma/client` — data access.
- `zod` — request validation.
- `@heroicons/react` + `lucide-react` — **two icon libraries for one app**;
  consolidation candidate.
- Implicit, undeclared dependency: **Python + `markitdown`** must exist on the
  host (`scripts/convert_with_markitdown.py`); only hinted at via `replit.nix`.
  Not expressed in `package.json` or README setup steps.

Dev dependencies: TypeScript, Prisma CLI, @types. No ESLint, no Prettier, no
test runner, no Tailwind.

## Notable repository hygiene issues (detailed in later reports)

- Two `.bak` backup files committed (`globals.css.bak-header-cleanup`,
  `DocumentViewPanel.tsx.bak` — the latter even carries `"use client"` and would
  be type-checked if matched by tsconfig).
- `.gitkeep` files in directories that now contain real files (e.g. `src/app/api/cases/`).
- Runtime data directory `data/uploads/` lives inside the repo tree.
- Migration folder names with malformed timestamps (`202606091_markitdown_pipeline`,
  `20260610_*` without time component) — see report 06 for a concrete ordering bug.
- Git history messages are terse ("ui design", "doc ui done prototyp"), no branching discipline visible.
