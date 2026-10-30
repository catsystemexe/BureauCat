# BureauCat — UX Shell Direction v0.1

## Status

Approved prototype shell direction. It fixes region responsibilities but intentionally leaves exact panel proportions, responsive behavior and detailed Step-opening mechanics open.

## 1. Core principle

Situation workflow is the primary structural spine of the application. Journal, assistant/chat, Documents, Document Analysis and Timeline are supporting work/context surfaces rather than the main navigation model.

## 2. Three-region shell

Preserve the existing three-region visual language while redistributing responsibilities.

### LEFT — compact Situation / workflow rail

- Keep the left region narrow.
- Preserve compact Situation selector tiles near the top.
- Show selected Situation Goal in compact form.
- Show ordered Situation Steps vertically below.
- Emphasize orientation/current progress, not a dense Journal/document tree/dashboard.
- Step visual states follow the workflow persistence contract: `INACTIVE`, `ACTIVE`, `COMPLETED`.

### CENTER — Situation Journal

The existing Journal occupies the center regardless of UI-selected workflow Step. Its content, manual notes, document visibility checkboxes, source links and controls are unchanged. Do not duplicate Goal/Plan forms here or replace it with document analysis.

### RIGHT — Document / Situation Analysis / Plan

Approved allocation on 2026-10-30 supersedes the former central Goal/Plan workspaces:

- **Dokument:** existing document, detailed document analysis, source indices and navigation. Document detail is not Situation Analysis. Switching the source/detail view must preserve navigation and manual bookmarks.
- **Analýza:** main sections are **Situace → Cíl → K doplnění**. Situace and Cíl retain the saved brief, source navigation, Goal proposals/custom editing and explicit confirmation. Replace both the open-criteria overview and separate assessment panel with one criterion-based form: checkbox before exact requirement name, directly visible value field and Přiložit soubor. Sources/technical detail stay collapsed. Checkbox/value changes are drafts; one Uložit saves all changed rows atomically. Typed text/upload alone never grants sufficiency. Confirmed rows stay visible, checked and compact, with Upravit to reopen; changing value/links requires new confirmation. Save failures preserve drafts and do not show success. Current-Situation uploads use the existing endpoints without automatic analysis and attach explicitly to the item on Save. Source details and Další otázky z podkladů stay collapsed; no K ověření subheading or second assessment form. History stays collapsed. Form remains mounted across tabs/revision refreshes; Case/Situation/Plan changes reset only that scope. Navrhnout plán/manual Plan creation keeps its existing gates.
- **Plán:** confirmed Goal heading, expected output, numbered concrete actions. Each new-format action has a title/result; needed inputs/explanation/links live in its expandable detail. Default is read view; draft actions are Použít plán / Upravit, accepted action is Změnit plán. Only editing displays fields; saved changes require new acceptance. Histories remain collapsed and technical revisions/reload controls do not fill the normal view.

Keep one mounted Situation planning surface across right-tab changes, with persistent local drafts and stable criterion identities. Hidden views do not confirm or mutate anything. Scope changes to another Case/Situation reset that scope's UI; read-only navigation never changes persisted ACTIVE Step. Keep left navigation structure unchanged; its selections may expose the corresponding right surface, while the center stays Journal. No automatic action execution or new Timeline belongs here.

## 3. Assistant / chat role

Assistant/chat is secondary, not a permanent full middle panel. It may later be implemented as compact input, drawer, floating assistant or another lightweight contextual interaction.

It must not displace the Journal from the center.

## 4. Journal role

Journal remains the user-visible working model but is not required to occupy the entire left region. Detailed Journal interaction may appear contextually or in a dedicated working surface. Exact access pattern remains open.

The approved 2026-10-30 screen keeps Journal in the center; Goal, Situation Analysis and Plan occupy the right surfaces.

## 5. Stable decisions

- three-region shell remains;
- narrow left Situation/workflow rail;
- compact Situation selector remains prominent at top-left;
- selected Goal visible compactly;
- center is the existing Journal;
- right tabs are Dokument / Analýza / Plán; detailed document analysis belongs to Dokument;
- assistant/chat is secondary.

## 6. Explicitly open

- exact center/right ratio;
- user resizability;
- exact Journal access pattern;
- exact assistant/chat presentation;
- exact opening behavior for completed/non-active Steps;
- detailed responsive/mobile behavior;
- final workflow-rail visual styling.

## 7. Current implementation evidence

The first shell foundation is implemented on `work/workflow-foundation-v01`:

- compact left `WorkflowRail`;
- Situation selection;
- selected Goal summary;
- seven Step navigation;
- central `StepWorkspace`;
- UI selection separated from persisted workflow status;
- existing right Document/Analysis panel preserved.

Historical Replit Free verification confirmed the original shell loaded; it is not acceptance of the current layout. The initial D-027 central Goal/Plan UI has been superseded by the approved right-side allocation above. The existing atomic confirmation/acceptance, version history, concurrency checks and effective input coverage remain. Controlled regressions verify legacy/new Plan reading, explicit gates, source identity checks, scope isolation and draft preservation across tabs/refreshes. Actual Windows/browser layout, native navigation, keyboard/clipboard and real AI acceptance remain pending; see `docs/situation-right-panels.md`.


Brief source editing: Goal editing exposes current source choices separately for requirements and the deadline, plus removal of the deadline. Missing historical IDs are not hidden form selections. Refresh preserves typed Goal/trigger values and prunes invalid references. Historical confirmations remain in collapsed history. Without current verified support the deadline is labelled unverified, including while refreshing/editing; retaining its text is not proof. Confirmation remains explicit.

Presentation limit: persisted MISSING currently also means unassessed/partial; no structured field proves actual absence. Free explanations are not parsed to guess it. Consequently uncertain, incomplete and stale support uses **K ověření**; no empty **K doplnění** subsection is rendered. The latter label requires actual explicit absence evidence, which this batch does not invent or persist.

The approved completion form supersedes the earlier read-only open-items presentation recorded above. Its K doplnění title denotes user work, not an inferred absence classification. USER assertions may be explicitly confirmed without documents, clearly labelled Zadal uživatel; they are not document verification. Document-based evidence retains the existing exact-passage/membership/fingerprint checks. A changed/removed attached dependency revokes its confirmation; a source-independent USER assertion is unaffected by unrelated document changes.
