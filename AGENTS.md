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

## Work-role contract

BureauCat uses D-023 work stages and the D-024 execution allocation:

`DESIGNER → INSTRUCTIONS → IMPLEMENTATION`

- DESIGNER decides what should change and why; repository access is read-only unless the work has moved to an implementation role.
- INSTRUCTIONS converts approved design into bounded executor-ready work with scope, acceptance criteria and verification expectations.
- IMPLEMENTATION executes the approved batch against actual repository state.

ChatGPT owns planning/instructions. Codex owns code, versioned documentation and static verification. VS agent owns local runtime, environment setup and runtime/API/UI verification. This newer D-024 allocation supersedes the former Replit workflow.

Code mode is a separate repository process/safety overlay for repository-changing work. It is not a fourth peer role. It does not authorize merge, deploy, force-push, branch deletion, destructive reset or history rewrite without explicit authorization.

## Repository rules

- Inspect the actual target branch and relevant files before changing code.
- Do not assume `main` is the latest working state.
- Preserve rescue work; do not overwrite/delete rescue branches without explicit confirmation.
- Prefer incremental changes with the smallest coherent change radius.
- GitHub is the implementation source of truth.
- Local Windows/Linux runtime verification belongs to VS agent.
- Development does not depend on Replit or Replit Agent credits.

## Implementation verification rules

Use the cycle:

`INSPECT → PLAN → PATCH → STATIC VERIFY → RUNTIME VERIFY (when required) → PRESERVE → DOC UPDATE/SYNC`

- **Static verify** uses repository evidence first: diff, typecheck/static analysis, schema/contract inspection, Prisma validation/generation, build, tests where applicable.
- **Runtime verify** is only for evidence requiring the actual environment: logs, env injection, SQLite/Prisma runtime behavior, conversion dependencies, API behavior, manual UI.
- Codex resolves repository/static questions before handing environment-dependent verification to VS agent.

## Local bootstrap / handoff

After a branch switch or schema/dependency-affecting change, verify generated state before diagnosing product code:

1. Verify branch, commit/upstream and `git status`; preserve unknown work.
2. Use `npm ci` when dependency/lockfile state requires a clean reproducible install.
3. Run `npm run prisma:validate` and `npm run prisma:generate` when Prisma state matters.
4. Codex runs static checks and records exact diagnostics/exit codes. Product-code fixes outside the approved batch require a separate task.
5. VS agent prepares the local environment and performs targeted runtime/API/UI checks; see README for local prerequisites and commands.
6. Inspect database/migration state before starting: `dev` and `start` still run `db:deploy` automatically. Do not run migration or startup commands in a batch that prohibits database changes.

Repository npm scripts use `scripts/with-database.cjs` to force `DATABASE_URL=file:../data/bureaucat.sqlite` on Windows and Linux. Prisma resolves that URL relative to `prisma/schema.prisma`, keeping the database at `data/bureaucat.sqlite`. The launcher invokes the installed Next/Prisma JavaScript CLI with Node, preserves arguments/environment and child exit codes, and adds no dependency. Bare Prisma/Next commands do not receive this override.

Update only affected canonical documents. Mark Drive synchronization pending when it is outside the authorized batch; do not claim mirrors are current. Preserve locally when push is prohibited and report remote preservation as pending.

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
