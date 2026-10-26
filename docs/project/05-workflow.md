# BureauCat — Development Workflow

## Purpose

Keep product reasoning, implementation and project documentation synchronized without mixing design, instruction preparation, repository execution and runtime investigation unnecessarily.

## System roles

- **ChatGPT** — planning, product reasoning and bounded implementation instructions.
- **Codex** — code, versioned documentation and static verification against the actual repository state.
- **VS agent** — local runtime, environment setup and runtime/API/UI verification on Windows or Linux.
- **GitHub** — implementation source of truth and canonical versioned documentation under `docs/project/`.
- **Google Drive** — human-readable/project-source mirror; synchronization of this batch is pending.

This allocation under D-024 supersedes the former Replit runtime workflow. Replit is historical context, not a required development environment. The D-023 work roles remain; they describe stages, while D-024 assigns execution responsibilities.

## Work roles

BureauCat uses three work roles under D-023:

`DESIGNER → INSTRUCTIONS → IMPLEMENTATION`

Code mode is a separate repository process/safety overlay. It is not a fourth peer role.

## DESIGNER

Use for product logic, UX, information architecture, domain modeling, architecture, roadmap and specification.

Rules:

- Do not modify repository code.
- Inspect GitHub read-only when current implementation materially affects the decision.
- Separate current state, interpretation, proposal and unresolved questions.
- Prefer explicit trade-offs.
- Material decisions update Decisions and, when affected, Architecture/Backlog.
- Do not turn every design discussion into implementation.

Primary handoff:

`DESIGNER → INSTRUCTIONS`

## INSTRUCTIONS

Use to convert approved design or an unambiguous implementation request into bounded executor-ready work.

Responsibilities:

- define scope and non-scope;
- identify the target repository/branch/baseline;
- define acceptance criteria;
- assign Change Radius and Verification Level when useful;
- identify static versus runtime verification needs;
- specify execution environment and remote-action authorization;
- identify documentation/tracking impact;
- split large work into coherent batches.

INSTRUCTIONS normally does not execute the batch. It should not reopen settled design unless repository evidence exposes a contradiction, unsafe assumption or blocked dependency.

Primary handoff:

`INSTRUCTIONS → IMPLEMENTATION`

## IMPLEMENTATION

Use for repository inspection, implementation, debugging, migrations and verification.

Default cycle:

`INSPECT → PLAN → PATCH → STATIC VERIFY → RUNTIME VERIFY (when required) → PRESERVE → DOC UPDATE/SYNC`

### INSPECT

Use GitHub first.

- Confirm repository, target branch and relevant commit lineage.
- Read relevant files/schema/migrations/contracts before proposing or applying code changes.
- Do not assume `main` is latest.
- Check whether requested behavior already exists or is partially implemented.
- Minimize change radius.
- Preserve rescue and unknown work.
- Resolve repository/static questions before requesting VS agent runtime investigation.

### PLAN

- Define the smallest coherent patch.
- Identify affected product/architecture contracts.
- Confirm acceptance criteria from the approved instruction batch.
- Define static and runtime verification requirements before patching.

### PATCH

- Change only the approved working branch or another explicitly approved branch.
- Do not automatically write to `main`.
- Do not use rescue as an expendable implementation branch.
- Prefer incremental evolution over broad refactors.

### STATIC VERIFY

Static verification answers: **Does the repository change appear internally correct without relying on the local application runtime?**

Prefer repository/static evidence first, as applicable:

- diff / changed-file review;
- TypeScript/static analysis;
- schema/contract inspection;
- `npm run prisma:validate`;
- `npm run prisma:generate` when Prisma Client state matters;
- `npm run build` when useful;
- task-specific automated checks/tests.

Do not label a runtime-only observation as static verification.

### RUNTIME VERIFY (WHEN REQUIRED)

Runtime verification answers: **Does the verified repository state behave correctly in the actual runtime/environment?**

VS agent owns environment-dependent evidence that repository/static inspection cannot provide:

- runtime logs;
- environment variables/runtime injection;
- local SQLite/Prisma behavior;
- environment-specific build/conversion dependencies;
- actual API/runtime behavior;
- manual UI verification.

Codex provides a concrete handoff with branch/baseline, changed behavior, static results/exit codes, blockers and targeted runtime checks. VS agent reports the local OS, tool versions, logs and observed API/UI behavior.

### PRESERVE

Preserve meaningful implementation in Git according to authorization. If push is prohibited, retain the local branch and reviewable diff; report GitHub preservation as pending rather than pushing or declaring the batch fully Done.

Runtime-only edits are not implementation truth until preserved in GitHub and reconciled with the intended branch.

### DOC UPDATE / SYNC

Update canonical documentation only when the change modifies documented truth. Do not create documentation churn for minor visual/implementation changes.

After canonical documentation changes, synchronize the corresponding Drive mirror according to BC-006 and D-022 when authorized. For this local-only batch, Drive synchronization is pending; do not update mirrors or claim parity.

## Code mode overlay

Code mode applies repository process/safety rules to repository-changing work. It may overlay INSTRUCTIONS or IMPLEMENTATION.

Explicit activation: user writes `Code mode`.

For an unambiguous direct repository-changing implementation request, BureauCat may infer that Code mode protections apply. This does **not** authorize merge, deploy, force-push, branch deletion, destructive reset or history rewrite.

When explicitly active, use the marker:

`[MODE]: Code mode`

followed by the active work role when useful.

Code mode requires:

- identify repository and intended baseline;
- inspect repository-local instructions;
- inspect target branch/snapshot and relevant files;
- protect unknown/rescue work;
- minimize change radius;
- static verify first;
- runtime/visual verify only when needed;
- review final diff/state;
- preserve meaningful work in GitHub according to authorization;
- update canonical documentation where required.

## Branch / preservation rules

- `rescue/replit-2026-08-18` is preserved history/baseline.
- Active development currently uses `work/workflow-foundation-v01`.
- Before local runtime verification, verify branch, commit and git status.
- If local and GitHub state disagree, inspect divergence before pull/reset/merge.
- Never erase uncommitted/rescue work as a shortcut to synchronization.

## Local post-branch-switch bootstrap

After a branch switch or schema/dependency-affecting change, verify generated state before diagnosing product code:

1. Verify branch, commit/upstream and `git status`; preserve unknown work.
2. Use `npm ci` when dependency/lockfile state requires a clean reproducible install.
3. Run `npm run prisma:validate` and `npm run prisma:generate` when Prisma state matters.
4. Codex runs static checks and records exact diagnostics/exit codes. Product-code fixes outside the approved batch require a separate task.
5. VS agent prepares the local environment and performs targeted runtime/API/UI checks; see README for local prerequisites and commands.
6. Inspect database/migration state before starting: `dev` and `start` still run `db:deploy` automatically. Do not run migration or startup commands in a batch that prohibits database changes.

Repository npm scripts use `scripts/with-database.cjs` to force `DATABASE_URL=file:../data/bureaucat.sqlite` on Windows and Linux. Prisma resolves that URL relative to `prisma/schema.prisma`, keeping the database at `data/bureaucat.sqlite`. The launcher invokes the installed Next/Prisma JavaScript CLI with Node, preserves arguments/environment and child exit codes, and adds no dependency. Bare Prisma/Next commands do not receive this override.

## Handoff rule

A design item becomes implementation work when its contract is stable enough for a Ready backlog item or equivalent bounded instruction batch. Use the backlog ID as the implementation handle when practical.

IMPLEMENTATION should not reopen settled product questions unless repository evidence exposes a contradiction, blocker or unsafe assumption. In that case, surface the issue and return to DESIGNER/INSTRUCTIONS only to the extent required.

## Implementation Profile

For material implementation batches, use when useful:

```text
IMPLEMENTATION PROFILE
Execution environment: <ChatGPT planning/instructions | Codex code/docs/static verification | VS agent local runtime verification>
Recommended model: <model or N/A>
Reasoning effort: <effort or N/A>
Change radius: R0 | R1 | R2 | R3 | R4
Verification: V0 | V1 | V2 | V3
Remote actions: <explicit authorization>
Reason: <1–2 concise sentences>
```

BureauCat interpretation:

- R0 — inspection/planning only
- R1 — small local low-coupling patch
- R2 — bounded subsystem / tightly related files
- R3 — cross-subsystem or public/runtime contract
- R4 — architecture/migration/repository-wide/high-blast-radius

- V0 — inspection/review
- V1 — focused static checks
- V2 — broader static checks/build/tests/schema/contracts
- V3 — static + runtime/integration/manual visual verification

## Documentation update matrix

- **Project State** — actual baseline, active development lineage, major capability state.
- **Architecture** — domain ownership, data flow, major boundaries.
- **Roadmap** — milestone/priority sequencing.
- **Backlog** — meaningful implementation/verification state.
- **Decisions** — material product/architecture/operating decisions; preserve superseded history.
- **Workflow** — development process changes.
- **GPT Project Instructions** — source priority, role rules, operating constraints.
- **Detailed contracts** — only when the contract itself changes.

## Completion standard

A feature or material documentation/workflow change is not Done merely because files were edited. Done means the change is preserved in GitHub, appropriate static verification passes, runtime behavior is verified where relevant, and affected canonical documentation is current/synchronized according to the documentation workflow. A local-only handoff must explicitly list pending remote preservation, static blockers, VS agent runtime verification and Drive synchronization; it is not a full Done claim.
