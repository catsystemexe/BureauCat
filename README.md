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

- Node.js compatible with the locked Next.js/Prisma versions and npm (Linux static verification used Node 24.19.0 / npm 11.9.0)
- Python 3 for document conversion
- Runtime Python packages required by `scripts/convert_with_markitdown.py` for the formats you use
- Poppler when PDF rasterization/OCR is required

### Roles and local bootstrap

ChatGPT owns planning/instructions, Codex owns code/versioned docs/static verification, and VS agent owns local runtime/environment/API/UI verification (D-024). This supersedes the former Replit workflow. GitHub remains canonical. On 2026-10-27, ChatGPT synchronized the existing Drive mirrors 00–06 from commit `681fa5b4f1d938dff8b405edda6577e4f4b5cba0`; readback of all seven confirmed exact text equality, with IDs and titles preserved. Only status mirrors 00, 03 and 04 need alignment after this new status commit; that alignment has not been performed.

Check branch, commit and working-tree state before setup. Bootstrap commit `07761fb8e31263b3a4b7605742d2e2ee0252ea40` is preserved in draft [PR #37](https://github.com/catsystemexe/BureauCat/pull/37), base `work/workflow-foundation-v01`. Workflow-initialization repair `4d9a07a002f3e1a1abdcc99a28f1c69c9cc947ad` is preserved on `fix/situation-workflow-initialization` in draft [PR #38](https://github.com/catsystemexe/BureauCat/pull/38), base `chore/windows-local-bootstrap`. Preserve existing local files. If needed, create `.env` from `.env.example` in your editor without overwriting local settings.

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

`MARKITDOWN_PYTHON` selects a Python executable other than the default `python3`. It must be set in the environment of the process launching the application: the Node process running `convertDocumentWithMarkItDown()` reads it and passes its environment to the Python child. Set it in the same shell before `npm run dev`/`npm run start`, or in the launch environment of the editor/service that starts Node. A value set only in a separate test process does not configure the application. The VS agent's test setting was temporary and was not saved persistently; configure it again for normal application startup.

Choose an interpreter with the conversion packages (including `markitdown`, `striprtf`, and, for OCR, `rapidocr_onnxruntime`/`pdf2image`); Poppler executables must be on PATH for PDF rasterization. The reported Windows verification used Python `3.12.10` in an isolated venv outside the repository. OCR was unavailable in that venv because `rapidocr_onnxruntime` was missing.

For example, in PowerShell, before starting the app:

```powershell
$env:MARKITDOWN_PYTHON = 'C:\path\to\python.exe'
npm run dev
```

On Linux:

```bash
export MARKITDOWN_PYTHON=/path/to/python3
npm run dev
```

Legacy `scripts/consolidate_prisma_baseline.sh` requires Bash/Unix tools and changes databases; it is a historical maintenance tool, not a Windows bootstrap prerequisite. The renamed `ma-validate.log` preserves the original `ma:validate` bytes as a historical artifact, not as evidence of a passing Prisma check. Tracked filenames were checked for Windows-invalid characters, device names, trailing spaces/dots and case collisions; use a short checkout path to leave room for generated dependency/build paths.

### Windows verification reported by VS agent

The following results are taken from the VS agent reports supplied for this documentation update; Codex did not rerun these Windows checks:

- Installation from the lockfile, Prisma Client generation and typecheck without incremental cache passed.
- Both Situation creation paths initialized seven Steps, with only `ANALYSIS` `ACTIVE`.
- Ordinary mouse selection passed at 1440×900. Keyboard activation via focus and Enter passed at 544×234, where pointer interaction was blocked by layout clipping. Neither selection changed the persisted active Step.
- TXT, MD, DOCX and text-based PDF conversion passed with Python `3.12.10` in an isolated venv outside the repository.
- The actual `convertDocumentWithMarkItDown()` function was exercised from a Node process through `MARKITDOWN_PYTHON`: `ok=true`, expected marker present, `error=null`, exit `0`.

Limits of this evidence:

- OCR is unavailable: `rapidocr_onnxruntime` is missing. A short PDF whose extracted text has fewer than 50 characters can attempt OCR fallback and suppress its exception; successful conversion does not establish working OCR.
- At viewport `544×234`, navigation has zero height. This is an open UX issue recorded under BC-009/BC-015; no CSS fix is included.
- Literal `Ctrl+C` was not verified.
- Existing Replit data was not imported.
- End-to-end document upload through the application was not tested; direct conversion is a separate check.

BC-009 is recorded as **Done for the approved portable local bootstrap scope**. Final closure confirmation awaits alignment and readback of status mirrors 00, 03 and 04 from this new status commit; the completed 2026-10-27 synchronization covers snapshot `681fa5b4f1d938dff8b405edda6577e4f4b5cba0`, not these newer status changes. This closes neither the application as a whole nor BC-015: the small-viewport UX issue and all evidence limits above remain open. The historical first synchronization remains a separate event. See `docs/project/05-workflow.md` for operating rules.

## MarkItDown support matrix

| Format | Current support |
| --- | --- |
| TXT | Windows conversion passed, reported by VS agent |
| MD | Windows conversion passed, reported by VS agent |
| RTF | Normalized view + external original; no new verification reported |
| DOCX | Windows conversion passed, reported by VS agent |
| PDF | Text-based PDF conversion passed; OCR remains unavailable |
| PNG | Placeholder; OCR unavailable in the verified venv |
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

There is no general `npm test` script. The focused workflow regression runs with `node --test scripts/workflow-initialization.test.cjs`. Primary repository checks are task-dependent and commonly include:

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
