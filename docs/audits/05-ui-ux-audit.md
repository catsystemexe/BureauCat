# 05 — UI/UX Audit

## Scope and limitations

This is a source-based desktop UI/UX review. The application was not launched because dependencies were not installed and the migration chain is currently inconsistent. Findings therefore focus on implemented flows, state handling, labels, semantics, and CSS behavior rather than pixel-level browser verification.

## Overall experience

The three-panel structure matches the intended desktop concept, and Czech labels generally communicate a supportive case workspace. However, the visible product hierarchy does not match MVP v1.2: the left panel is situation-centric rather than JournalItem-centric, the right panel defaults to document functionality rather than a clear Help/Evidence state, and several controls expose unfinished tabs or workflows.

## Journal

### Critical workflow gaps

- The left panel does not show the five canonical Journal sections—Description, Goals, Risks, Open Questions, Strategy—as JournalItem collections.
- Approved AI suggestions create JournalItems in the backend but are not visible in the left panel.
- No JournalItem can be selected, so the Evidence Panel cannot be opened from Journal navigation.
- No JournalItem edit flow is visible, despite the specification requiring user editing and evidence-state recheck.

### Confusing model

- “Situace” and a separate `Goal` list replace the expected case model.
- The AI side of the notebook shows five placeholders named Analysis, Findings, Questions, Risks, and Procedure. These are visually presented like content sections but are not the canonical Journal and have nonfunctional plus symbols.
- Situation title editing is triggered by double-click or a menu. Double-click is undiscoverable and weak for keyboard/touch users.

### Missing states

- No JournalItem empty states per canonical section.
- No evidence-state legend.
- No conflict explanation/action path.
- No resolved/obsolete filtering.
- No clear pending-suggestion-to-Journal transition after approval.

### Recommendations

1. Restore the canonical Journal section list and JournalItem cards as primary navigation.
2. Make every card keyboard-selectable and expose type, evidence state, and status without relying only on color.
3. Keep situation concepts out of MVP v1.2 unless the authoritative specification changes.
4. On approval, insert/refetch the item visibly and focus or announce it.

## Chat / Consultation

### Strengths

- Composer, messages, suggestions, and meeting-prep output are separated into recognizable visual units.
- Loading and error messages are present.
- Suggestions require explicit approve/reject actions.

### Issues

- The static “Recommended procedure” card precedes every conversation and may dominate the workspace even after the user understands onboarding.
- Sending a message waits for a server round trip and full reload before clearing the composer; there is no optimistic user message.
- Suggestion cards do not support “Edit + Approve,” an explicit MVP requirement.
- Meeting-preparation state and handler exist, but no visible trigger is rendered.
- Suggestion results appear only for the latest send; pending suggestions from earlier responses are not clearly restored unless another listing flow is used elsewhere.
- Chat errors are broad and may not distinguish AI unavailability from persistence failures.

### Missing states and accessibility

- No live region is evident for “sending,” new assistant response, or suggestion approval result.
- No explicit retry action for failed sends or failed message loading.
- No visible indication that Chat is a workspace rather than authoritative memory.
- Message timestamps/roles should be verified for screen-reader clarity.

### Recommendations

- Add edit-and-approve.
- Add the meeting-prep trigger only in the specified Chat workflow.
- Use `aria-live` status regions for async outcomes.
- Preserve unsent text on failure and offer retry.
- Visually reinforce that approved items move to Journal and unapproved chat content does not.

## Documents

### Strengths

- Upload, list, original preview, normalized text, validation status, and deletion are represented.
- Supported files are constrained by the file picker and server extension validation.
- Error text is present for upload/link failures.

### Issues

- Upload immediately performs conversion/OCR with no progress phases; users may experience a long unexplained wait.
- If upload succeeds but situation linking fails, the document exists but the UI reports a secondary error without a clear recovery action.
- The right-panel folder list is a click-outside overlay but lacks dialog/menu semantics, focus management, Escape handling, and focus return.
- “Analysis” and “Procedure” tabs display only placeholders. Exposing inactive primary tabs makes the interface feel unfinished and conflicts with scope clarity.
- Delete behavior does not appear to request confirmation even though it removes the DB record.
- Original document opens in an in-page floating window with drag/resize/fullscreen behavior that introduces substantial interaction complexity for an MVP.
- Accepted UI type `.rtf` exceeds the authoritative list and `.md` is accepted server-side but not declared in the input accept string.

### Missing states

- Processing state/progress and processing failure recovery.
- Clear distinction between extracted text, processed text, AI summary, and validated text.
- Explicit “document too large / summary used” warning required by the 10,000-character MVP limit.
- Accessible confirmation and consequence text for deletion.

## Notes

Notes are not specified as a first-class MVP v1.2 feature, but the implementation includes floating note editors and note markers.

### Issues

- Note creation depends on text selection and tool state, a workflow that may be difficult to discover.
- Floating editors use absolute coordinates and drag behavior; they may open off-screen or become detached during scrolling/resizing.
- Save behavior occurs on blur/Enter and can be hard to predict; there is no clear saved/unsaved indicator.
- Hover-only note previews are inaccessible to touch and potentially to keyboard users.
- Color selection appears to carry meaning without a documented semantic legend.
- Annotation list uses internal values such as `annotation_type` as labels, likely exposing English technical terms in a Czech UI.

### Recommendation

For v1.2, remove or defer notes unless product scope is amended. If retained, use a simple anchored side panel with explicit Save/Cancel and keyboard-accessible marker navigation instead of draggable floating editors.

## Highlights

The specification permits optional simple citation highlighting through string matching. The implementation is a full manual range-highlighting system.

### Issues

- The feature significantly exceeds the optional MVP behavior.
- Highlight color palette semantics do not match the specified Risk/Open Question/Fact-Goal mapping consistently.
- Exact offsets are stored and edited even though precise citation positions are explicitly out of scope.
- “Erase” and overlapping range behavior are complex and may produce surprising splits.
- Text edits can invalidate all saved offsets, but the UI does not explain or repair that relationship.
- Color-only differentiation needs non-color labels/patterns for accessibility.

### Recommendation

Reduce to deterministic string-matched citations linked from JournalItems, with no error when no match is found. If manual highlighting remains later, treat it as a separate post-MVP feature with text-versioning/range migration design.

## Bookmarks / pins

Pins function as bookmarks with optional notes and colors, but bookmarks/pins are not part of MVP v1.2.

### Issues

- Pin placement and dragging depend on document text geometry and visual offsets, making behavior fragile after resize, font change, editing, or text reprocessing.
- Drag handles and marker controls need verified keyboard equivalents; pointer-only drag is insufficient.
- Hover previews are not a complete accessible interaction.
- Pin numbering can change when positions change, making references unstable.
- There is no explicit distinction between a pin/bookmark, a note, and evidence linked to the Journal.

### Recommendation

Defer pins from MVP. Document navigation should be driven by source links from JournalItems, not by a parallel bookmark knowledge system.

## Visual consistency

- Two icon libraries may produce different stroke weights and visual language.
- The stylesheet has many repeated overrides, so identical components may vary by cascade position/context.
- Right-panel tabs, notebook sections, document tools, floating editors, and chat cards each introduce distinct interaction styles without a clear shared system.
- Several controls use icon-only buttons with `title`; titles are not a substitute for visible labels or robust tooltips.
- Placeholder plus characters are styled as actions but are noninteractive.

## Accessibility findings

| Finding | Severity | Recommendation |
|---|---|---|
| Many focus rules remove outlines | High | Ensure strong `:focus-visible` alternatives everywhere |
| Tabs lack `aria-controls`/tabpanel linkage and keyboard arrow behavior | Medium | Implement complete tab semantics or use simple buttons/headings |
| Click-outside document overlay lacks focus trap/return/Escape | High | Use an accessible popover/dialog pattern |
| Hover-only note/pin previews | High | Provide focus/click equivalents and persistent accessible text |
| Pointer drag/resize interactions lack keyboard alternative | High | Add keyboard controls or remove/defer interaction |
| Async statuses are not live regions | Medium | Add `role="status"`/`aria-live` where appropriate |
| Color conveys annotation/evidence meaning | High | Add text/icon labels and check contrast |
| Double-click edit is undiscoverable | Medium | Provide a visible Edit action |
| Custom menus do not show full keyboard/menu management | Medium | Prefer simple action buttons or implement menu keyboard behavior |
| Icon-only actions rely heavily on `title` | Medium | Add accessible names (some exist) and visible labels/tooltips for unfamiliar actions |

## Priority UX corrections

1. Restore JournalItems and Evidence Panel selection.
2. Hide/remove out-of-scope placeholder tabs and nonfunctional controls.
3. Add edit-and-approve and meeting-prep trigger.
4. Make document processing status explicit.
5. Remove/defer manual notes/highlights/pins for MVP alignment.
6. Perform keyboard-only and screen-reader review after focus styles are consolidated.
