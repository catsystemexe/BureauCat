# BureauCat V2 Transition Map

This map summarizes where the current implementation already supports the V2 working model and where it still depends on the MVP/legacy model. It is intended to guide the next implementation tasks while keeping the existing MVP operational.

## Status legend

- **V2 ready** — the implemented foundation already matches the V2 direction.
- **MVP compatible** — the current MVP implementation can remain during the transition, but later alignment is still required.
- **Legacy / to refactor** — the implementation relies on the JournalItem-centered model and should move to a V2 structure.
- **Not implemented yet** — the required V2 capability does not currently exist.

## Current transition table

| Area | Current implementation | V2 target | Current status | Next action |
| --- | --- | --- | --- | --- |
| Case | Top-level container with MVP lifecycle and case-level data. | Remain the top-level container for situations, documents, and consultation history. | **MVP compatible** | Keep the current Case foundation and adapt its relationships incrementally. |
| Situation | Situation foundation exists as the primary working unit. | User-owned notebook page containing description, goals, linked documents, and situation-scoped AI outputs. | **V2 ready** (foundation) | Preserve the foundation and connect the remaining V2 layers to it. |
| Goals | Situation-scoped, user-owned goal foundation exists. | Separate user-managed goals with active, completed, and archived states. | **V2 ready** (foundation) | Use this entity for future goal work instead of adding goal behavior to JournalItem. |
| Documents | Case-level evidence supports upload, listing, and viewing. | Remain case-level evidence and be linkable to one or more situations. | **MVP compatible** | Keep case ownership and add situation links rather than moving documents. |
| Situation-document linking | No situation-to-document join model or linking workflow exists. | Additive many-to-many links between situations and case-level documents. | **Not implemented yet** | Implement the join model and user-controlled linking semantics first. |
| Chat / Konzultace | Case-scoped persisted chat acts as the central consultation workspace. | Keep consultation central and retain the active situation as message and AI context. | **MVP compatible** | Add situation context without turning chat into authoritative memory. |
| JournalItem | Generic authoritative MVP model stores description, goals, facts, questions, risks, and actions. | V2 user-owned entities and situation-scoped AI outputs replace the generic model. | **Legacy / to refactor** | Keep only as transition storage, stop extending it, and clean it up after V2 parity. |
| Analysis | Strategy/analysis content is represented through generic JournalItem data. | Situation-scoped AI analysis presented under Strategie. | **Legacy / to refactor** | Design after the other AI output structures and then migrate compatible legacy content. |
| Insights / Poznatky | Facts and claims are represented through JournalItem, source-link JSON, and evidence states. | Situation-scoped, reviewable, source-aware insights with traceable evidence. | **Legacy / to refactor** | Define and implement the V2 insight model after the AI output schema is agreed. |
| Questions / Otázky | Questions are generic JournalItem records. | Situation-scoped AI questions with open and answered states. | **Legacy / to refactor** | Add a dedicated V2 question structure after insights. |
| Risks / Rizika | Risks are generic JournalItem records. | Situation-scoped AI risks with active and resolved states. | **Legacy / to refactor** | Add a dedicated V2 risk structure after questions. |
| Action Plan / Postup | Actions and strategy items are stored as JournalItem records. | Situation-scoped, ordered AI recommendations under Strategie. | **Legacy / to refactor** | Add the V2 action-plan structure after risks without expanding workflow scope. |
| AI Suggestions | Validated, reviewable suggestions use pending, approved, and rejected states; approval currently creates JournalItem. | A generalized approval workflow for situation-scoped AI outputs and proposed user-layer changes. | **MVP compatible** | Preserve the workflow and later generalize its target beyond JournalItem. |
| Right Panel | Existing contextual evidence/document panel supports document access. | Three stable tabs: Documents, Poznatky, and Strategie. | **MVP compatible** | First align the Documents tab, then add Poznatky and Strategie as their models become available. |
| Document extraction | MVP placeholder stores or exposes limited extracted content and summaries. | Reliable extraction feeding source-aware insights, with advanced PDF/DOCX/OCR work postponed. | **MVP compatible** (placeholder) | Keep the placeholder; do not block the transition on the final extraction pipeline. |
| Meeting Prep | Generated transiently and not persisted as a database entity. | Remain a non-entity capability presented under the Strategie tab. | **MVP compatible** | Move its UI placement to Strategie when that tab is implemented. |

## Refactor sequence

The recommended next implementation sequence is:

1. Situation-document linking
2. Right panel Documents tab alignment
3. AI output schema design
4. Insights / Poznatky
5. Questions / Otázky
6. Risks / Rizika
7. Action Plan / Postup
8. Analysis / Strategie
9. JournalItem legacy cleanup

## Guardrails

- Do not add new features on top of legacy JournalItem when a V2 entity is already planned.
- Keep the existing MVP working during the transition.
- Prefer additive migrations.
- Avoid maintaining two authoritative models long-term.
- User-owned layer first, AI layer second.
- Do not let AI write directly to user-owned Situation, Goal, or Document links.
