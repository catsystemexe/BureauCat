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

- Node.js compatible with the locked Next.js/Prisma versions and npm (this batch statically checked with Node 24.19.0 / npm 11.9.0)
- Python 3 for document conversion
- Runtime Python packages required by `scripts/convert_with_markitdown.py` for the formats you use
- Poppler when PDF rasterization/OCR is required

### Roles and local bootstrap

ChatGPT owns planning/instructions, Codex owns code/versioned docs/static verification, and VS agent owns local runtime/environment/API/UI verification (D-024). This supersedes the former Replit workflow. GitHub remains canonical; Drive synchronization for this batch is pending.

Check branch, commit and working-tree state before setup. Use `chore/windows-local-bootstrap` based on `1a2de452581104f48b87d2193465785e00f12853` for this batch. Preserve existing local files. If needed, create `.env` from `.env.example` in your editor without overwriting local settings.

These setup/static commands work in PowerShell, cmd.exe and Linux shells:

```text
npm ci
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run build
```

The lockfile is authoritative; do not use an install/update to repair a failed check. Report the exact command, exit code and diagnostic. Product TypeScript fixes are a separate batch.

VS agent then confirms that an existing authorized local database is present and all repository migrations are already applied before running the application. If the database is missing or migrations are pending, stop and report the blocker; database initialization/migration changes need a separate task:

```text
npm run dev
```

`dev` still runs `db:deploy` first and serves `http://localhost:3002` via webpack on `0.0.0.0`. `start` also runs `db:deploy` first, then `next start` with its existing default port/`PORT` behavior. Both may create/change the local database through existing migrations. Codex must not run them in this database-read-only batch. A migration mismatch requires a separate authorized task; do not reset a database.

All database-aware npm scripts invoke `scripts/with-database.cjs`, which sets `DATABASE_URL=file:../data/bureaucat.sqlite` even if the caller supplies another value. Prisma resolves it relative to `prisma/schema.prisma`, so the path remains `<repo>/data/bureaucat.sqlite`. No dependency was added. `prisma:migrate` remains an explicit developer migration command; it is not part of static verification.

`MARKITDOWN_PYTHON` selects a Python executable other than the default `python3`. VS agent should choose an installed interpreter with the conversion packages (including `markitdown`, `striprtf`, and, for OCR, `rapidocr_onnxruntime`/`pdf2image`); Poppler executables must be on PATH for PDF rasterization. This batch does not install or verify that runtime stack.

For example, in PowerShell, before starting the app:

```powershell
$env:MARKITDOWN_PYTHON = 'C:\path\to\python.exe'
```

On Linux:

```bash
export MARKITDOWN_PYTHON=/path/to/python3
```

Legacy `scripts/consolidate_prisma_baseline.sh` requires Bash/Unix tools and changes databases; it is a historical maintenance tool, not a Windows bootstrap prerequisite. The renamed `ma-validate.log` preserves the original `ma:validate` bytes as a historical artifact, not as evidence of a passing Prisma check. Tracked filenames were checked for Windows-invalid characters, device names, trailing spaces/dots and case collisions; use a short checkout path to leave room for generated dependency/build paths.

VS agent should verify the case list, an existing Case/Situation, the seven-Step rail and Step selection without changing persisted active state, the right Document/Analysis panel, and conversion of temporary local fixtures via the Python helper without uploading or changing case data. Report OS, Node/npm/Python versions, startup/runtime logs, the resolved SQLite path and observed API/UI behavior. Do not transfer Replit data. See `docs/project/05-workflow.md` for the full handoff contract.

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
