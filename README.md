# BureauCat

BureauCat is a case-management and analytical workspace for relatively bounded administrative matters.

> **Canonical project documentation:** [`docs/project/`](docs/project/).  
> [`docs/bureaucat-mvp-v1.2.md`](docs/bureaucat-mvp-v1.2.md) is historical and non-authoritative.

## Current app state

The repository currently includes:

- A case list with case creation and case detail workspaces.
- A three-region workspace evolving around Situation workflow.
- Persisted Situations and Goals.
- Situation workflow persistence for ordered Steps, Required Inputs/criteria, Tasks, overrides, and workflow events.
- A compact left workflow rail and central Step workspace foundation.
- Journal APIs and evidence-state handling.
- Case document upload, local file storage, normalized document text, original-file access, annotations, highlights, notes, and pins.
- Document Analysis / Document Insight capabilities.
- Case Context assembly including authoritative Goal and workflow state.
- Prisma + SQLite persistence, App Router API routes, and Zod validation at domain boundaries.

The final end-to-end workflow, Timeline, Production/Output Review and production assistant interaction model are still incomplete.

## Project documentation

Start here:

- [`00-project-state.md`](docs/project/00-project-state.md)
- [`01-architecture.md`](docs/project/01-architecture.md)
- [`03-backlog.md`](docs/project/03-backlog.md)
- [`04-decisions.md`](docs/project/04-decisions.md)
- [`05-workflow.md`](docs/project/05-workflow.md)

Detailed contracts:

- [`07-workflow-persistence-state-contract.md`](docs/project/07-workflow-persistence-state-contract.md)
- [`08-ux-shell-direction.md`](docs/project/08-ux-shell-direction.md)

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
- Runtime Python packages required by `scripts/convert_with_markitdown.py` for the formats you use
- Poppler when PDF rasterization/OCR is required

### Run locally

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run db:deploy
npm run dev
```

The development server is configured by the repository scripts. The root route redirects to the case list.

`MARKITDOWN_PYTHON` can select a Python executable other than `python3`.

## MarkItDown support matrix

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

There is currently no automated test suite or `npm test` script. Primary repository checks are task-dependent and commonly include:

```bash
git diff --check
npm run typecheck
npm run build
npm run prisma:validate
```

## Current product direction

- Situation is the final bounded working unit inside Case; the proposed List concept is retired.
- Target structure is `Case → Situation → Goal / Steps / Tasks` alongside Journal, Documents/Evidence, Case Context, and Case Timeline.
- Standard workflow is `Analysis → Plan → Collection → Input Validation → Production → Output Review → Execution / Completion`.
- Journal is the user-visible working model; Documents are evidence.
- Source-grounded Document Analysis may project compact traceable findings into Journal under current Decisions while user-authored Journal content remains protected from silent overwrite/delete.
- AI assists with analysis/orchestration but is not authoritative for consequential user decisions.

## Historical material

Historical specifications and audits are retained for implementation history/comparison only. They must not override current `docs/project/` documentation or later active Decisions.
