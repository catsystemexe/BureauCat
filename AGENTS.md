# BureauCat — Agent Instructions

## Documentation authority

Canonical project documentation lives in `docs/project/`.

Use this order when resolving project intent:

1. `docs/project/00-project-state.md` and `docs/project/01-architecture.md`;
2. `docs/project/04-decisions.md`;
3. `docs/project/02-roadmap.md` and `docs/project/03-backlog.md`;
4. actual GitHub implementation for what currently exists;
5. detailed active contracts in `docs/project/`;
6. historical specifications/audits;
7. chat/task history.

`docs/bureaucat-mvp-v1.2.md` is historical and must not be treated as current authority.

If intended documentation and implementation disagree materially, surface the mismatch instead of silently assuming either side is correct.

## Current architectural direction

- Do not rewrite BureauCat from scratch.
- `Situation` is the final bounded working unit inside a `Case`; the proposed `List` concept is retired.
- Target direction: `Case → Situation → Goal / Steps / Tasks`, alongside Journal, Documents/Evidence, Case Context, and a first-class Case Timeline.
- Standard Situation workflow: `Analysis → Plan → Collection → Input Validation → Production → Output Review → Execution / Completion`.
- Workflow is adaptive rather than a rigid state machine.
- The user remains authoritative for consequential decisions such as Goal confirmation/material change, Plan acceptance, overrides, final output approval, and confirmation of real-world execution.

## Repository rules

- Inspect the actual target branch and relevant files before changing code.
- Do not assume `main` is the latest working state.
- Preserve rescue work; do not overwrite/delete rescue branches without explicit confirmation.
- Prefer incremental changes with the smallest coherent change radius.
- GitHub is the implementation source of truth.
- Replit is a runtime/Shell/manual UI verification environment, not an implementation authority.
- Development must remain operable with zero Replit Agent credits.
- Replit Agent/connector is optional only.

## Technical expectations

- Prefer TypeScript.
- Keep code and service boundaries simple.
- Use Prisma + SQLite unless an explicit current architecture decision changes that.
- Validate structured AI output before persistence.
- Do not introduce new dependencies without clear reason.
- After meaningful changes, run appropriate static checks and runtime verification where relevant.

## Detailed operating rules

See:

- `docs/project/05-workflow.md`;
- `docs/project/06-gpt-project-instructions.md`;
- `docs/project/07-workflow-persistence-state-contract.md`;
- `docs/project/08-ux-shell-direction.md`.
