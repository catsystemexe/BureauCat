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

### CENTER — selected / active Step workspace

- Center is no longer reserved for chat.
- Primary role is the working surface for Analysis, Plan, Collection, Input Validation, Production, Output Review or Execution/Completion.
- Selecting a Step exposes its working content in or through the center.
- Exact presentation mechanic remains open: replacement, inline expansion, focused overlay/drawer, or another implementation-proven pattern.
- UI-selected Step is distinct from persisted workflow-active Step.

### RIGHT — contextual evidence/tools panel

- Preserve the current document workspace concept.
- Continue contextual Document and Analysis surfaces.
- Add Timeline as a planned peer tab when Timeline exists.
- This is context/evidence, not workflow navigation.
- Width relative to center may be tuned or made adjustable later.

## 3. Assistant / chat role

Assistant/chat is secondary, not a permanent full middle panel. It may later be implemented as compact input, drawer, floating assistant or another lightweight contextual interaction.

It must not reclaim the center as the primary shell structure.

## 4. Journal role

Journal remains the user-visible working model but is not required to occupy the entire left region. Detailed Journal interaction may appear contextually or in a dedicated working surface. Exact access pattern remains open.

Current implementation temporarily reuses Journal inside the Analysis Step workspace as an incremental bridge.

## 5. Stable decisions

- three-region shell remains;
- narrow left Situation/workflow rail;
- compact Situation selector remains prominent at top-left;
- selected Goal visible compactly;
- center is selected/active Step workspace;
- right remains Document/Analysis/context oriented and may gain Timeline;
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

Replit Free runtime/manual verification confirmed the workflow loads and clicking between Steps works. The D-027 MVP adds Goal proposals/manual confirmation to the central Situation Analysis surface; the simplified Journal stays a knowledge overview and no longer offers a competing Goal editor. The central Plan surface shows confirmed Goal, expected output, editable procedure and required information/criteria, distinguishes saved drafts from accepted versions, and uses the explicit “Použít tento plán” gate. Collection shows Máme / Neúplné / Chybí, concrete values/sources, explanations and explicit evidence review. Goal/Plan history remains available. AI is an optional proposal action; manual entry works without credentials or network.

Explicit successful confirmation/acceptance updates both the persisted active Step and UI navigation. Navigation/reload merely reads state. Situation-keyed components and request guards prevent old responses from populating a different Situation; source-refresh events hide stale coverage while rereading current evidence. The left rail and right document workspace remain in place. Business surfaces beyond Collection coverage remain placeholders. Actual Windows/browser acceptance is pending; controlled component tests do not establish layout success.
