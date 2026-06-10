# 08 — Cleanup Roadmap

> Generated 2026-06-10 from audits 01–07. This is a **plan for manual review** —
> nothing here has been executed. Effort: S (<½ day) · M (½–2 days) · L (2–5 days).
> Risk: how likely the change is to break behavior if done carelessly.

## Guiding observations

- The codebase is disciplined where it's thin (services, validation, types) and
  messy where it's thick (`DocumentViewPanel.tsx`, `globals.css`).
- One **correctness bug** outranks all cleanup: the migration ordering issue (P1.1).
- Phase 1 is deliberately "boring": deletions and extractions with no behavior
  change, safe to do in one or two PRs. Phase 2 changes code paths but not
  features. Phase 3 changes architecture and data.

---

## Phase 1 — Safe Cleanup (no behavior change intended)

| # | Task | Source | Effort | Benefit | Risk |
|---|---|---|---|---|---|
| 1.1 | **Fix migration ordering**: make `20260610_document_annotations` sort before `20260610_annotation_highlight_color` (rename with proper timestamps or squash); verify `prisma migrate deploy` against a scratch DB | 06-H1 | S | Fresh installs/deploys stop failing — currently broken | LOW (verify against scratch + existing DB; never edit applied migration *contents*) |
| 1.2 | Delete `DocumentViewPanel.tsx.bak` and `globals.css.bak-header-cleanup`; remove `.gitkeep` files from non-empty dirs; delete or populate the 7 empty placeholder dirs | 03 §1 | S | −100 KB noise; no more confusion about which file is live | NONE |
| 1.3 | Extract shared API helpers (`readJson`, `validationErrorResponse`, `isNotFoundError`) into `src/lib/api/http.ts` and use them in all ~10 routes; standardize the error response shape while doing it | 03-D1, 02-A4 | M | ~10 copies → 1; error shape drift ends | LOW (mechanical; client reads `error` field which stays) |
| 1.4 | Centralize pin/highlight color constants in `src/lib/constants/annotationColors.ts` (replaces 4 duplicated lists) | 03-D5 | S | One source of truth for palettes | NONE |
| 1.5 | Add Zod schemas for the 3 unvalidated PATCH routes (`documents/[id]`, `document-annotations/[id]`, `document-pins/[id]`), with bounds on offsets | 02-A2, 07-S4 | S | Closes the only validation gap; deletes hand-rolled checks | LOW |
| 1.6 | Add path-containment check in `documents/[documentId]/original` (resolved path must stay under `data/uploads/`) | 07-S2 | S | Defense-in-depth vs arbitrary file read | NONE |
| 1.7 | Move source-link utilities out of `ThreePanelWorkspace.tsx` into `src/lib/journal/sourceLinks.ts` | 02-A3 | S | −70 lines from the shell component; testable pure functions | NONE |
| 1.8 | Document the single-user/no-auth assumption (README + comment at the API layer); add a production-start warning | 07-S1 | S | Prevents catastrophic accidental public deployment | NONE |
| 1.9 | Pass a minimal env to the markitdown subprocess; mask Python stderr in client-facing `processing_error` | 07-S8/S7 | S | Stops leaking env/paths | LOW |
| 1.10 | Decide fate of `evidenceStateService.ts` (mark TODO with tracking, or remove the no-op calls) and of `extraction.ts` vs markitdown fallback (document the contract) | 03 §1 | S | Removes silent fake features | LOW |

**Phase 1 total: ~2–3 days. Recommended single milestone; everything is reviewable in small PRs.**

---

## Phase 2 — Refactor (behavior-preserving, needs verification)

| # | Task | Source | Effort | Benefit | Risk |
|---|---|---|---|---|---|
| 2.1 | **Consolidate `globals.css`**: merge the ~77 duplicate selectors (fold later overrides into one definition, drop dead `!important` layers), then split into `tokens.css` / `base.css` / per-feature files; promote repeated hex colors to tokens | 03-C1/C2 | L | The single largest maintainability win; unblocks any future theming/UI work | **MEDIUM-HIGH** — cascade-order sensitive; do per-panel with before/after screenshots |
| 2.2 | **Performance pass on the viewer (pre-decomposition)**: `useMemo` the highlight render (04-H2); keep note/pin drafts local until blur (04-H3); rAF-batch pin drag + scroll measurement (04-H1/H4/M3) | 04 | M | Removes per-keystroke and per-pixel full-document re-renders — the bulk of felt jank | MEDIUM (drag/selection edge cases; test with a large annotated doc) |
| 2.3 | Split list vs detail Prisma selects so list endpoints stop shipping `extracted_text`/processed text | 04-H6 | S | Multi-MB payload → KB; trivial | LOW (check no list consumer reads the text fields) |
| 2.4 | Introduce `src/lib/apiClient.ts` + `useFetch` hook; replace the ~10 hand-rolled fetch/state blocks and ~20 ad-hoc response types | 02-A5, 03-D2/D3 | M | −several hundred lines; consistent error handling; removes most `as` casts | MEDIUM (touches every component's data path; migrate one panel at a time) |
| 2.5 | UI consistency pass: loading-spinner primitive applied everywhere (05-X1); one button system with consistent disabled/focus states (05-X3/X4/X6); fix `.notebook-inline-error` color (05-X5); `aria-pressed` on viewer tools + `aria-selected` on right-panel tabs | 05 | M | Biggest perceived-quality and a11y jump available | LOW-MEDIUM (visual review needed; pairs naturally with 2.1) |
| 2.6 | Consolidate to one icon library (lucide) and remove `@heroicons/react` | 05-X8, 01 | S | −1 dependency, visual consistency | LOW |
| 2.7 | Add confirmation dialogs for destructive actions (goal archive, doc unlink/delete) and success feedback for upload/suggestion-approve | 05 | M | Closes the worst UX traps | LOW |
| 2.8 | Wire `npm run typecheck` (and ideally a smoke `next build`) into CI / pre-commit — the project currently has zero automated gates, which is what makes Phases 2–3 risky | 03 §7 | S | Safety net for everything else in this roadmap | NONE |

**Phase 2 total: ~2 weeks. Do 2.8 first, 2.1 and 2.5 together, 2.2 before or as part of 3.1.**

---

## Phase 3 — Architecture Improvements (feature-level changes)

| # | Task | Source | Effort | Benefit | Risk |
|---|---|---|---|---|---|
| 3.1 | **Decompose `DocumentViewPanel.tsx`** (2,052 lines → orchestrator + HighlightLayer, PinLayer, NoteEditor, PinEditor, AnnotationToolbar, ColorPalette, OriginalFileWindow + selection/offset hooks). Memoization boundaries from 04 fall out naturally. Add `next/dynamic` import for the viewer (04-M8) | 02-A1, 03 §6, 04 | L | Velocity: viewer features stop being edits to a monolith; perf boundaries become enforceable | **HIGH** — most intricate logic in the app (offsets, drag, selection); decompose incrementally, one layer per PR, manual test script per feature |
| 3.2 | Merge `DocumentPin` into `DocumentAnnotation` (`annotation_type: 'pin'`), consolidating two services, two route families, and two client paths; includes data migration | 06-M4 | L | Halves the annotation-feature surface forever | HIGH (data migration + API change; do after 3.1 so client code is already modular) |
| 3.3 | Document-text column cleanup: drop the unused one of `extracted_text`/`processed_text`/`processed_markdown`, resolve `validation_status` (implement or drop), add `updated_at` to Document | 06-M2/M3/L3 | M | Leaner rows, honest schema | MEDIUM (migration; verify all readers) |
| 3.4 | Pagination + bounded context: `take`-limited message/journal queries, cursor pagination in chat, curated `buildChatContext` — **prerequisite for real LLM integration** (token costs) | 04-H5 | M | Unbounded growth → bounded; LLM-ready | MEDIUM |
| 3.5 | Real AI integration behind the existing seam (`mockChatAI.ts` swap; prompts into `src/lib/ai/prompts/`), keeping Zod validation of suggestion JSON | 02-A8 | L | The product's actual point | MEDIUM (new failure modes: timeouts, malformed output — the Zod seam already guards the latter) |
| 3.6 | Responsive strategy: either implement stacked breakpoints or an explicit "desktop required" gate | 05-X2 | M | Deliberate behavior instead of silent breakage | LOW |
| 3.7 | If (and only if) multi-user/hosted is ever planned: auth layer + per-case ownership checks in services (07-S1/S3), rate limiting (07-S5), Postgres + object storage (06) | 07, 06 | L+ | Required for any exposure | HIGH — treat as a project, not a cleanup task |

---

## Suggested sequencing

```
Week 1      Phase 1 (1.1 first — it's a live bug), + 2.8 (CI gate)
Weeks 2–3   2.1 CSS consolidation  ∥  2.3, 2.6 (trivial wins)
            2.5 + 2.7 UI pass (on top of clean CSS)
            2.2 viewer perf fixes
Weeks 4–6   2.4 apiClient/hook migration (panel by panel)
            3.1 viewer decomposition (layer by layer)
Then        3.4 → 3.5 (pagination before real AI), 3.2/3.3 schema work, 3.6
```

## Top 5 by value-for-effort

1. **1.1** migration ordering fix — S effort, removes a hard deploy blocker.
2. **1.3 + 1.5** API helpers + missing Zod — S/M, fixes architecture, quality, and security findings at once.
3. **2.3** list-vs-detail selects — S, eliminates multi-MB payloads.
4. **2.2** viewer memoization/rAF batching — M, removes almost all interaction jank.
5. **2.1** CSS consolidation — L, but everything UI-related gets cheaper afterward.
