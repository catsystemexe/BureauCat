# 05 — UI/UX Audit

> Read-only, code-based review (app not run), generated 2026-06-10.
> UI language is Czech; the visual system is a warm paper/notebook theme defined
> entirely in `src/app/globals.css`.

## Cross-cutting issues (affect every panel)

| # | Finding | Severity | Evidence |
|---|---|---|---|
| X1 | **No visual loading indicators anywhere** — all loading states are plain text ("Načítám…", "Odesílám…", "Připravuji…") with no spinner/skeleton/progress | HIGH | `GoalsSection.tsx:226`, `SituationPager.tsx:62`, `SituationDocumentsSection.tsx:125`, `ChatPanel.tsx:278`, `MessageComposer.tsx:34`, `MeetingPrepButton.tsx:14` |
| X2 | **No responsive layout** — grid needs ≈1120px min (`minmax(300px…)+minmax(340px…)+minmax(480px…)`); `globals.css` contains **zero `@media` rules**; unusable on tablet/phone | HIGH | `globals.css:212-217` |
| X3 | **Focus visibility inconsistent** — some elements get a 2px outline (`.journal-item-card:focus-visible`), many icon buttons set `outline: none` on `:focus-visible`, leaving keyboard users with no focus indicator | HIGH | `globals.css:322-324` vs `:1308, :1349, :2732, :3031` |
| X4 | **~7 unreconciled button patterns** (`.primary-action`, `.secondary-action`, `.notebook-text-button`, `.notebook-icon-button`, `.suggestion-action.*`, `.document-icon-action`, `.document-tool-color-button`) with differing hover/disabled/focus behavior | HIGH | `globals.css:113-126, 700-706, 1287-1349, 2710-2745` |
| X5 | Error message styling inconsistent — `.status-message.error-message` is dark red `#8b2d1c` (visible), but `.notebook-inline-error` inherits muted tan `#6d6258`, so journal errors are easy to miss | MEDIUM | `globals.css:134` vs `:1173`; used at `GoalsSection.tsx:227` |
| X6 | Disabled states inconsistent: `.primary-action:disabled` dims (`opacity: .65`), others only change cursor (`not-allowed`, even `cursor: wait`) with no visual dimming | MEDIUM | `globals.css:123-126, 632-633, 1325` |
| X7 | Empty-state messages differ in class, tone, and phrasing per panel ("Zatím žádné cíle." / "Zatím žádné zprávy." / "Bez položek." / "Podklady nejsou uvedeny.") | MEDIUM | `GoalsSection.tsx:229`, `MessageList.tsx:20-23`, `MeetingPrepCard.tsx:21`, `ThreePanelWorkspace.tsx:261,295` |
| X8 | **Two icon libraries**: heroicons in journal/workspace, lucide only in the document viewer — subtly different stroke styles in one app | MEDIUM | `JournalPanel.tsx:10-15` vs `DocumentViewPanel.tsx:6-18` |
| X9 | No optimistic UI — every action waits for the server, combined with X1 the app feels unresponsive on slow networks | MEDIUM | e.g. `ChatPanel.tsx:233-247` |
| X10 | Hardcoded colors bypass theme tokens (highlight/pin palettes, evidence badges), blocking consistent theming | MEDIUM | `DocumentViewPanel.tsx:65-88` |

## Journal (situations, goals, journal items)

- **Inconsistent edit patterns** — situation title: double-click → form block;
  goal title: double-click *or* pencil button → inline form. Same mental action,
  two mechanics. (`JournalPanel.tsx:137-162` vs `GoalsSection.tsx:246-290`) — HIGH
- **Double-click-to-edit is undiscoverable** — hinted only via `title` tooltip
  ("Dvojklikem upravit…"). No visible affordance. (`JournalPanel.tsx:162`,
  `GoalsSection.tsx:282`) — MEDIUM
- **Destructive actions without confirmation** — goal archive
  (`GoalsSection.tsx:184-209`) and document unlink
  (`SituationDocumentsSection.tsx:91-116`) fire immediately. Archive is
  recoverable in DB but not in UI. — MEDIUM
- **Mixed action iconography** — pencil glyph "✎" text button vs inline SVG trash
  vs "×" character for unlink. (`GoalsSection.tsx:289-308`,
  `SituationDocumentsSection.tsx:172`) — MEDIUM
- Single-item "Akce situace" dropdown menu (one option: rename) — odd pattern;
  promote to a direct button. (`JournalPanel.tsx:127-133`) — LOW
- New situations are auto-named "Situace {n}" with no immediate rename prompt.
  (`JournalPanel.tsx:282-310`) — LOW
- Accessibility is otherwise decent here: aria-labels on icon buttons are
  thorough; menu uses `role="menu"`/`menuitem`.

## Chat (messages, suggestions, meeting prep)

- **Suggestion approval gives no destination feedback** — "Přidat do zápisníku"
  flips to "Přidáno do zápisníku" but nothing indicates *where* in the journal
  the item landed (the journal silently refetches via refresh key).
  (`ChatPanel.tsx:232-247`, `SuggestionPreview.tsx:73-96`) — MEDIUM
- Send/meeting-prep have text-only busy states (see X1); the send button label
  swap ("Odesílám…") is the only feedback while the mock AI round-trips. — HIGH (covered by X1)
- Meeting-prep card explicitly says it isn't saved ("…neukládá se.") — good
  honesty, but users will likely expect persistence after waiting for a build;
  consider a "save to journal" affordance. (`MeetingPrepCard.tsx:33`) — MEDIUM
- Empty chat state uses its own styling rather than the shared empty-state
  pattern (X7). (`MessageList.tsx:20-23`) — LOW
- Composer has a proper `sr-only` label; message list semantics fine. — OK

## Documents — list & upload

- **Upload success is silent** — document just appears in the list; failures show
  text errors, success shows nothing (no toast/confirmation), and the
  upload→auto-link-to-situation second step can fail after upload succeeded,
  leaving an uploaded-but-unlinked document with no recovery hint.
  (`DocumentUpload.tsx:76-92`) — MEDIUM
- File-type validation is server-side only; the `accept` attr filters the picker
  but a wrong type errors only after a full upload round-trip.
  (`DocumentUpload.tsx:12, 115`) — MEDIUM
- Duplicate affordance: filename *and* a pencil icon both open the document.
  (`DocumentList.tsx:89-101`) — LOW

## Document viewer (`DocumentViewPanel.tsx`)

The viewer is the most feature-dense and least guided surface:

- **Five overlapping modes with no clear mode model** — view, text-edit,
  original-file window, fullscreen, and annotation tools can all combine; no
  visual indicator of the current mode beyond pressed-looking toolbar buttons.
  (≈:1270-1319) — HIGH
- **Tool workflow is undiscoverable** — selecting highlight/note/pin tool then
  clicking text is the model, but nothing communicates "now click/select text";
  `title` tooltips are the only help. (≈:828-899, 1493-1540) — HIGH
- **Pins vs notes are near-identical interactions with different semantics**
  (numbered markers, floating editors, drag) — users have no cue which to use
  when. (≈:556-624 vs :734-806) — HIGH
- **Validation lock is confusing** — edit is disabled when validated
  ("Validovaný text je zamčený") but the unlock lives on a separate CircleCheck
  toggle with no link between the two. (≈:1281-1289) — HIGH
- **Erase tool vs "transparent" highlight color** both remove highlights — two
  mechanisms for one action. (:65-72 vs ≈:1505-1520) — MEDIUM
- **Original-file window** is draggable/resizable with no visible handles, opens
  at fixed `x:24, y:96, 760×620` (overflows small viewports), and can occlude
  the text with no minimize. (:96-105, ≈:1344-1454) — MEDIUM
- After dragging a pin, clicks are suppressed for ~120ms with no feedback
  (`suppressPinClickRef`). (≈:1857-1862) — LOW
- **Missing states:** no saving indicator for annotations (only button disable),
  no retry on failed annotation (must redo selection), no unsaved-changes
  indicator in text-edit mode, no sync indicator during pin-drag PATCH.
  (≈:570-623, :1699-1704) — HIGH/MEDIUM
- **Accessibility:**
  - Tool buttons toggle via class only — no `aria-pressed` (≈:1495-1520) — HIGH
  - Note markers open floating editors without `aria-expanded`/`aria-haspopup`
    (≈:412-438) — MEDIUM
  - Pins are pointer-drag only; no keyboard alternative (≈:1766-1868) — MEDIUM
  - Floating editors are absolutely positioned and can land off-screen; Escape
    closes them (good, :243) but nothing repositions them — MEDIUM
  - Highlight palette colors (#ffe766, #b7f7c2, #ffc6df) are very light;
    boundary contrast vs the paper background is marginal — LOW

## Workspace shell

- Right context panel tabs use `role="tab"` without `aria-selected`; active
  state is class-only. (`ThreePanelWorkspace.tsx:372-400`) — MEDIUM
- The right panel's relationship to the documents panel is visually ambiguous
  (separate tab system inside the third column). (`ThreePanelWorkspace.tsx:369-527`) — MEDIUM
- No mobile/stacked layout (X2). — HIGH

## Recommended order of fixes

1. **A spinner/skeleton primitive + apply everywhere** (X1) — single component,
   immediate perceived-quality jump.
2. **Focus-visible + aria-pressed/aria-selected sweep** (X3, viewer toolbar,
   right-panel tabs) — small diffs, big a11y gain.
3. **One button system (3 variants) + consistent disabled/error styling**
   (X4, X5, X6) — pairs naturally with the CSS dedup work in report 03.
4. **Viewer guidance:** visible mode indicator, hint text when a tool is armed,
   link validation-lock message to its toggle.
5. **Confirmation dialogs** for archive/unlink/delete.
6. **Responsive breakpoints** (or an explicit "desktop only" gate screen) —
   decide intent rather than letting the layout silently break.
7. Consolidate icons to one library (X8) and empty-state copy (X7).
