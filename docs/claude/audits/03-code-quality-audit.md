# 03 — Code Quality Audit

> Read-only audit, generated 2026-06-10. Line numbers are approximate.
> Format per finding: **file · location · severity · recommendation**.

## Positive baseline (worth stating first)

- Zero `: any` / `as any` in the codebase; `tsconfig.json` has `strict: true`.
- Zero TODO/FIXME/HACK comments and essentially no commented-out code.
- Only 2 `console.error` calls, both legitimate API error logging.
- All Zod schemas use `.strict()`.
- Terminology `case` vs `situation` is used consistently; API JSON is consistently
  snake_case, TS identifiers consistently camelCase.

The quality problems are concentrated in **duplication** (API helpers, CSS) and
**file size** (DocumentViewPanel, globals.css), not in sloppiness.

## 1. Dead code & stale artifacts

| Finding | File / location | Severity | Recommendation |
|---|---|---|---|
| Backup file committed (≈59 KB), unreferenced | `src/components/documents/DocumentViewPanel.tsx.bak` | MEDIUM | Delete; git history is the backup |
| Backup file committed (≈42 KB), unreferenced | `src/app/globals.css.bak-header-cleanup` | MEDIUM | Delete |
| Placeholder service: both functions fetch and do nothing, yet are called from `documents.ts:55`, `journal.ts`, `suggestions.ts:160` | `src/lib/services/evidenceStateService.ts:11-29` | MEDIUM | Mark as explicit TODO with tracking, or remove call sites until implemented |
| Two parallel document-processing paths: `extractDocumentText()` (txt/md/rtf, 10 KB limit) kept as fallback beside the markitdown pipeline | `src/lib/documents/extraction.ts` vs `markitdown.ts` | MEDIUM | Decide the end state; document the fallback contract or retire `extraction.ts` |
| 26 `.gitkeep` files, all in directories that now contain real files (plus 7 truly empty placeholder dirs — see report 02 L1) | `src/app/api/**`, `src/components/**`, `src/lib/**` | LOW | Remove `.gitkeep`s from non-empty dirs; delete or populate empty dirs |
| `DocumentAnnotationType` includes `"issue"` which is never created anywhere | `src/components/types.ts:145` | LOW | Remove or implement |

## 2. Duplicate code

### 🔴 D1. API route helpers copy-pasted across ~10 route files — HIGH
`validationErrorResponse()`, `readJson()`, and `isNotFoundError()` (Prisma
P2025 check) are re-declared with identical or near-identical bodies in at
least: `api/goals/[goalId]/route.ts:10-15`, `api/journal/[journalItemId]/route.ts:14-19`,
`api/cases/route.ts`, `api/cases/[caseId]/route.ts`, `api/cases/[caseId]/situations/route.ts`,
`api/cases/[caseId]/chat/route.ts`, `api/situations/[situationId]/route.ts`,
`api/situations/[situationId]/goals/route.ts`, `api/suggestions/[suggestionId]/approve/route.ts`, …
The variants have drifted slightly (different error shapes — see report 02 A4).

**Recommendation:** one `src/lib/api/http.ts` exporting these three helpers;
mechanical replacement, ~80 lines saved per audit of 10 files, and it fixes the
error-shape drift at the same time.

### 🟠 D2. Component fetch boilerplate — MEDIUM
The `useState(items/isLoading/error)` + `useEffect` + `let isActive = true`
pattern is duplicated in `DocumentList.tsx:30-71`, `ChatPanel.tsx:93-140`,
`JournalPanel.tsx`, `GoalsSection.tsx:15-72`, `SituationPager.tsx`,
`SituationDocumentsSection.tsx`, `DocumentViewPanel.tsx:176-191`, `DocumentUpload.tsx:46-102`.
**Recommendation:** extract a `useFetch`/`useAsyncData` hook (see report 02 A5).

### 🟠 D3. Per-component API response types (~20 declarations) — MEDIUM
Each component re-declares `{ thing?: T; error?: string }` shapes
(`ChatPanel.tsx:20-31`, `DocumentViewPanel.tsx:28-63`, `DocumentList.tsx:6-8`,
`DocumentUpload.tsx:14-16`, …). **Recommendation:** central `src/lib/api/types.ts`
with a generic `ApiResponse<T>`.

### 🟠 D4. Service-layer CRUD boilerplate — MEDIUM
`goals.ts`, `situations.ts`, `journal.ts` repeat the same
select-object + `findMany(orderBy display_order)` + create-with-max-display_order
pattern. **Recommendation:** lower priority than D1–D3; a small shared
`nextDisplayOrder(tx, model, where)` helper captures most of the duplication
without a heavyweight generic-CRUD abstraction.

### 🟠 D5. Color allow-lists duplicated 4× — MEDIUM
Pin colors in `api/document-pins/[pinId]/route.ts:10` and
`api/documents/[documentId]/pins/route.ts:11`; highlight colors in
`api/documents/[documentId]/annotations/route.ts:18` and
`DocumentViewPanel.tsx:65-72`. **Recommendation:** `src/lib/constants/annotationColors.ts`,
imported by both routes, validation, and the UI palette.

## 3. Duplicate CSS — `src/app/globals.css` (4,904 lines)

### 🔴 C1. ~77 selectors defined 2–8 times, several mutually conflicting — HIGH
Confirmed duplicates include:

- `.chat-panel` — 3 definitions (lines ≈227, 422, 2265) with conflicting
  `justify-content` plus a later `padding-top: 0 !important` override.
- `.document-validation-toggle` — **8 definitions** (≈2706, 2873, 2898, 2947,
  2961, 3055, …) layering conflicting heights/paddings with `!important`.
- `.document-highlight-palette` — defined at ≈3594, then `display: none !important`
  at ≈3763 (one of the two is dead).
- ~50 further `.document-*` duplicates, `.right-panel-*` (10+), `.journal-panel`,
  `.context-panel`, `.chat-panel-body` (2× each).

The file reads as append-only: later sections override earlier ones with
`!important` rather than editing them. The committed
`globals.css.bak-header-cleanup` confirms an aborted cleanup attempt.

**Recommendation:** consolidate duplicates (last-wins rules folded into the
first definition), then split into layered files (`tokens.css`, `base.css`,
`components/*.css`) or adopt CSS Modules per component. Do this with visual
spot-checks per panel; it's the riskiest cleanup in this report (Phase 2).

### 🟠 C2. Hardcoded colors bypass the token system — MEDIUM
`:root` tokens exist (`--accent`, `--muted`, …; ~115 `var()` uses), but the file
also contains ~48× `#ffffff`, 29× `#0869d7`, 14× `#ef4444`, 34 rgba literals;
TSX adds hardcoded palettes (`DocumentViewPanel.tsx:65-88`, evidence-badge
greens). **Recommendation:** promote recurring literals to tokens; one-time
mechanical sweep.

### 🟡 C3. Naming convention is ad-hoc — LOW
Prefix-based (`.document-…`, `.journal-…`, `.notebook-…`, `.right-panel-…`) but
not a formal system; fine if duplicates are removed, but pick a convention
(BEM-ish) before the CSS split.

(Spot-check of ~30 suspicious class names found **no** unused classes — dead-CSS
risk is in the duplicate/overridden definitions, not orphan selectors.)

## 4. Unused state / functions

A close pass over `DocumentViewPanel.tsx` (26 `useState` + 5 refs, 38 inner
functions), `ThreePanelWorkspace.tsx`, `JournalPanel.tsx`, `ChatPanel.tsx`
found **no dead state, props, or unreachable functions** — everything is wired.
The problem is concentration, not waste. One pass-through wrapper exists
(`MiddleChatPanel`, `ThreePanelWorkspace.tsx:184-192`) — harmless (LOW).

## 5. Naming inconsistencies

| Finding | Location | Severity | Recommendation |
|---|---|---|---|
| Pins rendered with lucide `Bookmark` icon; feature is "pins" everywhere else (`DocumentPin`, `/api/document-pins`) | `DocumentViewPanel.tsx:14` + usage ≈1800 | LOW | Use `Pin`/`MapPin` icon or rename consistently; also decide the user-facing word (pin vs bookmark) once |
| Two icon libraries: heroicons (journal/workspace) vs lucide (document viewer) | package.json; `JournalPanel.tsx:10-15` vs `DocumentViewPanel.tsx:6-18` | MEDIUM | Standardize on one (lucide covers all current needs); drop the other dependency |
| `annotation` vs `note` vs `highlight`: DB has one table with `annotation_type`, UI splits notes/highlights, pins are a separate table | schema + viewer | LOW | Terminology is workable; document the mapping (and see report 06 M4 for the table merge) |
| UI strings are Czech, code/comments English — intentional; but strings are hardcoded in components in addition to `src/lib/constants/uiLabels.ts` | components throughout | LOW | Route all user-facing strings through `uiLabels.ts` so the convention holds |
| Migration folder naming inconsistent/malformed | `prisma/migrations/` | HIGH (correctness, see report 06 H1) | Fix via proper `prisma migrate dev` naming |

## 6. Overly large files / functions

| File | Lines | Severity | Notes |
|---|---|---|---|
| `src/app/globals.css` | 4,904 | HIGH | See C1 |
| `src/components/documents/DocumentViewPanel.tsx` | 2,052 | HIGH | Render JSX alone spans ≈1230–2052; split per report 02 A1 |
| `src/components/ThreePanelWorkspace.tsx` | 570 | MEDIUM | 3 components + utility functions in one file |
| `src/components/journal/JournalPanel.tsx` | 353 | MEDIUM | SituationCard could be its own file |
| `src/components/journal/GoalsSection.tsx` | 320 | MEDIUM | acceptable, watch growth |
| `src/components/chat/ChatPanel.tsx` | 301 | MEDIUM | acceptable |

Oversized functions (all in `DocumentViewPanel.tsx`): `handleDocumentTextMouseUp`
(≈1096–1170, selection logic — extract pure `getSelectionOffsets()`),
`createAnnotationFromOffsets` (≈556–624), `createPinAtOffsets` (≈734–782),
plus the ~800-line JSX return. Service functions are all <100 lines (good).

## 7. Type quality

- `src/components/types.ts` mirrors Prisma models by hand — no drift today, but
  nothing enforces sync (MEDIUM). Options: derive from service return types
  (`Awaited<ReturnType<typeof getCaseById>>`) or accept manual sync and add a
  comment stating the source of truth.
- Type assertions are limited to API-response casts (`as XxxResponse`) —
  acceptable; a typed apiClient (report 02 A5) would remove most of them.
- `npm run typecheck` could not be run in this audit environment
  (node_modules not installed); recommend wiring it into CI/pre-commit since
  it's the only automated check the project has.

## Top refactoring opportunities (feeds report 08)

1. **Extract shared API helpers** (D1) — high value, near-zero risk.
2. **Delete stale artifacts** (`.bak` files, stray `.gitkeep`s) — trivial.
3. **Consolidate duplicate CSS selectors, then split the file** (C1) — high value, needs visual verification.
4. **Centralize colors and API response types** (D5, D3) — small, unlocks consistency.
5. **Decompose DocumentViewPanel** — the big one; do after 1–4 so the new files start clean.
