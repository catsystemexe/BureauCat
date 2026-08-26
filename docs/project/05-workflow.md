# BureauCat — Development Workflow

## Purpose

Keep product reasoning, implementation and project documentation synchronized without mixing design, instruction preparation, repository execution and runtime investigation unnecessarily.

## System roles

- **GitHub** — implementation source of truth and canonical versioned project documentation under `docs/project/`.
- **Google Drive** — synchronized human-readable/project-source mirror plus non-canonical audits/working materials.
- **Replit Free** — runtime, Shell and manual UI verification environment.
- **ChatGPT Project** — design, instruction preparation, implementation orchestration and project-source synthesis.
- **Replit Agent/connector** — optional accelerator only; never a required path.

BureauCat development and verification must remain operable with **zero Replit Agent credits**.

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
- Do not request Replit investigation for questions GitHub can answer.

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

Static verification answers: **Does the repository change appear internally correct without relying on the live Replit runtime?**

Prefer repository/static evidence first, as applicable:

- diff / changed-file review;
- TypeScript/static analysis;
- schema/contract inspection;
- `npm run prisma:validate`;
- `npm run prisma:generate` when Prisma Client state matters;
- `npm run build` when useful;
- task-specific automated checks/tests.

Do not label a Replit-only runtime observation as static verification.

### RUNTIME VERIFY (WHEN REQUIRED)

Runtime verification answers: **Does the verified repository state behave correctly in the actual runtime/environment?**

Use Replit Free only for evidence GitHub cannot reliably provide:

- runtime logs;
- environment variables/runtime injection;
- local SQLite/Prisma behavior;
- environment-specific build/conversion dependencies;
- actual API/runtime behavior;
- manual UI verification.

Prefer **one targeted Shell diagnostic block** over repeated exploratory commands.

### PRESERVE

Meaningful implementation is incomplete until the verified change is preserved in GitHub.

Runtime-only edits are not implementation truth until preserved in GitHub and reconciled with the intended branch.

### DOC UPDATE / SYNC

Update canonical documentation only when the change modifies documented truth. Do not create documentation churn for minor visual/implementation changes.

After canonical GitHub documentation changes, synchronize the corresponding Drive mirror according to BC-006 and D-022.

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
- Before syncing/running Replit, verify branch and git status.
- If Replit and GitHub disagree, inspect divergence before pull/reset/merge.
- Never erase uncommitted/rescue work as a shortcut to synchronization.

## Replit Free post-branch-switch bootstrap

After switching Replit to another branch, or after substantial schema/dependency changes, do not assume generated/runtime state is current.

Use this sequence as applicable:

1. `git branch --show-current`
2. `git status --short`
3. confirm expected upstream/commit when material
4. install dependencies only if lockfile/dependency state requires it (`npm ci` preferred for a clean reproducible install)
5. run `npm run prisma:generate` after Prisma schema/client-affecting branch changes
6. run/inspect migrations when persistence changed (`npm run db:deploy` / appropriate migration checks)
7. start via repository scripts (`npm run dev`)
8. perform the targeted API/runtime/UI verification

Do not blindly run expensive setup when the branch change did not affect that layer.

## Environment / Prisma rule

Repository npm scripts explicitly bind BureauCat to its SQLite URL. Bare commands such as `npx prisma ...` may inherit runtime-provided environment variables (including Replit-managed `DATABASE_URL`).

Therefore:

- prefer repository scripts such as `npm run prisma:validate`, `npm run prisma:generate`, `npm run db:deploy`, `npm run dev`;
- if a bare Prisma command is necessary, explicitly provide the intended SQLite `DATABASE_URL`;
- do not change Prisma provider/database architecture merely to accommodate an unrelated injected runtime variable.

## Connector fallback rule

Replit Agent/connector is **not** a reliability dependency.

If the connector fails or times out once in a way that blocks progress:

1. stop retrying the same connector operation unless there is evidence a retry will help;
2. continue repository inspection/implementation through GitHub;
3. use a deterministic Replit Free Shell command only for the runtime fact that is actually missing;
4. use manual UI verification when needed.

This fallback is the standard zero-credit path, not an exceptional downgrade.

## Handoff rule

A design item becomes implementation work when its contract is stable enough for a Ready backlog item or equivalent bounded instruction batch. Use the backlog ID as the implementation handle when practical.

IMPLEMENTATION should not reopen settled product questions unless repository evidence exposes a contradiction, blocker or unsafe assumption. In that case, surface the issue and return to DESIGNER/INSTRUCTIONS only to the extent required.

## Implementation Profile

For material implementation batches, use when useful:

```text
IMPLEMENTATION PROFILE
Execution environment: <ChatGPT + GitHub | Codex + GitHub | Replit Free verification | ordered combination>
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

A feature or material documentation/workflow change is not Done merely because files were edited. Done means the change is preserved in GitHub, appropriate static verification passes, runtime behavior is verified where relevant, and affected canonical documentation is current/synchronized according to the documentation workflow.
