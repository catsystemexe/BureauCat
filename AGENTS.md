# BureauCat — Agent Instructions

## Documentation authority

`docs/bureaucat-mvp-v1.2.md` is a historical specification. It must not be treated as the current authoritative product specification.

Current project intent is defined by the active BureauCat Project State, Architecture, Decisions, Roadmap/Backlog, Workflow, and project instructions. These documents are being migrated into versioned repository documentation under `docs/project/`.

Until that migration is complete:

- do not infer current product rules from `docs/bureaucat-mvp-v1.2.md`;
- inspect the actual target branch to determine what is currently implemented;
- follow explicit current project/task instructions and active decisions when they are supplied;
- surface material conflicts instead of silently resolving them in favor of the historical MVP.

## Current architectural direction

- Do not rewrite BureauCat from scratch.
- `Situation` is the final bounded working unit inside a `Case`; the proposed `List` concept is retired.
- Target direction: `Case → Situation → Goal / Steps / Tasks`, alongside Journal, Documents/Evidence, Case Context, and a first-class Case Timeline.
- The standard Situation workflow is `Analysis → Plan → Collection → Input Validation → Production → Output Review → Execution / Completion` and is adaptive rather than a rigid state machine.
- The user remains authoritative for consequential decisions such as Goal confirmation/material change, overrides, final output approval, and confirmation of real-world execution.

## Repository rules

- Inspect the actual target branch and relevant files before changing code.
- Do not assume `main` is the latest working state.
- Preserve rescue work; do not overwrite or delete rescue branches without explicit confirmation.
- Prefer incremental changes with the smallest coherent change radius.
- GitHub is the implementation source of truth.
- Replit is a runtime/Shell/manual UI verification environment, not an implementation authority.
- Development must remain operable with zero Replit Agent credits.

## Technical expectations

- Prefer TypeScript.
- Keep code and service boundaries simple.
- Use Prisma + SQLite unless an explicit current architecture decision changes that.
- Validate structured AI output before persistence.
- Do not introduce new dependencies without clear reason.
- After meaningful changes, run appropriate static checks and runtime verification where relevant.
