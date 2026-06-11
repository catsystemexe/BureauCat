# 09 — React Performance Audit

## Findings

### RP-01 — Pin dragging performs multiple synchronous layout reads and multiple React updates per pointer event

- **Severity:** CRITICAL
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:1766-1835`.
- **Explanation:** Every `pointermove` converts the pointer position to a text offset, walks text geometry, creates a DOM `Range`, calls `Range.getBoundingClientRect()`, calls the shell and marker `getBoundingClientRect()`, reads computed line height, then updates `pinPositions`, possibly `pinEditorPosition`, possibly `hoveredPin`, and the full `pins` array. Those state updates rerender the entire 2,052-line `DocumentViewPanel`, including annotated text, every pin, annotation cards, toolbars, and floating editors. The code is not throttled to one update per animation frame.
- **Estimated impact:** **Drag latency:** very high; likely missed frames as text/pin count grows. **Render cost:** very high. **Scrolling:** indirect degradation while a pin is active. **Memory:** moderate transient allocation from object/array recreation and React elements.
- **Fix complexity:** M
- **Recommendation:** During drag, store transient offset/coordinates in refs and update only the dragged marker transform at most once per `requestAnimationFrame`. Perform the final `pins` state update and persistence on pointer-up. Batch all geometry reads before any visual write.

### RP-02 — Annotation text is fully recalculated and rebuilt on every `DocumentViewPanel` render

- **Severity:** CRITICAL
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:328-476`, invoked at `:1739`.
- **Explanation:** `renderDisplayTextWithHighlights()` filters annotations twice, performs fallback `indexOf` searches, sorts highlights and notes, builds/sorts a breakpoint set, slices the document, searches highlight ranges for each segment, filters notes for each breakpoint, and creates a new React node array. Because it is called directly during render and is not memoized, unrelated state changes—hovering a marker, moving a window, typing a note, changing a color, saving, or dragging—repeat the whole calculation and reconciliation.
- **Estimated impact:** **Typing latency:** high in note/pin editors. **Drag latency:** very high when combined with RP-01/RP-04. **Scrolling:** moderate when scroll causes pin state updates. **Render cost:** very high with many annotations. **Memory:** high transient allocation of arrays, sets, strings, styles, closures, and elements.
- **Fix complexity:** M
- **Recommendation:** Memoize the derived render segments strictly from `displayText` and annotation fields that affect highlights/note markers. Render the memoized segments through a stable child so hover/editor/window state does not rebuild document text.

### RP-03 — Document scrolling synchronously remeasures every pin

- **Severity:** CRITICAL
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:648-678` and `:1732`.
- **Explanation:** The `<pre>` calls `measurePinPositions` directly for every scroll event. The function reads the shell rectangle, then for every pin walks from the beginning of the text-node tree, creates a `Range`, reads its rectangle, and reads computed style. It finally calls `setPinPositions`, causing a React render during scrolling. Scroll events can arrive multiple times per frame; the work scales with both pin count and text-node count.
- **Estimated impact:** **Scrolling:** very high; primary source of scroll jank when pins exist. **Render cost:** high. **Drag latency:** moderate because the same measurement path also runs after pin changes. **Memory:** moderate transient Range/object creation.
- **Fix complexity:** M
- **Recommendation:** Coalesce scroll measurement to one animation-frame callback, skip work when a callback is already queued, cache text-node/offset lookup data, and avoid setting state when computed positions did not materially change.

### RP-04 — Pin movement repeatedly scans the text DOM from the beginning

- **Severity:** HIGH
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:626-646`, called by `:660-663` and `:1783-1785`; pointer-to-offset conversion at `:479-517` serializes the preceding DOM range.
- **Explanation:** `getTextNodeAtOffset()` creates a new `TreeWalker` and scans text nodes from offset zero for each lookup. `getTextOffsetFromPoint()` creates a Range from the root to the caret and calls `toString().length`, which serializes all preceding text. Pin drag performs both directions of conversion on every pointer event. More annotations create more text nodes, increasing scan cost.
- **Estimated impact:** **Drag latency:** high and grows with document length/annotation fragmentation. **Render cost:** low directly, but it feeds state updates. **Memory:** moderate transient DOM objects/strings. **Scrolling:** high when all pins are measured.
- **Fix complexity:** M
- **Recommendation:** Build a cached text-node offset index after annotated text changes. Resolve character offsets by binary search and update the cache only when text/annotation segmentation changes.

### RP-05 — Typing a note updates both draft state and the full annotations array

- **Severity:** HIGH
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:1580-1601`.
- **Explanation:** Each keystroke calls `setAnnotationNote`, schedules textarea measurement, and—when editing—maps the entire annotations array to create a new annotation object. The annotations reference change invalidates the complete highlight/note render calculation and also rerenders the annotation card list. A second effect independently calls `resizeNoteTextarea` when `annotationNote` changes (`:237-239`), so a keystroke can schedule one animation-frame resize and then run another effect resize.
- **Estimated impact:** **Typing latency:** high, especially with long documents or many annotations. **Render cost:** very high because document text and annotation cards rerender. **Memory:** moderate/high array and React-node churn. **Drag/scrolling:** none directly.
- **Fix complexity:** S
- **Recommendation:** Keep the note draft only in `annotationNote` while typing. Update `annotations` once on save (or on a modest debounce if live preview is required). Use one textarea-resize path, not both an effect and a newly scheduled frame per keystroke.

### RP-06 — Typing a pin note updates both draft state and the full pins array, triggering pin remeasurement

- **Severity:** HIGH
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:1990-2016`; pin measurement effect at `:193-195`.
- **Explanation:** Every keystroke calls `setPinNote` and maps `pins` to update `note_text`. Because the `pins` array is a dependency of the measurement effect, every keystroke schedules `measurePinPositions`, even though changing pin note text cannot change its document position. The resulting measurement sets `pinPositions`, adding another render.
- **Estimated impact:** **Typing latency:** high with multiple pins/long annotated text. **Render cost:** high; at least one main render plus a measurement-driven render. **Memory:** moderate array/object churn. **Scrolling/drag:** none directly.
- **Fix complexity:** S
- **Recommendation:** Keep pin-note draft local to `pinNote`; update the pin record on save/blur. Narrow position measurement dependencies to positional fields only, not pin note or color changes.

### RP-07 — Original-document dragging and resizing rerender the complete document viewer on every pointer event

- **Severity:** HIGH
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:1030-1080`; overlay rendering around `:1330-1457`.
- **Explanation:** `handleOriginalDragMove` and `handleOriginalResizeMove` call `setOriginalWindow` on every pointer event. Since the overlay state lives in `DocumentViewPanel`, each movement reruns annotation segmentation, pin sorting, lists, toolbars, and the embedded original preview. Resizing an iframe/object can also trigger expensive browser layout and paint.
- **Estimated impact:** **Drag latency:** high. **Render cost:** very high. **Memory:** moderate transient objects/elements. **Scrolling:** none directly. **Typing:** none directly.
- **Fix complexity:** S
- **Recommendation:** Apply transient `translate3d`/size values through refs in one animation-frame callback and commit state at drag/resize end. Avoid rerendering document text for overlay-only movement.

### RP-08 — Note-editor dragging rerenders the full viewer per pointer event

- **Severity:** HIGH
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:1171-1200`.
- **Explanation:** Every pointer movement creates a new `{x, y}` object in `noteEditorPosition`. That state update occurs in the same component that renders all text segments, pins, annotation cards, and the original overlay.
- **Estimated impact:** **Drag latency:** high with annotated documents. **Render cost:** high. **Memory:** moderate transient allocation. **Typing/scrolling:** none directly.
- **Fix complexity:** S
- **Recommendation:** Move the floating editor visually through a ref/transform during pointer movement and save its final position to state on pointer-up.

### RP-09 — Pin position measurement always writes a new state object

- **Severity:** HIGH
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:648-678`.
- **Explanation:** `measurePinPositions` unconditionally creates `nextPositions` and calls `setPinPositions(nextPositions)`. Even when every pin remains at the same pixel position, React receives a new object and rerenders. This happens after the measurement effect and on every scroll event.
- **Estimated impact:** **Scrolling:** high redundant render frequency. **Render cost:** high. **Memory:** moderate. **Typing:** high indirectly for pin-note edits because they schedule measurement.
- **Fix complexity:** S
- **Recommendation:** Compare IDs/coordinates with current positions and return the previous state when unchanged. Combined with animation-frame coalescing, this removes no-op scroll/measurement renders.

### RP-10 — Pin numbering repeatedly sorts and scans the full pin collection

- **Severity:** MEDIUM
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:680-684`, pin list sort at `:1742-1744`, marker numbering at `:1910`, editor numbering at `:1988-1989`.
- **Explanation:** The render first clones and sorts pins, then `getPinNumber` clones and sorts the entire collection again for each rendered pin and performs `findIndex`. This is approximately `O(P² log P)` per render, with repeated `Date` allocation/parsing. The editor performs another lookup/sort.
- **Estimated impact:** **Render cost:** medium at small pin counts, high if pin count grows. **Drag/typing latency:** medium because these interactions rerender frequently. **Memory:** moderate transient arrays and `Date` objects.
- **Fix complexity:** S
- **Recommendation:** Derive one sorted pin array and one `Map<pinId, number>` from `pins`; reuse both throughout the render.

### RP-11 — Highlight/note segmentation contains avoidable repeated linear searches

- **Severity:** HIGH
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:336-337`, `:351-352`, `:387-410`, and `:443`.
- **Explanation:** Fallback annotations can call `text.indexOf` more than once. Every text segment calls `highlightRanges.find`, and every breakpoint calls `noteMarkers.filter`. As annotation count grows, segmentation moves toward quadratic work rather than a single ordered sweep.
- **Estimated impact:** **Render cost:** high with many overlapping annotations. **Typing/drag latency:** high because segmentation is repeated during interactions. **Memory:** moderate.
- **Fix complexity:** M
- **Recommendation:** Normalize ranges once, group note markers by offset, and walk ordered ranges/breakpoints with moving indexes rather than calling `find`/`filter` inside the segment loop.

### RP-12 — Hovering note and pin markers rerenders the entire viewer

- **Severity:** MEDIUM
- **Evidence:** note hover state at `src/components/documents/DocumentViewPanel.tsx:127-131` with handlers `:423-432`, `:457-466`; pin hover handlers `:1895-1900`; hover boxes `:2022-2049`.
- **Explanation:** Mouse enter/leave stores hover data in top-level component state. Crossing markers can produce two full renders per marker (enter and leave), including text segmentation and pin/annotation lists. Geometry is also read through `getBoundingClientRect()` on enter.
- **Estimated impact:** **Pointer responsiveness:** medium/high in dense annotation areas. **Render cost:** high per event, although event frequency is lower than dragging. **Memory:** moderate transient objects/elements.
- **Fix complexity:** S
- **Recommendation:** Keep hover rendering in a small isolated marker/tooltip child or update a tooltip DOM ref without invalidating document text. Do not rebuild annotated content for tooltip visibility.

### RP-13 — Document state is duplicated between the prop, `currentDocument`, and `draftText`

- **Severity:** MEDIUM
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:94-116`, synchronization effect `:165-174`, patch synchronization `:256-275`.
- **Explanation:** The component copies `initialDocument` into state and separately copies its text into `draftText`. A prop identity change triggers five state setters in an effect after an initial render with the previous local state, creating an additional render pass and temporary inconsistency. Patch success also updates both state copies.
- **Estimated impact:** **Render cost:** medium on document switch/update. **Memory:** medium because large document text can be referenced/copied in multiple state paths. **Typing:** low. **Drag/scrolling:** low.
- **Fix complexity:** M
- **Recommendation:** Use the document ID as the reset boundary, keep only fields that are locally mutated, and initialize/reset the edit draft only when editing starts or the selected document ID changes.

### RP-14 — `pinPositions` is derived state that guarantees a second render after relevant changes

- **Severity:** MEDIUM
- **Evidence:** state at `src/components/documents/DocumentViewPanel.tsx:121`; measurement effect `:193-195`; setter `:677`; render use `:1901-1905`.
- **Explanation:** Changes to pins, text, editing mode, or fullscreen first render with old/missing positions; an animation-frame measurement then writes derived position state and renders again. Pin changes that cannot affect position, such as note/color edits, also enter this two-pass cycle.
- **Estimated impact:** **Render cost:** medium/high. **Typing latency:** high for pin-note edits. **Visual stability:** possible marker jump/flicker. **Memory:** low/moderate.
- **Fix complexity:** M
- **Recommendation:** Separate positional pin data from metadata, measure only when geometry actually changes, and update marker styles directly where possible. At minimum, narrow dependencies and skip equal results.

### RP-15 — Global keyboard effect is reinstalled when note editor state changes

- **Severity:** LOW
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:241-254`.
- **Explanation:** The effect depends on `isAnnotationNoteOpen` and `editingAnnotationId`, but its handler only invokes setters/close functions and does not need those values. Opening or switching notes removes and re-adds the window listener.
- **Estimated impact:** **Render cost:** low. **Memory/GC:** low listener/closure churn. **Typing/drag/scrolling:** negligible.
- **Fix complexity:** S
- **Recommendation:** Install one stable Escape listener for the component lifetime, using stable close behavior or refs where current values are required.

### RP-16 — Workspace-level callback recreation propagates parent renders to all three panels

- **Severity:** MEDIUM
- **Evidence:** `src/components/ThreePanelWorkspace.tsx:497-529` and props at `:544-566`; no `React.memo` usage exists in `src/components`.
- **Explanation:** `requestJournalRefresh`, `openDocument`, `openSourceDocument`, `handleSituationDocumentLinked`, and `handleDocumentUploaded` are recreated on each workspace render. Any workspace state update creates new function props for Journal, Chat, and right-panel components. Because those components are not memoized, the whole three-panel subtree rerenders even when only one selection/refresh counter changed.
- **Estimated impact:** **Render cost:** medium; can become high when the right panel contains `DocumentViewPanel`. **Typing:** normally low because chat typing is below this boundary. **Document opening/upload:** medium.
- **Fix complexity:** S
- **Recommendation:** Stabilize callbacks with `useCallback` where they are passed across panels, and memoize panel boundaries after confirming their props are stable. Keep the optimization targeted to measured parent updates.

### RP-17 — The unused Journal refresh counter causes a full workspace rerender

- **Severity:** MEDIUM
- **Evidence:** `src/components/ThreePanelWorkspace.tsx:481,497-499`; invoked from `src/components/chat/ChatPanel.tsx:245-247`.
- **Explanation:** Approval increments state whose value is discarded. The only runtime effect is rerendering `ThreePanelWorkspace`, recreating callbacks and rerendering Journal, Chat, and the right panel—including the document viewer if open.
- **Estimated impact:** **Render cost:** medium/high for an open document. **Typing/drag/scrolling:** none. **Memory:** transient subtree allocation.
- **Fix complexity:** S
- **Recommendation:** Remove the no-op state update or connect the invalidation to only the data consumer that needs it; do not use an unused parent state change as a refresh signal.

### RP-18 — Chat composer typing rerenders message history, suggestions, and all chat controls

- **Severity:** MEDIUM
- **Evidence:** state at `src/components/chat/ChatPanel.tsx:80-91`; composer prop at `:293-298`; message/suggestion rendering at `:267-290`; `MessageComposer.tsx:19-36`.
- **Explanation:** `composerContent` belongs to `ChatPanel`, so each keystroke rerenders the entire ChatPanel: workflow card, every message, meeting-prep card, every suggestion, and composer. `MessageList` and `SuggestionPreview` are not memoized, and `onApprove`/`onReject` are new inline callbacks each render.
- **Estimated impact:** **Typing latency:** medium, becoming high with long message history or many suggestion cards. **Render cost:** linear in rendered chat content. **Memory:** moderate React-element churn.
- **Fix complexity:** S
- **Recommendation:** Keep the composer draft inside `MessageComposer` or isolate/memoize the history and suggestion sections with stable callbacks. The keystroke path should rerender only the composer.

### RP-19 — Sending a chat message performs a second request and replaces the entire message array

- **Severity:** MEDIUM
- **Evidence:** `src/components/chat/ChatPanel.tsx:153-174`.
- **Explanation:** After the POST returns, the client calls `loadMessages()` and downloads the complete history, then replaces `messages`. This delays visible completion and forces reconciliation of every rendered message. Cost grows with conversation length.
- **Estimated impact:** **Message-send latency:** medium/high on long histories or slow networks. **Render cost:** medium/high. **Memory/network:** high relative to appending two messages.
- **Fix complexity:** S
- **Recommendation:** Use the POST response to append the persisted user/assistant messages and suggestions. Reserve a full reload for explicit reconciliation or error recovery.

### RP-20 — Suggestion action state recreates the full state map and rerenders every suggestion

- **Severity:** LOW
- **Evidence:** `src/components/chat/ChatPanel.tsx:210-255`; list render `src/components/chat/SuggestionPreview.tsx:33-104`.
- **Explanation:** Starting and finishing one action clones the full action-state object and rerenders the complete ChatPanel and every suggestion card. This is acceptable at small counts but scales linearly and compounds with large message history.
- **Estimated impact:** **Render cost:** low/medium. **Interaction latency:** low/medium with many cards. **Memory:** low.
- **Fix complexity:** S
- **Recommendation:** Memoize individual suggestion cards and pass each card only its own action state plus stable action callbacks.

### RP-21 — Journal selection updates rerender the entire workspace before child fetches complete

- **Severity:** MEDIUM
- **Evidence:** selected state at `src/components/ThreePanelWorkspace.tsx:487,493-495`; `JournalPanel` props at `:544-550`; `GoalsSection` and `SituationDocumentsSection` fetch on selected ID changes at `GoalsSection.tsx:24-72` and `SituationDocumentsSection.tsx:44-85`.
- **Explanation:** Selection is stored at workspace level because upload/right-panel behavior consumes it, so changing it rerenders all three panels. Then the Journal’s two child sections each reset state and fetch independently, producing additional renders as loading, data, and errors settle.
- **Estimated impact:** **Selection latency:** medium. **Render cost:** medium across workspace plus multiple Journal passes. **Network:** two requests per selection. **Memory:** low/moderate.
- **Fix complexity:** M
- **Recommendation:** Keep the shared selected ID, but memoize panel boundaries and batch/reset child loading state carefully. Avoid rerendering Chat and an open document when only the selected ID changes.

### RP-22 — Journal edit drafts rerender more list content than necessary

- **Severity:** LOW
- **Evidence:** situation draft is local in `JournalPanel.tsx:34-169`; goal draft and list are in one component at `GoalsSection.tsx:15-22`, with list rendering around `:220-319`.
- **Explanation:** Situation title typing is appropriately localized to `SituationCard`. Goal title typing, however, updates `goalTitleDraft` in `GoalsSection`, rerendering every goal row and section control on each keystroke. The list is currently bounded/small, so impact is limited.
- **Estimated impact:** **Typing latency:** low now, medium with many goals. **Render cost:** low/linear. **Memory:** low.
- **Fix complexity:** S
- **Recommendation:** Keep each editable row’s draft in a row component or memoize non-editing rows so only the active editor rerenders.

### RP-23 — Independent Journal fetch effects can commit stale results after rapid selection changes

- **Severity:** MEDIUM
- **Evidence:** `src/components/journal/GoalsSection.tsx:24-72`; `src/components/journal/SituationDocumentsSection.tsx:44-85`.
- **Explanation:** The `isMounted` flag prevents updates after effect cleanup, but it does not abort fetch or JSON parsing. Rapid selection changes leave old network work running. Responses are ignored after cleanup, but bandwidth/CPU are still consumed, and repeated state reset/loading cycles increase renders.
- **Estimated impact:** **Selection responsiveness:** medium under latency. **Network/memory:** medium wasted in-flight work. **Render cost:** low/medium.
- **Fix complexity:** S
- **Recommendation:** Use `AbortController` in each effect and abort the previous request on dependency change/unmount.

### RP-24 — CSS cascade for the document viewer is unusually large and override-heavy

- **Severity:** MEDIUM
- **Evidence:** `src/app/globals.css` is 4,904 lines; `.document-extracted-text` is declared repeatedly around `:864`, `:876`, `:1693`, `:1851`, `:1917`, `:1941`, `:1968`, `:2002`, `:2037`, `:2299`, `:2355`, `:3474`, and `:3687`; `.document-pin-marker` is repeatedly overridden around `:4384`, `:4494`, `:4696`, `:4716`, `:4741`, `:4794`, and `:4845`.
- **Explanation:** Repeated selectors and widespread `!important` rules increase cascade matching and computed-style work whenever classes or inline styles change. The browser must resolve many competing rules for elements that move or rerender frequently. This is secondary to the JavaScript/layout hotspots but amplifies them.
- **Estimated impact:** **Style recalculation/render cost:** medium. **Drag/scrolling:** low/medium amplification. **Memory:** medium stylesheet/rule storage.
- **Fix complexity:** M
- **Recommendation:** Consolidate only the repeated active rules for high-frequency elements (`document-extracted-text`, pin markers/layers, floating editors). Preserve visuals; remove superseded declarations after checking computed styles.

### RP-25 — Pin drag applies a universal descendant selector while the subtree is moving

- **Severity:** MEDIUM
- **Evidence:** `src/app/globals.css:4703-4707` (`.document-text-pin-shell.pin-dragging, .document-text-pin-shell.pin-dragging *`).
- **Explanation:** Toggling `pin-dragging` invalidates style for every descendant of the document shell. The subtree includes all annotated text nodes and markers. On drag start/end this causes broad style recalculation; it does not run every pointer frame, but it raises the cost of entering/exiting drag on large documents.
- **Estimated impact:** **Drag start/end latency:** medium. **Style recalculation:** high for a fragmented text subtree. **Memory:** low.
- **Fix complexity:** S
- **Recommendation:** Apply `user-select`/cursor behavior to the smallest necessary elements rather than every descendant.

### RP-26 — Moving pin graphics use `filter: drop-shadow`

- **Severity:** LOW
- **Evidence:** `src/app/globals.css:4753-4761`, `:4811-4819`, and `:4861-4874`.
- **Explanation:** Filtered SVG graphics can require extra rasterization/compositing. During pin movement, the marker position changes frequently, so the shadow can add paint cost. The effect is small compared with the JavaScript/layout work but is on the hottest interaction path.
- **Estimated impact:** **Drag latency/paint:** low/medium on lower-end GPUs. **Scrolling:** low if markers move with scroll. **Memory:** low layer/raster overhead.
- **Fix complexity:** S
- **Recommendation:** Profile with and without the filter; replace it with a cheaper visual treatment if paint time is measurable.

### RP-27 — No rendering containment is applied to large independent regions

- **Severity:** LOW
- **Evidence:** no `contain` or `content-visibility` declarations were found in `src/app/globals.css`; long annotation list at `DocumentViewPanel.tsx:1919-1939` remains in the same render/layout surface as the document text.
- **Explanation:** Browser layout/paint invalidation can propagate across the document viewer. Off-screen annotation cards are still laid out and painted according to normal rules.
- **Estimated impact:** **Scrolling/render cost:** low/medium with many annotation cards. **Memory:** potentially higher if `content-visibility` could skip off-screen rendering.
- **Fix complexity:** S
- **Recommendation:** Test `content-visibility: auto` on long, off-screen annotation-card sections and targeted `contain` on floating overlays/pin layers. Apply only after verifying positioning and accessibility behavior.

## TOP 10 performance wins by estimated impact ÷ implementation effort

| Rank | Performance win | Primary impact | Effort | Related findings |
|---:|---|---|:---:|---|
| 1 | Stop updating `annotations` on every note keystroke; keep one local draft and one resize path | Major typing-latency reduction; avoids full text regeneration per key | S | RP-05 |
| 2 | Stop updating `pins` on every pin-note keystroke and exclude metadata from position measurement | Major typing reduction; removes extra measurement/render pass | S | RP-06, RP-14 |
| 3 | Skip `setPinPositions` when coordinates are unchanged | Removes redundant renders during scroll and measurement effects | S | RP-09 |
| 4 | Move overlay and note-editor drag visuals through refs/transforms; commit state on pointer-up | Large drag responsiveness gain without changing behavior | S | RP-07, RP-08 |
| 5 | Keep chat composer draft local or memoize history/suggestions | Makes typing cost independent of message/suggestion count | S | RP-18 |
| 6 | Remove the no-op workspace refresh state update | Avoids a full three-panel/document-viewer render on approval | S | RP-17 |
| 7 | Derive sorted pins and pin-number map once per pins change | Eliminates repeated sort/date parsing and quadratic numbering | S | RP-10 |
| 8 | Coalesce scroll/pin measurements to one `requestAnimationFrame` and cancel duplicate frames | Direct reduction in scroll jank and layout pressure | M | RP-03, RP-09 |
| 9 | Memoize annotated text segments by text + rendering-relevant annotations | Prevents expensive full document reconstruction on unrelated state changes | M | RP-02, RP-12 |
| 10 | During pin drag, keep transient position outside React and persist/update state only on pointer-up | Largest drag-frame improvement; removes render/layout feedback loop | M | RP-01, RP-04 |
