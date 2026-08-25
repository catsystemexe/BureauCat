# BureauCat

BureauCat is a case-management and analytical workspace for relatively bounded administrative matters. The current product direction has evolved beyond the historical MVP v1.2 specification.

> **Documentation note:** [`docs/bureaucat-mvp-v1.2.md`](docs/bureaucat-mvp-v1.2.md) is a historical specification and is not the current product authority. Current project documentation is being consolidated into versioned repository documentation under `docs/project/`.

## Current app state

The repository currently includes:

- A case list with draft case creation and case detail workspaces.
- A desktop-first three-panel workspace evolving toward a Situation/workflow rail, Step workspace, and contextual evidence/document views.
- Journal-related situations, persisted Goals, linked documents, Journal item APIs, and evidence-state handling.
- Situation workflow persistence for ordered Steps, Required Inputs and criteria, Tasks, overrides, and workflow events.
- Case document upload, local file storage, normalized document text, original-file access, annotations, highlights, notes, and pins.
- Document Analysis / Document Insight capabilities and Case Context assembly.
- Prisma + SQLite persistence, App Router API routes, and Zod validation at domain boundaries.

The current AI/chat integration is not yet the final production interaction model. Current workflow and context foundations are being implemented incrementally.

## Stack

- TypeScript
- Next.js App Router
- React
- Prisma + SQLite
- Zod
- Python-based MarkItDown conversion helper

## Getting started

### Prerequisites

- Node.js and npm
- Python 3 for document conversion
- The Python packages imported by `scripts/convert_with_markitdown.py` when using the corresponding formats (`markitdown`, `striprtf`, `rapidocr-onnxruntime`, and `pdf2image`)
- Poppler when PDF rasterization/OCR is required by the local environment

The repository does not currently provide a Python dependency lockfile, so document conversion capabilities depend on the packages installed in the runtime environment.

### Run locally

1. Install JavaScript dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Generate the Prisma client:

   ```bash
   npm run prisma:generate
   ```

4. Apply the existing migrations:

   ```bash
   npm run db:deploy
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open <http://localhost:3000>. The root route redirects to the case list at `/cases`.

`MARKITDOWN_PYTHON` can be set to select a Python executable other than `python3`.

## MarkItDown support matrix

This matrix describes the current user-facing document behavior:

| Format | Current support |
| --- | --- |
| TXT | OK |
| MD | OK |
| RTF | Normalized view + external original |
| DOCX | Normalized view + external original |
| PDF | OK |
| PNG | Placeholder |
| HTML | Not implemented |

Uploaded originals are stored under `data/uploads/`, which remains ignored by Git except for its directory placeholder.

## Available commands

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate
npm run db:deploy
```

There is currently no automated test suite or `npm test` script. The primary repository checks are:

```bash
git diff --check
npm run typecheck
npm run build
```

## Current product direction

- Situation is the final bounded working unit inside Case; the proposed List concept is retired.
- Target structure is `Case → Situation → Goal / Steps / Tasks` alongside Journal, Documents/Evidence, Case Context, and Case Timeline.
- The standard Situation workflow is `Analysis → Plan → Collection → Input Validation → Production → Output Review → Execution / Completion` and remains adaptive rather than a rigid state machine.
- Journal is the user-visible working model; Documents are evidence.
- Source-grounded document analysis may project compact traceable findings into Journal under current project decisions, while user-authored Journal content must not be silently overwritten or deleted.
- AI assists with analysis and orchestration but is not authoritative for consequential user decisions.

## Historical material

The following material is retained for implementation history and comparison only:

- [`docs/bureaucat-mvp-v1.2.md`](docs/bureaucat-mvp-v1.2.md)
- older repository audits and snapshots that describe superseded product assumptions

Historical material must not override current Project State, Architecture, active Decisions, or newer repository documentation.
