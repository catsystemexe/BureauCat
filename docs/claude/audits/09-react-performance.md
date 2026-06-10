# 09 — React & UI Runtime Performance Audit

> Read-only audit, generated 2026-06-10. Scope: runtime performance only
> (rerenders, state ownership, expensive calculations, DOM/layout cost, CSS
> recalculation). Line numbers verified against current source. No code changes.
>
> Legend per finding: **Severity** · Evidence (`file:lines`) · Why it costs ·
> **Impact** (typing / drag / scroll / render / memory) · **Fix complexity** (S/M/L).

---

## 1. React rerender chains

### 1.1 🔴 CRITICAL — Any viewer state change re-renders the entire annotated document
- **Evidence:** `src/components/documents/DocumentViewPanel.tsx:328-477` (definition), `:1739` (call site).
- **Why:** `renderDisplayTextWithHighlights(displayText)` is a plain function
  invoked inline in JSX with no `useMemo`. The component has **26 `useState`
  atoms** (`:95-159`); *every* one of them — hover boxes, `isSaving`, palette
  toggles, `pinPositions`, editor drafts — re-runs the full pipeline: two
  `annotations.filter().map().sort()` passes (`:329-365`), `text.indexOf` per
  legacy annotation (`:336, :351-352`, O(text) each), breakpoint set
  construction (`:371-384`), and a segment loop that does
  `highlightRanges.find(...)` per segment (`:391`) and `noteMarkers.filter(...)`
  per breakpoint (`:409, :443`) — O(segments × (ranges + markers)). React then
  reconciles the entire children array of the `<pre>`.
- **Impact:** render cost — the baseline tax multiplied by every other finding
  below; on a long document with dozens of annotations this is tens-to-hundreds
  of ms *per render*, and renders happen per keystroke / hover / scroll tick.
- **Fix complexity:** **S** (`useMemo` on `[annotations, displayText]`; the
  inline `onClick`/`onMouseEnter` handlers close over stable setters).

### 1.2 🟠 HIGH — Workspace-level state changes re-render all three panels (unstable callbacks, no memo)
- **Evidence:** `src/components/ThreePanelWorkspace.tsx:497-529`
  (`requestJournalRefresh`, `openDocument`, `openSourceDocument`,
  `handleSituationDocumentLinked`, `handleDocumentUploaded` — all recreated per
  render; only `selectSituation` is `useCallback`'d, `:493-495`), `:544-566`
  (panels receive these props; none of `JournalPanel`, `ChatPanel`,
  `RightContextPanel` is memoized).
- **Why:** any workspace state update (situation selection, opening a document,
  any refresh-key bump) re-renders `JournalPanel`, `ChatPanel` (→ `MessageList`
  over all messages), and `RightContextPanel` — including a mounted
  `DocumentViewPanel`, which re-runs finding 1.1. Memoizing the panels alone
  would not help because five of the six callbacks change identity every render.
- **Impact:** render cost across the whole screen for local interactions; makes
  every other hotspot fire more often.
- **Fix complexity:** **M** (`useCallback` the five handlers + `React.memo` the
  three panel components).

### 1.3 🟠 HIGH — Write-only `journalRefreshKey`: full-workspace re-render with zero effect
- **Evidence:** `ThreePanelWorkspace.tsx:481` (`const [, setJournalRefreshKey] = useState(0);`
  — the value is **discarded**), `:497-499`, triggered from
  `ChatPanel.tsx:246` on suggestion approval.
- **Why:** approving a suggestion increments state that nothing reads. The only
  runtime result is a render of the entire workspace tree (all three panels,
  incl. finding 1.1 if a document is open). Side note (out of scope to fix
  here): this also means the journal does *not* actually refresh through this
  path — the state update is pure overhead.
- **Impact:** render cost; one wasted full-tree render per approval.
- **Fix complexity:** **S** (either wire the key to `JournalPanel` or drop the
  state).

### 1.4 🟠 HIGH — Hovering note markers / pins re-renders the whole viewer per crossing
- **Evidence:** `DocumentViewPanel.tsx:127-131, 144-148` (hover state at
  component root), `:423-432, :457-465` (note marker `onMouseEnter`/`Leave`),
  `:1895-1900` (pin `onMouseEnter`/`Leave`), hover boxes `:2022-2049`.
- **Why:** `setHoveredNote`/`setHoveredPin` live at the root, so every
  enter/leave pair causes **two** full component renders (each re-running 1.1
  plus the pin-layer sort, finding 3.4). Sweeping the mouse across an annotated
  paragraph produces a render storm.
- **Impact:** render cost + perceived hover jank on annotated documents.
- **Fix complexity:** **M** (isolate hover boxes + markers into a memoized
  subcomponent, or track hover in a ref + portal-rendered tooltip).

### 1.5 🟡 MEDIUM — Floating-editor drag re-renders the viewer per pointer move
- **Evidence:** `DocumentViewPanel.tsx:1182-1194` (`handleNoteEditorMove` →
  `setNoteEditorPosition` per move), editor styled via `left/top` `:1571-1576`.
- **Why:** dragging the note editor updates root state per pointer event →
  full render (incl. 1.1) per move, and `left/top` changes trigger layout.
- **Impact:** drag latency (note editor); render cost.
- **Fix complexity:** **S** (move via `transform` on a ref during drag; commit
  position once on pointer-up).

### 1.6 🟡 MEDIUM — Inline object/handler props on every text segment and marker
- **Evidence:** `DocumentViewPanel.tsx:399, :433, :467` (fresh `style` objects
  per segment/marker), `:416-432` (fresh closures per marker), toolbar/palette
  buttons `:1486-1489, :1688, :1969`.
- **Why:** none of these children are memoized components, so this doesn't
  cause *extra* renders today, but it guarantees full reconciliation cost for
  every render from 1.1 and blocks any future memoization at the marker level.
- **Impact:** render cost (secondary); memory churn (per-render allocations).
- **Fix complexity:** **M** (falls out of extracting marker components).

---

## 2. State ownership

### 2.1 🟠 HIGH — Chat composer text lives at panel root
- **Evidence:** `src/components/chat/ChatPanel.tsx:81`
  (`composerContent` state), `:293-298` (passed to `MessageComposer`),
  `:283` (`MessageList` rendered from same component).
- **Why:** every keystroke in the composer re-renders `ChatPanel`, which
  re-renders `MessageList` (not memoized) over **all** messages — and each
  message constructs a fresh `Intl.DateTimeFormat` (finding 3.6). Typing cost
  grows linearly with conversation length.
- **Impact:** typing latency in chat (the main input of the app).
- **Fix complexity:** **S** (move draft state into `MessageComposer`, or
  `React.memo(MessageList)` — `messages` identity is stable between sends).

### 2.2 🟠 HIGH — Editor drafts duplicated into the `annotations`/`pins` arrays on every keystroke
- **Evidence:** `DocumentViewPanel.tsx:1583-1597` (note editor `onChange`: 
  `setAnnotationNote` **and** `setAnnotations(current.map(...))` per keystroke),
  `:1998-2005` (pin editor: `setPinNote` **and** `setPins(map)` per keystroke),
  `:1960-1967` (pin color: same double-write + a PATCH per click), revert logic
  `:925-952` proves the array copy is provisional.
- **Why:** the draft exists twice (scalar + inside the array). Each keystroke
  rewrites the whole array → full render (1.1) — and **`setPins` additionally
  triggers the measure-all-pins effect** (`:193-195` depends on `pins`), so
  typing a pin note forces DOM measurement of every pin per keystroke
  (finding 3.2).
- **Impact:** typing latency in note/pin editors (two state updates + document
  re-render + forced layouts per character); memory churn.
- **Fix complexity:** **S** (keep the draft only in local state/ref; write into
  the array on save/blur — the API call already happens there).

### 2.3 🟠 HIGH — `pinPositions` is DOM-derived data stored as state with fresh identity per measure
- **Evidence:** `DocumentViewPanel.tsx:121` (state), `:648-678`
  (`measurePinPositions` builds a **new object every call** and
  unconditionally `setPinPositions(nextPositions)` — no equality bail), wired
  to scroll `:1732` and effect `:193-195`.
- **Why:** derived-from-DOM data in render state means every measurement —
  even one producing identical values — re-renders the viewer (and re-runs
  1.1). During scroll this guarantees one render per scroll event.
- **Impact:** scrolling; render cost.
- **Fix complexity:** **S** for the bail-out (shallow-compare before set);
  **M** for the cleaner fix (write `top` to pin DOM nodes via refs, keep
  positions out of React state entirely).

### 2.4 🟡 MEDIUM — Full document text in a controlled textarea at component root
- **Evidence:** `DocumentViewPanel.tsx:114-116` (`draftText` holds the entire
  document), `:1700-1706` (controlled `onChange={setDraftText}`).
- **Why:** each keystroke in edit mode allocates a new full-document string and
  re-renders the 2k-line component (toolbar, header, annotation list; the
  `<pre>`/pin layer is unmounted in this branch, which limits the damage).
- **Impact:** typing latency in edit mode on large documents; memory churn
  (O(text) garbage per keystroke).
- **Fix complexity:** **M** (isolate the editor into its own component, or use
  an uncontrolled textarea + ref read on save).

### 2.5 🟡 MEDIUM — `originalWindow` geometry in render state during drag/resize
- **Evidence:** `DocumentViewPanel.tsx:99-105` (state), `:1041-1049`
  (`setOriginalWindow` per pointer move), `:1070-1081` (resize), consumed as
  `left/top/width/height` styles `:1345-1350` and a scaled `iframe`/`object`
  `:1395-1405`.
- **Why:** one full component render per pointer move, plus layout of the
  overlay; resizing re-lays-out an embedded PDF `<object>`/`iframe`, which is
  one of the most expensive things a browser can do per frame.
- **Impact:** drag latency (original window), render cost.
- **Fix complexity:** **S/M** (drag via `transform` on a ref; commit state on
  pointer-up; resize the embed only on release).

### 2.6 🟢 LOW — Duplicated server state without sync issues found
`messages`/`suggestionPreviews` (ChatPanel), `situations` (JournalPanel),
`annotations`/`pins` (viewer) each have a single owner; no conflicting copies
found beyond 2.2. No action needed beyond the items above.

---

## 3. Expensive calculations

### 3.1 🔴 CRITICAL — Pin drag: O(pins × text) DOM walking + forced layouts per pointer move
- **Evidence:** `DocumentViewPanel.tsx:1766-1836` (the `onPointerMove` of every
  pin marker). Per event: `getTextOffsetFromPoint` (`:479-517` —
  caret-from-point **plus** `beforeRange.toString()` which materializes the
  entire text prefix, O(text)); `getTextNodeAtOffset` (`:626-646` — a fresh
  `TreeWalker` scan from the start of the document, O(text)); then
  `range.getBoundingClientRect()` (`:1791`), `shell.getBoundingClientRect()`
  (`:1792`), `getComputedStyle(root)` (`:1794`), and
  `event.currentTarget.getBoundingClientRect()` (`:1799`) — interleaved with up
  to **four state updates** (`setPinPositions :1802`, `setPinEditorPosition
  :1807`, `setHoveredPin :1814`, `setPins :1826`).
- **Why:** every pointer move forces synchronous layout multiple times
  (read-after-write thrash) and the `setPins` write re-triggers the
  measure-all-pins effect (`:193-195`), so the *next* frame re-walks the
  document once per pin (`:660-675`) — plus a full component render re-running
  1.1 and the pin-layer sorts (3.4).
- **Impact:** drag latency — the single worst interaction in the app; cost
  scales with document length × pin count. Cannot hold 60 fps on real documents.
- **Fix complexity:** **M** (rAF-gate the move handler; cache shell rect,
  line-height and a text-node offset index at drag start; move the marker via
  `transform` on a ref; commit `visual_offset`/state once on pointer-up — the
  code already tracks `dragPinRef.lastOffset` for exactly that).

### 3.2 🔴 CRITICAL — `measurePinPositions` on raw `onScroll` + broad effect triggers
- **Evidence:** `DocumentViewPanel.tsx:1732` (`onScroll={measurePinPositions}`,
  no throttle, no `isPinDragging` guard), `:648-678` (per pin: TreeWalker
  O(text) + `range.getBoundingClientRect()` + `getComputedStyle(root)` —
  the latter two *inside* the loop), `:193-195` (also re-triggered by `pins`,
  `displayText`, `isEditing`, `isFullscreen`).
- **Why:** scroll events fire many times per second; each one walks the
  document once per pin, forces layout per pin, recomputes `getComputedStyle`
  per pin, then sets state with a fresh object (2.3) → guaranteed render per
  scroll tick (which re-runs 1.1).
- **Impact:** scrolling — jank directly proportional to pin count and document
  size; also fires during pin drag, doubling 3.1's work.
- **Fix complexity:** **S** (rAF-throttle; hoist `getComputedStyle` out of the
  loop; single TreeWalker pass for all pins sorted by offset; equality bail
  before `setPinPositions`).

### 3.3 🟠 HIGH — Note textarea autosize forces double reflow per keystroke
- **Evidence:** `DocumentViewPanel.tsx:1218-1228` (`resizeNoteTextarea`:
  `style.height = "auto"` → write, `textarea.scrollHeight` → forced layout,
  `style.height = px` → write), called per keystroke via rAF `:1587` and from
  effects `:214-239`; `rows={annotationNote.split("\n").length}` recomputed per
  render `:1600` (same pattern for pin editor `:2015`).
- **Why:** classic write-read-write layout thrash, executed on top of the
  double state update from 2.2 — so each character costs 2 renders + ≥1 forced
  reflow.
- **Impact:** typing latency in note editors.
- **Fix complexity:** **S** (measure once per frame; or CSS `field-sizing: content` /
  a hidden mirror element).

### 3.4 🟡 MEDIUM — Pin layer re-sorts and re-ranks on every render
- **Evidence:** `DocumentViewPanel.tsx:1742-1743` (`[...pins].sort(...)` with
  `new Date(...)` allocations per comparison, per render), `getPinNumber`
  `:680-684` re-sorts the whole array **per pin** (called at `:1910`, `:1989`,
  `:2031`) — O(p² log p) with date parsing in the comparator.
- **Why:** runs on every viewer render (i.e., per keystroke/hover/scroll given
  the findings above).
- **Impact:** render cost (small p today, but multiplied by render frequency);
  memory churn from `Date` allocations.
- **Fix complexity:** **S** (`useMemo` a sorted array + `Map<pinId, number>`
  keyed on `pins`).

### 3.5 🟡 MEDIUM — Selection offset computation materializes full text prefixes
- **Evidence:** `DocumentViewPanel.tsx:292-315` (`getSelectionOffsets` —
  `beforeRange.toString()` O(text)), `:512-516` (same in
  `getTextOffsetFromPoint`); `getSentenceRangeAtOffset` `:519-553` scans
  char-by-char with per-char regex `.test` calls.
- **Why:** acceptable on discrete clicks/mouse-ups, but `getTextOffsetFromPoint`
  is also on the 3.1 per-move path, so the O(text) `toString()` runs per pointer
  move.
- **Impact:** drag latency (via 3.1); click handling on very large documents.
- **Fix complexity:** **S** in isolation (hoist regexes; reuse a cached prefix
  index during drag), subsumed by the 3.1 fix.

### 3.6 🟡 MEDIUM — `Intl.DateTimeFormat` constructed per message per render
- **Evidence:** `src/components/chat/MessageList.tsx:4-15` (formatter built
  inside `formatMessageDate`), `:30` (called per message in the map);
  same pattern once-per-render in `DocumentViewPanel.tsx:21-26`.
- **Why:** `Intl.DateTimeFormat` construction is expensive (locale data load,
  ~0.1–1 ms each). With the composer re-render chain (2.1), a 50-message
  conversation pays 50 constructions **per keystroke**.
- **Impact:** typing latency in chat; render cost.
- **Fix complexity:** **S** (hoist one formatter to module scope; or memoize
  formatted strings per message id).

### 3.7 🟢 LOW — Minor render-time work
- `EvidencePanel`: `parseSourceLinks` (`JSON.parse`) runs on every render —
  `ThreePanelWorkspace.tsx:201`. Impact: render (tiny). Fix: **S** (`useMemo`).
- Escape-key listener re-subscribes whenever note-editor state changes although
  the handler reads none of it — `DocumentViewPanel.tsx:241-254`. Impact:
  effect churn only. Fix: **S**.
- `useEffect` at `:193-195` omits `measurePinPositions` from deps (stale-closure
  risk over `pins` is masked by `pins` being a dep) — correctness smell rather
  than cost. Fix: **S**.

---

## 4. DocumentViewPanel.tsx — full render-path analysis

**Component shape:** one function component, 26 `useState` + 7 refs, ~38 inner
functions recreated per render, single render tree containing: header/toolbar,
optional original-file overlay, the annotated `<pre>` (1.1), pin layer,
annotations list (`:1919-1939`), and three floating editors/tooltips.

**What happens per render (any state change):**
1. `renderDisplayTextWithHighlights(displayText)` — full pipeline (1.1).
2. `[...pins].sort(...)` + `getPinNumber` per pin (3.4).
3. Re-creation of all inline closures/styles (1.6).
4. Reconciliation of the whole `<pre>` children array.

**Event-path costs (measured against that baseline):**

| Interaction | Path | Cost per event |
|---|---|---|
| **Pin drag (move)** | `:1766-1836` → 3.1 → render → effect `:193` → 3.2 | 2 renders + O(pins×text) DOM walks + ≥6 forced-layout reads |
| **Scroll (with pins)** | `:1732` → 3.2 → new `pinPositions` → render | 1 render + O(pins×text) walk + per-pin layout reads, per scroll tick |
| **Typing in note editor** | `:1583-1597` → 2 state writes + rAF resize (3.3) | 2 renders + ≥1 forced reflow + full doc re-render |
| **Typing in pin editor** | `:1998-2005` → `setPins` → effect `:193` → 3.2 | 2 renders + measure **all** pins per keystroke |
| **Hover note/pin marker** | `:423-432` / `:1895-1900` | 2 renders (enter+leave), each running 1.1 |
| **Typing in edit mode** | `:1704` (`setDraftText`) | 1 render; `<pre>`/pins unmounted (cheaper), O(text) string churn |
| **Original window drag/resize** | `:1041-1081` → render + overlay layout (+ embed re-layout on resize) | 1 render + layout per move |
| **Toolbar/palette clicks** | tool state at root | 1 full render incl. 1.1 (noticeable but acceptable) |

**Hotspots ranked by impact:**
1. Pin drag chain (3.1 + 3.2 + 1.1 compounding) — CRITICAL.
2. Unmemoized document rendering (1.1) — CRITICAL (the multiplier).
3. Scroll-driven measurement + state identity (3.2 + 2.3) — CRITICAL.
4. Editor keystroke double-writes (2.2 + 3.3) — HIGH.
5. Hover render storms (1.4) — HIGH.
6. Pin sorting/ranking per render (3.4) — MEDIUM.
7. Original-window drag/resize (2.5) — MEDIUM.

---

## 5. JournalPanel.tsx

Overall: the **cleanest** of the three panels at runtime.

- **Render frequency — acceptable.** Local state is scoped well
  (`SituationCard` keeps its own edit state, `:41-45`); `selectedSituation` is
  `useMemo`'d (`:312-318`); `GoalsSection`/`SituationPager` memoize their
  filters (`GoalsSection.tsx:75`, `SituationPager.tsx:24`).
- 🟡 MEDIUM — **Parent-driven re-renders, not self-inflicted.** Because
  `ThreePanelWorkspace` re-renders everything (1.2), JournalPanel re-renders on
  unrelated events (opening a document, upload refresh keys). Its subtree is
  small, so the cost is moderate. Fix complexity: covered by 1.2.
- 🟡 MEDIUM — **Fetch pattern: situation switch cascades two fetches.**
  `GoalsSection.tsx:24-43` and `SituationDocumentsSection.tsx:44-60` each
  refetch on `selectedSituationId` change; `JournalPanel.tsx:239-280` loads
  situations and resets the selection (`:259`) on every (re)mount — combined
  with 1.2 this is fine today, but any future remount of the panel re-runs the
  whole cascade. Impact: network latency, not renders. Fix: **M** (cache per
  situation id) — optional at current scale.
- 🟢 LOW — `onSelectSituation` is correctly stable (workspace `useCallback`
  `:493-495`) so the effect at `:239-280` doesn't loop. No unnecessary state
  updates found; `handleSituationUpdated` (`:320-326`) maps only on save.

---

## 6. ChatPanel.tsx

- 🟠 HIGH — **Composer keystroke → whole-panel render** (2.1) including
  `MessageList` × `Intl.DateTimeFormat` per message (3.6). This is the chat
  panel's only real runtime problem, but it is the one a user touches most.
- 🟡 MEDIUM — **Send flow does a redundant full reload.**
  `ChatPanel.tsx:142-180`: the POST response already contains
  `assistantMessage` (`:24-27, :165`), but the code then calls `loadMessages()`
  (`:169`) and replaces the entire list. Every send = 1 POST + 1 full GET, and
  one extra full-list render. Impact: send latency, render cost. Fix: **S**
  (append user + assistant messages from the POST response; keep the full
  reload as a fallback).
- 🟢 LOW — Suggestion action state is per-id and scoped (`:83-85, :210-257`) —
  fine. `SuggestionPreview` receives fresh arrow props (`:287-288`) — only
  relevant if it gets memoized later.
- 🟢 LOW — Initial load is a single fetch keyed on a stable callback
  (`:93-140`); no reload loops found.

---

## 7. CSS impact (`src/app/globals.css`, 4,904 lines)

### 7.1 🟠 HIGH — Override stacking inflates every style recalculation
- **Evidence:** ~**751 `!important` declarations** across the file;
  `.document-extracted-text` styled in **~26 separate rule blocks**
  (lines 864, 876, 1693, 1851, 1917, 1941, 2002, 2037, 2299, 2355, 3474,
  3687, 3704-3714, …); `.document-note-floating-editor`/`.document-note-hover-box`
  redefined ~**32 times** (≈3840-4315); `.document-annotation-toolbar` ~12
  definitions; `.document-view-header` ~9.
- **Why:** every style recalculation on these elements must match and resolve
  all competing rule blocks plus `!important` tie-breaking. The elements
  affected are exactly the ones whose classes *change at runtime*
  (`.document-extracted-text` swaps `sentence-tool-*` classes, the floating
  editors mount/unmount constantly), so the resolution cost is paid on the hot
  interaction paths, not just at load.
- **Impact:** render cost (style recalc) on every viewer interaction; compounds
  with the React re-render frequency from sections 1–4.
- **Fix complexity:** **M–L** (consolidate the duplicate blocks; this overlaps
  the dedup work already flagged in audit 03-C1).

### 7.2 🟠 HIGH — Hover background fills on the full-height document `<pre>`
- **Evidence:** lines ≈3658-3714 —
  `.document-extracted-text.sentence-tool-highlight:hover { background: rgba(255,231,102,.08) }`
  (and `-note`, `-erase` variants, one as a `linear-gradient`); the element is
  up to `max-height: calc(100vh - 260px)` (≈3475).
- **Why:** entering/leaving the text area in tool mode repaints the entire
  visible document surface (large paint area, gradient variant worst). Combined
  with React hover re-renders (finding 1.4), pointer movement over the text
  pays both a React render and a large repaint.
- **Impact:** hover/annotation-mode pointer latency; paint cost.
- **Fix complexity:** **S** (tint via a cheap overlay/pseudo-element with
  `opacity` transitions, or drop the whole-area hover tint).

### 7.3 🟡 MEDIUM — `position: sticky` toolbar inside the scroll container
- **Evidence:** `.document-annotation-toolbar` `position: sticky !important;
  float: right; top: 72px !important` (≈3677-3685, 3719-3725);
  `.document-original-docx-preview-note` sticky (≈3420).
- **Why:** sticky offsets are re-evaluated per scroll frame; combined with
  `float` inside the scrolling text shell this adds layout work to the same
  scroll path that already runs `measurePinPositions` (finding 3.2).
- **Impact:** scrolling.
- **Fix complexity:** **S–M** (position the toolbar outside the scroller as an
  absolutely-positioned sibling).

### 7.4 🟡 MEDIUM — Universal-selector invalidation on pin-drag class toggle
- **Evidence:** ≈4701-4712 —
  `.document-text-pin-shell.pin-dragging * { user-select: none !important; }`.
- **Why:** toggling `pin-dragging` (React sets it at drag start/end,
  `DocumentViewPanel.tsx:1725, :1761, :1867`) invalidates style for **every
  descendant** of the text shell — on a large document that's thousands of text
  nodes/`<mark>`s recalculated twice per drag, stacked on top of finding 3.1's
  per-move cost.
- **Impact:** drag start/end hitch on large documents.
- **Fix complexity:** **S** (`user-select: none` on the shell alone inherits to
  descendants; the `*` rule is unnecessary).

### 7.5 🟡 MEDIUM — Fixed overlays with large shadows composited over the scroller
- **Evidence:** 12 `position: fixed` overlay rules (≈2841, 3313, 3408, 3841,
  3876, 3911, 3926, 4146, 4425, 4510, 4591) and ~32 `box-shadow` declarations,
  several 20-30px blurs on the floating editors (≈4012, 4172, 4229) and
  `filter: drop-shadow(...)` on `.document-pin-icon` (≈4760, 4818, 4873).
- **Why:** while a note/pin editor is open, scrolling re-composites large
  blurred shadows over the moving text; the pin icons carry a `drop-shadow`
  filter **and move via `top` changes during drag** (`DocumentViewPanel.tsx:1903`),
  so every drag frame repaints a filtered element. No `will-change`/compositor
  hints anywhere in the file.
- **Impact:** scroll with editors open; drag latency (pin icons).
- **Fix complexity:** **S** (move pins via `transform` — same change as win #4;
  reduce blur radii; promote the floating editors to their own layer).

### 7.6 🟢 LOW — Transition and font hygiene
- No `transition: all` found on hot elements and transitions are mostly on
  color/background (cheap) — good baseline.
- Body font is declared as `Arial...` (line 24) then overridden to `Inter, …`
  per-panel (≈2162, 2199, 2234, 2822, 3444); inconsistent stacks risk fallback
  swaps/layout shift at load, not interaction cost. Fix: **S**.

**CSS issues ranked:** 7.1 override stacking → 7.2 full-area hover repaint →
7.4 `*` invalidation on drag toggle → 7.3 sticky-in-scroller → 7.5 shadows/
filters on fixed layers → 7.6 fonts.

---

## TOP 10 performance wins (impact ÷ effort)

| # | Win | Findings | Effort | Expected effect |
|---|---|---|---|---|
| 1 | `useMemo` the annotated-document render on `[annotations, displayText]` | 1.1 | **S** | Removes the multiplier under every interaction: hover, typing, scroll, drag all stop re-rendering the full text |
| 2 | Stop mirroring editor drafts into `annotations`/`pins` per keystroke (commit on save/blur) | 2.2, 3.3 | **S** | Note/pin typing drops from 2 renders + measure-all-pins to ~0 document-level work per key |
| 3 | rAF-throttle scroll measurement; hoist `getComputedStyle`; one TreeWalker pass for all pins; equality-bail `setPinPositions` | 3.2, 2.3 | **S** | Scrolling a pinned document stops re-rendering and re-walking per tick |
| 4 | Pin drag via ref + `transform`, measurements cached at drag start, state committed on pointer-up | 3.1, 3.5 | **M** | The worst interaction goes from O(pins×text)+2 renders per move to ~one transform write per frame |
| 5 | Hoist `Intl.DateTimeFormat` to module scope (MessageList + viewer) | 3.6 | **S** | Eliminates per-message formatter construction; biggest single chat win |
| 6 | Move composer draft into `MessageComposer` (or `React.memo(MessageList)`) | 2.1 | **S** | Chat typing stops re-rendering the message history |
| 7 | Remove/wire the write-only `journalRefreshKey` | 1.3 | **S** | Deletes a guaranteed full-workspace render per suggestion approval (and surfaces a real bug) |
| 8 | `useCallback` the 5 workspace handlers + `React.memo` the three panels | 1.2 | **M** | Local interactions stop re-rendering unrelated panels (incl. the open document) |
| 9 | `useMemo` sorted pins + pin-number map; append from POST response instead of full chat reload | 3.4, §6 | **S** | Cheap render-loop and network savings that compound with #1–#4 |
| 10 | Float-layer drags (note editor, original window) via `transform` on refs, commit on release | 1.5, 2.5 | **S/M** | Smooth floating-window drag; resize of embedded PDF deferred to release |

**Sequencing note:** #1 is the prerequisite that makes #2–#4 measurable; do it
first. #4 (pin drag) is the largest absolute win but depends on #3's cached
measurement helpers, and switching pins to `transform` simultaneously resolves
the filtered-repaint cost (7.5). Two S-effort CSS wins ride along for free:
deleting the `.pin-dragging *` universal rule (7.4) and replacing the
full-area hover tint on the document `<pre>` (7.2). Everything in the table is
implementable without behavioral change.
