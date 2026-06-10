# 04 — Performance Audit

> Read-only audit, generated 2026-06-10. Line numbers are approximate.
> The dominant hotspot is `src/components/documents/DocumentViewPanel.tsx`
> (viewer + highlights + notes + pins + drag in one component): almost any state
> change there re-renders the entire annotated document.

## 🔴 HIGH

### H1. Pin drag causes layout thrash on every pointer move
`DocumentViewPanel.tsx:1766-1836` — the `onPointerMove` handler runs, per event:
`getTextOffsetFromPoint()` (caret-from-point APIs), `getTextNodeAtOffset()`
(a fresh `document.createTreeWalker` walk, see also :626-646), multiple
`getBoundingClientRect()` calls (:1791-1799), and `getComputedStyle` (:1794) —
unthrottled, interleaved with state writes. Classic read–write–read layout
thrash; pin dragging cannot hold 60fps on large documents.

**Fix:** batch all measurements inside one `requestAnimationFrame` per frame;
cache static measurements (container rect, line height) at drag start.

### H2. Highlight/note rendering recomputed on every render, unmemoized
`DocumentViewPanel.tsx:328-477` — `renderDisplayTextWithHighlights` filters and
sorts the annotation list multiple times, does `displayText.indexOf(...)` (O(n)
string scans) per legacy annotation, builds marker sets, and constructs the full
React element array for the whole document — and it is invoked inline at :1739,
so **every** keystroke in a note editor or pin hover re-runs it.

**Fix:** `useMemo` keyed on `[annotations, displayText]`; longer-term, split the
document into stable paragraph chunks so one annotation change doesn't rebuild
every node.

### H3. Per-keystroke double state updates in note/pin editors
- Pin note typing (:1998-2005) calls `setPinNote(...)` **and** `setPins(map over
  all pins)` per keystroke; same pattern for pin color (:1960-1967).
- Annotation note typing (:1583-1597) updates `annotationNote`, maps the whole
  `annotations` array, and schedules a textarea resize per keystroke.

Combined with H2 (unmemoized full-document render), typing in a note re-renders
the entire annotated document per character.

**Fix:** keep draft text purely local (or in a ref) while typing; write into the
`pins`/`annotations` arrays only on blur/save.

### H4. `measurePinPositions` re-measures all pins too often, incl. raw scroll
`DocumentViewPanel.tsx:193-195, 657-672, 1732` — loops all pins calling
`getBoundingClientRect()` per pin; re-triggered on `pins`, `displayText`,
`isEditing`, `isFullscreen` changes **and** wired directly to `onScroll`
(:1732) with no throttle and no `isPinDragging` guard.

**Fix:** rAF-throttle the scroll path; skip while dragging; measure only
changed pins where possible.

### H5. Chat context and message list grow unbounded
`src/lib/services/chat.ts:71-77` loads **all** ChatMessages for the case;
`buildChatContext` (:111-132) loads **all** JournalItems and **all** Documents
on every send, serializing them into the context string. Client side,
`ChatPanel.tsx:93-140` fetches the full list each refresh. Costs grow O(n) with
case size — and will translate directly into token costs once the mock AI is
replaced by a real LLM.

**Fix:** `take`-limit queries (e.g. last 50 messages), cursor pagination, and a
bounded/curated context builder.

### H6. List endpoints ship full document text
`src/lib/services/documents.ts:9-24` — the shared `documentSelect` includes
`extracted_text` (and processed text fields) and is used by list queries
(`listForCase`, ~:64). One case with a few large PDFs means multi-MB JSON
payloads for the sidebar list, re-fetched on every refresh-key bump.

**Fix:** separate `documentListSelect` (metadata only) from `documentDetailSelect`.

## 🟠 MEDIUM

| # | Finding | Location | Fix |
|---|---|---|---|
| M1 | O(annotations × breakpoints) marker filtering — `noteMarkers.filter(...)` inside the segment loop | `DocumentViewPanel.tsx:409-473` | pre-index markers in a `Map<offset, marker[]>` |
| M2 | `createTreeWalker` DOM walk per offset lookup, also used during click + annotation creation | `DocumentViewPanel.tsx:626-646, 479-517` | cache text-node index per `displayText` version |
| M3 | Original-file window drag/resize: `setOriginalWindow` per pointer-move, unthrottled | `DocumentViewPanel.tsx:1041-1081` | rAF throttle or CSS transform while dragging |
| M4 | Inline style objects/handlers recreated per render (highlight spans, note markers, palettes, pin layer) | `DocumentViewPanel.tsx:399, 433, 467, 1486-1489, 1571, 1688, 1901` | extract memoized subcomponents; move static styles to CSS |
| M5 | `openDocument` not wrapped in `useCallback`, passed to three panels → broad re-renders | `ThreePanelWorkspace.tsx:501-520` | `useCallback`; memoize panel children |
| M6 | Refresh-key pattern refetches whole lists after every mutation (no optimistic update, no cache) | `ThreePanelWorkspace.tsx:523-529` + consumers | acceptable for MVP; revisit with apiClient/hook work (report 02 A5/A6) |
| M7 | Mouse/touch `document.addEventListener` without `passive` | `ThreePanelWorkspace.tsx:359-360`, `DocumentViewPanel.tsx:252` | `{ passive: true }` where handlers don't preventDefault |
| M8 | No `next/dynamic` for the heavy viewer — 2k-line component (plus lucide icons) in the initial workspace bundle | `src/app/cases/[caseId]/page.tsx` + imports | `dynamic(() => import("./DocumentViewPanel"), { ssr: false })` |
| M9 | `page.tsx` for the workspace is `"use client"` — nothing on the page is server-rendered, initial data needs a client fetch waterfall | `src/app/cases/[caseId]/page.tsx` | server-render shell + initial case payload |

## 🟡 LOW

- **L1.** Escape-key listener effect re-subscribes on every `isAnnotationNoteOpen`/`editingAnnotationId` change (`DocumentViewPanel.tsx:241-254`) — harmless but churny; use a ref for current state.
- **L2.** Index-based React keys for highlight segments (`highlight-${index}-${start}`, :398) — fragile if annotations reorder; key by annotation id.
- **L3.** `getSentenceRangeAtOffset` recompiles/evaluates regex per character traversal (:519-553) — click-time only; hoist the regex.
- **L4.** `getPinNumber()` re-sorts the pins array per rendered pin (:680-684) — precompute a sorted index map.
- **L5.** No N+1 query patterns found in services (good); the data-layer issues are over-fetching (H5/H6), not query counts.

## Suggested attack order

1. **H2 + H3** (memoize document rendering; localize editor drafts) — biggest perceived win: typing and hovering stop re-rendering the document.
2. **H1 + H4 + M3** (rAF-batch all drag/scroll measurement) — smooth pins.
3. **H6** (split list vs detail selects) — trivially small change, large payload win.
4. **H5** (pagination + bounded chat context) — do **before** real LLM integration.
5. **M4/M5/M8** as part of the DocumentViewPanel decomposition (report 02 A1) — extraction naturally creates the memoization boundaries.

Expected effect: items 1–2 remove per-keystroke and per-pixel full-document
re-renders, which is where essentially all current interaction jank originates.
