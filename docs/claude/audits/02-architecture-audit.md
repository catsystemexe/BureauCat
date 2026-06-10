# 02 — Architecture Audit

> Read-only audit, generated 2026-06-10. No source files were modified.

## Overall architecture

The app follows a clean four-layer shape, and the layering is largely respected:

```
Pages (src/app)            server pages are thin; /cases/[caseId]/page.tsx is "use client"
  └─ Client components (src/components) ── raw fetch() ──▶
       API routes (src/app/api/**/route.ts) ── Zod (mostly) ──▶
         Services (src/lib/services/*.ts, explicit Prisma `select`s, transactions) ──▶
           Prisma + SQLite
```

Strengths worth preserving:

- Routes mostly delegate to services; services use explicit `select` objects, so
  raw Prisma client types don't leak into components (client types live in
  `src/components/types.ts`).
- Proper `prisma.$transaction` use for multi-step operations
  (`cases.ts:21-42` case+initial situation, `documentAnnotations.ts:67-109`
  highlight erase/split, `suggestions.ts:122-154` approve→journal item,
  `chat.ts:167-201` message+suggestions).
- Custom domain errors (`SituationDocumentLinkError` in `documents.ts:82-89`,
  `LastActiveSituationError` in `situations.ts:18-23`) caught in routes.
- Zod schemas use `.strict()` and `.refine()` consistently where they exist.

## Findings

### 🔴 HIGH

#### A1. `DocumentViewPanel.tsx` is a god component (2,052 lines)
`src/components/documents/DocumentViewPanel.tsx` owns: document text editing &
PATCHing (≈256-282), annotation CRUD + highlight rendering (≈400 lines), pin
CRUD + drag positioning (≈300 lines), text-selection/offset math, original-file
window drag/resize, three color palettes, an annotation toolbar, and 25+
`useState` variables. Every feature added to the viewer increases coupling.

**Recommendation:** split into orchestrator (~400 lines) + extracted units:
highlight/annotation layer, pin layer, text editor, color palette, note editor —
plus custom hooks for selection/offset logic. This is the single highest-value
refactor in the codebase (Phase 2 in report 08).

#### A2. Business logic and validation inline in routes, bypassing the layers
- `src/app/api/documents/[documentId]/route.ts:26-62` — PATCH handler does
  manual `typeof` checks, a hardcoded `validation_status` allow-list, and an
  `as` cast instead of a Zod schema, then calls Prisma-ish update logic inline
  instead of a `updateDocument()` service.
- `src/app/api/document-pins/[pinId]/route.ts:14` and
  `src/app/api/documents/[documentId]/pins/route.ts:33` — identical pin-color
  allow-lists duplicated in two routes; same pattern for annotations in
  `src/app/api/document-annotations/[annotationId]/route.ts:13`.

**Recommendation:** add `updateDocumentSchema` / `updateAnnotationSchema` /
`updatePinSchema` to `src/lib/validation/`, move color constants to
`src/lib/constants/`, and route all mutations through services. These are the
only routes that break the otherwise consistent pattern.

#### A3. `ThreePanelWorkspace.tsx` mixes shell, state hub, and domain logic
`src/components/ThreePanelWorkspace.tsx` (570 lines) carries ~70 lines of
source-link parsing utilities (lines ≈40-141: `formatSourceLink`,
`parseSourceLinks`, `extractDocumentIdFromValue`…), an embedded `EvidencePanel`
(≈184-305) and `RightContextPanel` (≈307-478), plus 7 cross-panel state
variables and data fetching (`openSourceDocument` ≈506-520 fetches directly).

**Recommendation:** move parsing utilities to
`src/lib/journal/sourceLinks.ts`; promote `EvidencePanel`/`RightContextPanel`
to their own files (the empty `src/components/right-panel/` directory was
evidently created for this and never used).

### 🟠 MEDIUM

#### A4. Inconsistent API conventions
- **Error shapes:** some routes return `{ error, issues }`, others
  `{ error, details: flatten() }`; clients must handle both.
- **JSON body parsing:** three patterns coexist — a `readJson()` helper with
  try/catch, inline `.catch(() => null)`, and unguarded `await req.json()`.
- **URL design:** creation is nested (`/api/documents/[id]/annotations`,
  `/api/documents/[id]/pins`) but item mutation is flat
  (`/api/document-annotations/[annotationId]`, `/api/document-pins/[pinId]`).
  Workable, but undocumented and surprising.
- **Response shapes:** pin/annotation creation returns `{ pin, pins }` /
  `{ annotation, annotations }` (item + full list), while other creates return
  the item only.

**Recommendation:** one shared `apiError(error)` / `readJson()` utility module
and a documented response convention; align routes opportunistically.

#### A5. No client API layer; fetch + state machinery duplicated ~10×
Every component hand-rolls `useState(isLoading/error)` + `useEffect` +
`let isActive = true` cancellation + `if (!response.ok) throw` and re-declares
near-identical `XxxResponse` types (`DocumentList.tsx:6-8, 30-71`,
`ChatPanel.tsx:20-31, 93-140`, `DocumentUpload.tsx:14-16, 46-102`,
`DocumentViewPanel.tsx:28-63, 176-191`).

**Recommendation:** a small typed `src/lib/apiClient.ts` plus a `useFetch`/
`useResource` hook would delete several hundred lines and standardize error
handling. (Adopting React Query/SWR is the heavier alternative; not required at
this size.)

#### A6. Cross-panel state via refresh-key prop drilling
`ThreePanelWorkspace` increments counters (`journalRefreshKey`,
`documentListRefreshKey`, `situationDocumentListRefreshKey`) that descend 3+
levels so children re-fetch on mutation. No optimistic updates, no cache —
every mutation triggers full list refetches.

**Recommendation:** acceptable for the MVP; if panels keep multiplying,
introduce either a workspace context or a query library. Document the refresh-
key convention either way.

#### A7. `evidenceStateService.ts` is a silent placeholder
`src/lib/services/evidenceStateService.ts:11-29` — both functions fetch and do
nothing (no recalculation), yet are called from `documents.ts:55` and
`suggestions.ts:160`, implying a feature (evidence-state recheck) that does not
actually run. No TODO marks this.

**Recommendation:** mark explicitly as unimplemented (TODO + tracking), or
remove the call sites until the feature lands; today it only adds DB reads.

#### A8. AI layer is mocked, but the seam is good
`src/lib/ai/mockChatAI.ts` returns canned replies/suggestions; `chat.ts`,
`suggestions.ts`, `meetingPrep.ts` build the real persistence flow around it.
The seam (suggestion JSON validated by Zod before approval) is the right shape
for swapping in a real LLM. Risk: prompt/context building (`buildChatContext`)
already loads *all* journal items and documents — see report 04 before wiring a
real model. The empty `src/lib/ai/prompts/` directory awaits content.

### 🟡 LOW

- **L1. Empty placeholder directories** — `src/components/{layout,meeting-prep,right-panel,shared,suggestions}`,
  `src/lib/ai/prompts`, `src/lib/constants` (only `uiLabels.ts`): either fill
  them as part of the A1/A3 extractions or delete them.
- **L2. `.bak` files committed** — `DocumentViewPanel.tsx.bak`,
  `globals.css.bak-header-cleanup` (see report 03).
- **L3. Duplicated color constants** — pin colors in two routes, highlight
  colors in route + `DocumentViewPanel.tsx:65-72`.
- **L4. DELETE semantics vary** — `/api/journal/[id]` DELETE soft-deletes
  (marks `obsolete` via `markJournalItemObsolete()`), others hard-delete.
  Intentional, but worth a one-line doc note in the route.

## Architectural risks (summary)

1. **Viewer monolith** (A1) — biggest drag on velocity; every viewer feature
   lands in one 2k-line file with 25+ state atoms.
2. **Validation gaps on document/annotation/pin PATCH routes** (A2) — the one
   place the otherwise solid Zod discipline breaks (also a security finding, see 07).
3. **No auth/tenancy layer anywhere** — every route trusts the caller; fine for
   single-user local use, but it's an architectural assumption that should be
   stated (see report 07).
4. **Refetch-everything data flow** (A5/A6) — correctness is fine, but it bakes
   in over-fetching that gets expensive as cases grow (see report 04).
5. **Two sub-resource API styles** (A4) and **two annotation-ish tables**
   (pins vs annotations, see report 06) — parallel implementations of the same
   concept will keep diverging unless merged deliberately.

## Missing abstractions checklist

| Abstraction | Replaces | Effort |
|---|---|---|
| `src/lib/apiClient.ts` + `useFetch` hook | ~10 hand-rolled fetch blocks + duplicate response types | S–M |
| `src/lib/http.ts` (`readJson`, `apiError`) | 3 JSON-parse patterns, 2 error shapes | S |
| `src/lib/constants/annotationColors.ts` | 4 duplicated color lists | S |
| `src/lib/journal/sourceLinks.ts` | utilities embedded in ThreePanelWorkspace | S |
| Viewer decomposition (components + hooks) | DocumentViewPanel monolith | L |
