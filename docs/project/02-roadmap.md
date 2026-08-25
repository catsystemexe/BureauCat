# BureauCat — Roadmap

## Purpose

This roadmap describes product direction and sequencing. Concrete actionable work belongs in `03-backlog.md`.

## NOW — Consolidate authority and preserve the active foundation

- Keep `rescue/replit-2026-08-18` as the preserved technical baseline.
- Use `work/workflow-foundation-v01` as the active development lineage unless a newer Project State explicitly replaces it.
- Make `docs/project/` the canonical versioned project-documentation set under D-022.
- Keep Google Drive as a synchronized mirror/project-source surface, not an independent normative authority.
- Retain the GitHub-first / Replit-Free operating model.
- Keep Situation as the final bounded working unit; the proposed List concept is retired.
- Treat Situation Workflow Contract v1 as the minimum workflow contract.

## NEXT 1 — Complete the first real workflow vertical slice

Build on the already implemented workflow persistence, Case Context exposure and UX shell foundation.

- Complete D-014 source-grounded Analysis → Journal projection semantics.
- Add Goal Candidate Resolver and user Goal confirmation.
- Implement minimal accepted Plan with Goal-dependent Required Inputs and criteria.
- Implement Collection matching against available evidence / Document Insights.
- Keep Tasks operational and Step-local.
- Resolve the minimum invariant mechanism for one authoritative active Goal and one ACTIVE Step per Situation.

## NEXT 2 — Input Validation and routing

- Implement `READY / NOT_READY / READY_WITH_OVERRIDE`.
- Preserve factual Required Input state when overrides permit progression.
- Stabilize minimum Situation Controller routing and transition rules.
- Preserve downstream history when upstream workflow-relevant content is changed/reopened.
- Define minimum Situation lifecycle semantics required for waiting/completed/superseded/blocked behavior.

## NEXT 3 — Timeline minimum

- Finish Timeline and deadline/term product decisions only to the depth required by real workflow cases.
- Implement Case-owned temporal records for events, deadlines, terms and intervals.
- Preserve optional Situation/Goal/Step/Task/Document associations.
- Keep historical temporal records explicit across Goal changes and superseded Situations.

## NEXT 4 — Production end of the train

After earlier Steps work in practice:

- design Production incrementally from real outputs;
- avoid a speculative universal Template engine;
- implement mandatory Output Review against Goal, Plan, validated inputs and source-grounded context;
- add Execution/Completion checkpoints for real-world actions.

## NEXT — AI / context consolidation

- Stabilize canonical Case Context for Situation Controller and AI capabilities.
- Replace the deterministic chat mock only after context/orchestration contracts are proven.
- Keep Explain/Context Assistance outside the workflow state model.
- Complete remaining insight promotion rules, especially Timeline projection and non-source-grounded AI outputs.

## LATER — Engineering hardening

- Minimal automated tests for domain services, migrations and critical API flows.
- Minimal zero-cost CI/static verification if useful.
- Repository hygiene cleanup after preservation is secure.
- Component decomposition after domain stabilization.
- Shared API contracts and validation cleanup.
- Deployment/auth hardening before non-local or multi-user use.
- Responsive/mobile refinement after desktop information architecture stabilizes.

## Outside current priority

- Generic workflow engine.
- General dependency graph / project-management system.
- Knowledge graph.
- Realtime transcription/audio monitoring.
- Multi-user collaboration.
- Long-term legal matter management.
- Advanced citation-coordinate mapping.
