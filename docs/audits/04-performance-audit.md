# 04 — Performance Audit

## Executive assessment

The current data volumes may hide performance problems during MVP use, but the document viewer has structural hot paths that scale poorly with document length, annotation count, pin count, and pointer activity. The principal risk is not React generally; it is the concentration of every document interaction in one component, causing expensive text reconstruction and DOM measurement to run after unrelated state changes.

## HIGH findings

### P-01 — Entire document text is segmented and rebuilt during render

- **Location:** `src/components/documents/DocumentViewPanel.tsx:320-470`.
- **Behavior:** Highlight ranges and note markers are filtered, mapped, searched, sorted, combined into breakpoints, and rendered as a rebuilt sequence of text spans/markers.
- **Why high:** This runs whenever any state in the 2,052-line component changes, including hover state, editor text, colors, window position, and errors. For a long document, each keystroke in a note or drag update can recreate the full document React tree.
- **Recommendation:** Move range normalization to pure functions; memoize derived segments by `[displayText, annotations]`; isolate document text rendering in a memoized component whose props exclude floating-editor and original-window state.

### P-02 — Pin dragging causes React state updates on pointer movement

- **Location:** `DocumentViewPanel.tsx` pin drag handlers around `:620-815`, with `pinPositions` and `isPinDragging` state at `:121-122`.
- **Behavior:** Dragging computes DOM-relative offsets, updates pin positions, and can trigger rerenders while the full document is in the same component.
- **Why high:** Pointer events can fire far faster than React should rebuild annotated text. DOM Range measurement is also used during placement.
- **Recommendation:** Keep transient drag position in refs or direct transform style, throttle visual updates through one `requestAnimationFrame`, and persist/update React state only on drag end.

### P-03 — Pin position measurement performs DOM Range work for all pins

- **Location:** `DocumentViewPanel.tsx:630-708`; effect at `:193-195`.
- **Behavior:** On changes to pins, display text, editing, or fullscreen, every pin is sorted and mapped to a text-node range, followed by `getBoundingClientRect`.
- **Why high:** Range creation and layout reads can force style/layout calculation. The effect is broad and has no resize/scroll strategy visible in its dependency list.
- **Recommendation:** Measure only visible pins, batch reads in one animation frame, avoid remeasurement when only pin note/color changes, and use a `ResizeObserver`/scroll-container event with throttling if positions truly depend on layout.

### P-04 — Document conversion/OCR blocks the upload request

- **Location:** `src/lib/services/documents.ts:26-55`; `src/lib/documents/markitdown.ts:16-71`; `scripts/convert_with_markitdown.py`.
- **Behavior:** Upload waits for file write, Python process, MarkItDown, possible PDF rasterization/OCR, text extraction, DB create, and evidence recheck.
- **Why high:** Large/complex PDFs can consume CPU/memory and hold an HTTP request open. There is no timeout or process-output limit.
- **Recommendation:** Persist the document first with `processing_status`, execute processing through a bounded worker/job abstraction, enforce timeout/resource limits, and let the UI poll or refresh status. If background jobs are deferred, at minimum add a subprocess timeout and strict page/size limits.

### P-05 — Unbounded document/message list reads

- **Location:** `listDocumentsForCase`, `listChatMessagesForCase`, annotation and pin list services.
- **Behavior:** Full collections are returned with no pagination or count limit.
- **Why high over time:** Chat is append-only and document annotations can become numerous. Rendering the full history/list will degrade and increase payloads.
- **Recommendation:** For MVP, add simple bounded windows: recent messages with “load older,” and annotation/pin limits appropriate to the 10,000-character document context. Preserve full database history.

## MEDIUM findings

### P-06 — Chat send performs an extra full-message reload

- **Location:** `src/components/chat/ChatPanel.tsx:153-174`.
- **Behavior:** POST response already includes the assistant message, but the client immediately GETs the entire message collection.
- **Impact:** One additional request and growing payload per message.
- **Recommendation:** Have the POST return both persisted messages needed for append, then append locally; periodically reconcile if required.

### P-07 — Multiple independent document fetch stores

- **Location:** `ThreePanelWorkspace`, `DocumentList`, `SituationDocumentsSection`, `DocumentViewPanel`.
- **Behavior:** Refresh counters trigger separate fetches while selected document state is copied internally.
- **Impact:** Duplicate requests and stale copies after mutations.
- **Recommendation:** Centralize case document invalidation in a small workspace hook and store selected document ID rather than multiple record copies.

### P-08 — Whole `initialDocument` object dependency resets viewer

- **Location:** `DocumentViewPanel.tsx:165-174`.
- **Behavior:** Any new object identity resets edit/original/fullscreen state, even if the document is semantically unchanged.
- **Impact:** Avoidable state churn and disrupted user interaction.
- **Recommendation:** Depend on `initialDocument.id` for full reset and reconcile changed fields intentionally.

### P-09 — Annotation rendering repeatedly filters note markers inside breakpoint iteration

- **Location:** `DocumentViewPanel.tsx:384-459`, particularly marker filters around `:409` and `:443`.
- **Behavior:** Marker arrays are searched per segment/breakpoint.
- **Impact:** Can approach quadratic work as annotations increase.
- **Recommendation:** Pre-group markers by offset in a `Map<number, Marker[]>` during memoized derivation.

### P-10 — Floating editor text changes update large parent state

- **Location:** note/pin textareas around `DocumentViewPanel.tsx:1943-2017` and note editor sections.
- **Behavior:** Every keystroke updates component state and, for pins, maps the full pin array.
- **Impact:** Full document viewer rerenders per keystroke.
- **Recommendation:** Isolate editors into child components with local drafts; commit to parent state/API on debounce, blur, or explicit save.

### P-11 — Pin numbering repeatedly sorts pins

- **Location:** helper around `DocumentViewPanel.tsx:680-688`, then calls during render such as `:1988-1989`.
- **Behavior:** Pin order/number is derived through repeated sorting/search.
- **Impact:** Small today, but avoidable in marker lists and hover/editor render paths.
- **Recommendation:** Derive a memoized `{orderedPins, numberById}` structure once per pin/position change.

### P-12 — Original viewer transform renders oversized content

- **Location:** `DocumentViewPanel.tsx:1394-1427`.
- **Behavior:** Zoom adjusts transform while compensating width/height percentages.
- **Impact:** Browser may rasterize/layout a large iframe/pre surface; fullscreen and resizing can be costly.
- **Recommendation:** Keep transform-only updates outside full component render where possible; apply limits to zoom and window dimensions.

### P-13 — Evidence-state recheck reads data after every document upload and Journal edit

- **Location:** `documents.ts:55`; `journal.ts:36-45`; `evidenceStateService.ts`.
- **Behavior:** Recheck hooks exist, but current service is effectively a read/no-op.
- **Impact:** Extra queries now; future implementation could become an N+1/full-case cost if added naively.
- **Recommendation:** Define a bounded, testable recheck algorithm and run once per transaction/workflow, not once per individual row in loops.

### P-14 — Document annotations apply/erase operations can perform many sequential DB writes

- **Location:** `src/lib/services/documentAnnotations.ts:57-111`.
- **Behavior:** Each overlapping annotation is deleted and up to two fragments are created sequentially inside a transaction.
- **Impact:** Latency grows linearly with overlap count and holds a SQLite write transaction.
- **Recommendation:** Compute all mutations first, then use batched delete/create operations where Prisma/SQLite permits.

## LOW findings

### P-15 — Cheap `useMemo` usage adds complexity without meaningful savings

- **Location:** `SituationPager.tsx:23`; `GoalsSection.tsx:74`; `JournalPanel.tsx:312`.
- **Recommendation:** Keep only if it stabilizes props for memoized children; otherwise direct filter/find expressions are clearer.

### P-16 — Parent rerender used as an invalidation signal

- **Location:** `ThreePanelWorkspace.tsx:481,497-499`.
- **Impact:** It rerenders the entire three-panel workspace without refreshing Journal data.
- **Recommendation:** Replace with explicit data invalidation; this is primarily correctness debt but also wasted work.

### P-17 — Case and case-detail initial data load client-side

- **Location:** `CaseList.tsx`; `src/app/cases/[caseId]/page.tsx`.
- **Impact:** Extra client JS and loading states; no server-rendered first content.
- **Recommendation:** Use server components for initial reads if it does not complicate the MVP.

### P-18 — Global CSS size increases style recalculation/download parsing

- **Location:** `src/app/globals.css` (4,904 lines).
- **Impact:** Modest at current scale but compounds document UI complexity.
- **Recommendation:** Remove dead/overridden rules and scope feature styles after visual tests exist.

## useEffect dependency review

| Effect | Assessment |
|---|---|
| Annotation fetch keyed by `initialDocument.id` | Correct key, but stale request cancellation is absent when switching rapidly |
| Pin fetch keyed by `initialDocument.id` | Same concern |
| Measurement keyed by `[pins, displayText, isEditing, isFullscreen]` | Too broad for pin metadata changes and incomplete for container resize/scroll |
| Initial document synchronization keyed by `[initialDocument]` | Object-identity sensitive and likely too broad |
| Outside-click listener in right panel | Correctly installed only while overlay is open and cleaned up |
| Various loading effects with `isMounted` flags | Prevent state update after unmount, but do not cancel network work |

## Scrolling and rendering risks

- Annotated text is rendered as a potentially large number of inline spans and marker buttons in a `<pre>`.
- Pin positions are maintained separately from document scrolling; comments indicate manual viewport compensation, which is fragile.
- No virtualization is needed for a 10,000-character MVP text cap if the cap is actually enforced in all processed-text paths. Currently `processed_markdown` can exceed that limit.
- Annotation and pin APIs accept offsets without proving they are within the current text, allowing impossible ranges that still participate in client filtering/measurement.

## Recommended measurement plan before optimization

1. Create fixtures at 1k, 10k, and maximum accepted processed-text size.
2. Test with 0/20/100 highlights, notes, and pins.
3. Record React Profiler commits for typing, highlighting, pin dragging, scrolling, and fullscreen toggle.
4. Record browser Performance traces for `getBoundingClientRect`, layout, and paint during pin drag.
5. Set practical budgets, e.g. pointer-frame work under 16 ms and no full text reconstruction for editor-only state changes.
