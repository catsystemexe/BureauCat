# BureauCat — Development Workflow

## Purpose

Keep product reasoning, implementation and project documentation synchronized without mixing design, coding and runtime investigation unnecessarily.

## System roles

- **GitHub** — implementation source of truth and canonical versioned project documentation under `docs/project/`.
- **Google Drive** — synchronized human-readable/project-source mirror plus non-canonical audits/working materials.
- **Replit Free** — runtime, Shell and manual UI verification environment.
- **ChatGPT Project** — Designer/Coding reasoning and implementation orchestration.
- **Replit Agent/connector** — optional accelerator only; never a required path.

## DESIGNER MODE

Use for product logic, UX, information architecture, domain modeling, architecture, roadmap and specification.

Rules:

- Do not modify repository code.
- Inspect GitHub read-only when current implementation materially affects the decision.
- Separate current state, interpretation, proposal and unresolved questions.
- Prefer explicit trade-offs.
- Material decisions update Decisions and, when affected, Architecture/Backlog.
- Do not turn every design discussion into implementation.

## CODING MODE

Use for repository inspection, implementation, debugging, migrations and verification.

Default cycle:

`INSPECT → PLAN → PATCH → STATIC VERIFY → RUNTIME VERIFY IF NEEDED → PRESERVE → DOC UPDATE/SYNC`

### INSPECT

- Read the actual target branch and relevant files.
- Do not assume `main` is latest.
- Check whether the requested behavior already exists or is partially implemented.
- Minimize change radius.
- Preserve rescue work.

### PLAN

- Define the smallest coherent patch.
- Identify affected contracts.
- Define static and runtime verification needs before patching.

### PATCH

- Change only the approved working branch or another explicitly approved branch.
- Do not automatically write to `main`.
- Do not use rescue as an expendable implementation branch.

### STATIC VERIFY

Use repository/static evidence first, as applicable:

- diff review;
- TypeScript/static analysis;
- Prisma validate/generate;
- build;
- task-specific tests/checks.

### RUNTIME VERIFY IF NEEDED

Use Replit Free only for evidence GitHub cannot reliably provide:

- runtime logs;
- environment-specific behavior;
- SQLite/Prisma runtime behavior;
- document conversion/runtime dependencies;
- manual UI verification.

Prefer one targeted Shell diagnostic block over repeated exploratory commands.

### PRESERVE

Meaningful implementation is incomplete until the verified change is preserved in GitHub.

### DOC UPDATE / SYNC

Update canonical documentation only when the change modifies documented truth. Do not create documentation churn for minor visual/implementation changes.

After canonical GitHub documentation changes, synchronize the corresponding Drive mirror according to BC-006.

## Branch / preservation rules

- `rescue/replit-2026-08-18` is preserved history/baseline.
- Active development currently uses `work/workflow-foundation-v01`.
- Before syncing/running Replit, verify branch and git status.
- If Replit and GitHub disagree, inspect divergence before pull/reset/merge.

## Designer → Coding handoff

A design item becomes Coding work when its contract is stable enough for a Ready backlog item. Use the backlog ID as the implementation handle when practical. Coding should not reopen settled product questions unless code evidence exposes a contradiction/blocker.

## Documentation update matrix

- **Project State** — actual baseline, active development lineage, major capability state.
- **Architecture** — domain ownership, data flow, major boundaries.
- **Roadmap** — milestone/priority sequencing.
- **Backlog** — meaningful implementation/verification state.
- **Decisions** — material product/architecture/operating decisions; preserve superseded history.
- **Workflow** — development process changes.
- **GPT Project Instructions** — source priority, mode rules, operating constraints.
- **Detailed contracts** — only when the contract itself changes.

## Completion standard

A feature is not Done merely because code was edited. Done means implementation is preserved in GitHub, appropriate verification passes, runtime behavior is verified where relevant, and affected canonical documentation is current.
